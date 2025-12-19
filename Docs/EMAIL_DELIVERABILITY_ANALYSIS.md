# Email System Deliverability & Production Readiness Analysis

**Date**: 2025-01-27  
**Scope**: Complete end-to-end analysis of Dokploy's email hosting system  
**Goal**: Production-grade email delivery with Zoho/Google Workspace/SendGrid-level reliability

---

## Executive Summary

Dokploy's email system has a **solid foundation** with docker-mailserver, but requires **critical improvements** in deliverability, monitoring, and abuse prevention to reach production-grade standards. The system currently lacks bounce/complaint handling, rate limiting, sender reputation management, and comprehensive monitoring.

**Overall Status**: ⚠️ **PARTIALLY PRODUCTION-READY** (60% complete)

**Critical Gaps**:
- ❌ No bounce/complaint handling
- ❌ No suppression lists
- ❌ No rate limiting for sending
- ❌ No sender reputation monitoring
- ❌ No email headers compliance validation
- ⚠️ Basic SPF/DKIM/DMARC (needs improvement)
- ⚠️ No IP reputation management

---

## 1. Current Implementation Status

### ✅ **What is Correct**

#### 1.1 Infrastructure Foundation
- ✅ **docker-mailserver**: Production-ready Postfix + Dovecot stack
- ✅ **Rspamd**: Advanced spam filtering enabled
- ✅ **Fail2ban**: Brute force protection enabled
- ✅ **OpenDKIM**: DKIM signing enabled
- ✅ **OpenDMARC**: DMARC verification enabled
- ✅ **Policyd-SPF**: SPF checking enabled
- ✅ **TLS/SSL**: Encryption for all connections
- ✅ **Multi-tenant isolation**: Organization-level separation via `organizationId`

#### 1.2 Database Schema
- ✅ **4 core tables**: `email_domains`, `email_accounts`, `email_forwards`, `email_aliases`
- ✅ **DNS verification tracking**: `dnsVerified` flag
- ✅ **DKIM key storage**: `dkimPublicKey`, `dkimPrivateKey`, `dkimSelector`
- ✅ **Quota management**: Per-account quotas
- ✅ **Account enable/disable**: `enabled` flag

#### 1.3 Security Basics
- ✅ **Password hashing**: bcrypt with salt rounds
- ✅ **Transaction safety**: DB operations wrapped in transactions
- ✅ **Health checks**: Mail server health monitoring
- ✅ **Permission system**: RBAC for email operations

---

### ⚠️ **What Needs Improvement**

#### 2.1 SPF, DKIM, DMARC Implementation

**Current State**:
- ✅ SPF/DKIM/DMARC enabled in mailserver.env
- ✅ DKIM key generation via mail server
- ✅ DNS verification logic exists
- ⚠️ **SPF record is generic**: `v=spf1 mx ~all` (should be more specific)
- ⚠️ **DMARC policy is weak**: `p=quarantine` (should progress to `p=reject`)
- ⚠️ **No SPF record validation**: Doesn't verify SPF includes mail server IP
- ⚠️ **No DMARC reporting**: No `ruf` (forensic reports) configured
- ⚠️ **DKIM selector hardcoded**: Uses "mail" selector, should be configurable

**Issues**:
1. **SPF Record Too Permissive**
   ```dns
   Current: v=spf1 mx ~all
   Should be: v=spf1 mx a:mail.example.com ip4:YOUR_IP -all
   ```
   - `~all` allows soft-fail (emails still delivered)
   - Should use `-all` for strict enforcement
   - Should explicitly include mail server IP

2. **DMARC Policy Too Lenient**
   ```dns
   Current: v=DMARC1; p=quarantine; rua=mailto:postmaster@domain
   Should progress: v=DMARC1; p=reject; rua=mailto:dmarc@domain; ruf=mailto:dmarc@domain; pct=100; sp=reject
   ```
   - `p=quarantine` doesn't reject emails
   - Missing `ruf` for forensic reports
   - Missing `sp` policy for subdomains

3. **No SPF Record Validation**
   - Code doesn't verify SPF record includes mail server IP
   - Could lead to SPF failures

**Recommendations**:
```typescript
// packages/server/src/services/email.ts
export const getDNSRecords = async (emailDomainId: string) => {
  const domain = await findEmailDomainById(emailDomainId);
  const mailServerIp = domain.mailServerIp || await getMailServerIp();
  
  return {
    spf: {
      type: "TXT",
      host: "@",
      // Include explicit IP and A record
      value: `v=spf1 mx a:mail.${domain.domain} ip4:${mailServerIp} -all`,
    },
    dmarc: {
      type: "TXT",
      host: "_dmarc",
      // Progressive policy with reporting
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain.domain}; ruf=mailto:dmarc@${domain.domain}; pct=100; sp=quarantine; aspf=r; adkim=r`,
    },
  };
};
```

#### 2.2 SMTP Configuration

**Current State**:
- ✅ Ports configured: 25, 587, 465, 143, 993
- ✅ TLS enabled
- ⚠️ **No rate limiting**: Postfix default limits may be too permissive
- ⚠️ **No connection limits**: Could be abused
- ⚠️ **No message size limits per domain**: Only global limit (50MB)
- ⚠️ **No sending quotas per account**: Unlimited sending

**Missing Postfix Configuration**:
```bash
# Rate limiting (MISSING)
smtpd_client_connection_rate_limit = 10
smtpd_client_message_rate_limit = 5
smtpd_client_recipient_rate_limit = 5
smtpd_client_connection_count_limit = 10

# Per-domain limits (MISSING)
smtpd_recipient_restrictions = 
    check_recipient_access hash:/etc/postfix/recipient_limits

# Message size per account (MISSING)
message_size_limit = 50MB  # Global only
```

**Recommendations**:
1. **Add Postfix rate limiting**:
   ```bash
   # Add to mailserver.env or postfix-main.cf
   POSTFIX_SMTPD_CLIENT_CONNECTION_RATE_LIMIT=10
   POSTFIX_SMTPD_CLIENT_MESSAGE_RATE_LIMIT=5
   POSTFIX_SMTPD_CLIENT_RECIPIENT_RATE_LIMIT=5
   ```

2. **Add per-account sending limits**:
   - Track sending volume per account
   - Implement daily/hourly quotas
   - Block accounts exceeding limits

3. **Add connection limits**:
   ```bash
   smtpd_client_connection_count_limit = 10
   smtpd_client_connection_rate_limit = 10
   ```

#### 2.3 IP/Domain Reputation Management

**Current State**:
- ❌ **No IP reputation monitoring**: No checks against blacklists
- ❌ **No domain reputation tracking**: No monitoring of sender score
- ❌ **No warm-up process**: New IPs/domains start sending immediately
- ❌ **No reputation recovery**: No process for delisting

**Missing Features**:
1. **Blacklist Monitoring**:
   - Check IP against major blacklists (Spamhaus, SURBL, etc.)
   - Alert on blacklist status
   - Automatic delisting requests

2. **Sender Score Tracking**:
   - Monitor Sender Score (senderbase.org)
   - Track bounce rates
   - Track complaint rates

3. **IP Warm-up**:
   - Gradual sending volume increase
   - Start with low volume (50/day)
   - Gradually increase over weeks

**Recommendations**:
```typescript
// packages/server/src/services/email-reputation.ts (NEW FILE)
export const checkIPReputation = async (ip: string) => {
  const blacklists = [
    'zen.spamhaus.org',
    'bl.spamcop.net',
    'dnsbl.sorbs.net',
  ];
  
  const results = await Promise.all(
    blacklists.map(bl => checkBlacklist(ip, bl))
  );
  
  return {
    ip,
    blacklisted: results.some(r => r.listed),
    blacklists: results.filter(r => r.listed).map(r => r.name),
    score: calculateReputationScore(results),
  };
};

export const checkDomainReputation = async (domain: string) => {
  // Check domain against reputation services
  // Return sender score, bounce rate, complaint rate
};
```

---

### ❌ **What is Missing**

#### 3.1 Bounce, Complaint, and Suppression Handling

**Critical Gap**: No bounce/complaint handling system exists.

**Impact**:
- Bounced emails continue to be sent (waste resources)
- Complaints not tracked (reputation damage)
- No suppression list (legal/compliance risk)
- No feedback loop processing

**Required Implementation**:

1. **Bounce Handling Table**:
```sql
CREATE TABLE email_bounces (
  bounce_id TEXT PRIMARY KEY,
  email_domain_id TEXT NOT NULL,
  email_account_id TEXT,
  recipient_email TEXT NOT NULL,
  bounce_type TEXT NOT NULL, -- 'hard', 'soft', 'transient'
  bounce_code TEXT,
  bounce_message TEXT,
  bounced_at TIMESTAMP NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (email_domain_id) REFERENCES email_domains(emailDomainId)
);

CREATE TABLE email_complaints (
  complaint_id TEXT PRIMARY KEY,
  email_domain_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  complaint_source TEXT, -- 'feedback-loop', 'abuse-report'
  complaint_date TIMESTAMP NOT NULL,
  message_id TEXT,
  FOREIGN KEY (email_domain_id) REFERENCES email_domains(emailDomainId)
);

CREATE TABLE email_suppressions (
  suppression_id TEXT PRIMARY KEY,
  email_domain_id TEXT NOT NULL,
  email_address TEXT NOT NULL,
  suppression_type TEXT NOT NULL, -- 'bounce', 'complaint', 'unsubscribe', 'manual'
  suppressed_at TIMESTAMP NOT NULL,
  reason TEXT,
  FOREIGN KEY (email_domain_id) REFERENCES email_domains(emailDomainId),
  UNIQUE(email_domain_id, email_address)
);
```

2. **Bounce Processing Service**:
```typescript
// packages/server/src/services/email-bounces.ts (NEW FILE)
export const processBounce = async (bounceData: {
  recipient: string;
  bounceType: 'hard' | 'soft' | 'transient';
  bounceCode: string;
  message: string;
  emailDomainId: string;
}) => {
  // 1. Store bounce record
  await db.insert(emailBounces).values({
    bounceId: nanoid(),
    emailDomainId: bounceData.emailDomainId,
    recipientEmail: bounceData.recipient,
    bounceType: bounceData.bounceType,
    bounceCode: bounceData.bounceCode,
    bounceMessage: bounceData.message,
    bouncedAt: new Date(),
  });

  // 2. If hard bounce, add to suppression list
  if (bounceData.bounceType === 'hard') {
    await addToSuppressionList({
      emailDomainId: bounceData.emailDomainId,
      emailAddress: bounceData.recipient,
      suppressionType: 'bounce',
      reason: bounceData.message,
    });
  }

  // 3. Update domain bounce rate
  await updateDomainBounceRate(bounceData.emailDomainId);

  // 4. Alert if bounce rate exceeds threshold
  const bounceRate = await getDomainBounceRate(bounceData.emailDomainId);
  if (bounceRate > 0.05) { // 5% threshold
    await alertHighBounceRate(bounceData.emailDomainId, bounceRate);
  }
};
```

3. **Feedback Loop Processing**:
```typescript
// packages/server/src/services/email-feedback.ts (NEW FILE)
export const processFeedbackLoop = async (arfMessage: string) => {
  // Parse ARF (Abuse Reporting Format) message
  // Extract complaint details
  // Add to complaints table
  // Add to suppression list
  // Alert domain owner
};
```

4. **Suppression List Check**:
```typescript
// packages/server/src/services/email.ts
export const createEmailAccount = async (input: {...}) => {
  // Before sending, check suppression list
  const isSuppressed = await checkSuppressionList(
    input.emailDomainId,
    recipientEmail
  );
  
  if (isSuppressed) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Email address is on suppression list",
    });
  }
  
  // ... rest of logic
};
```

#### 3.2 Rate Limiting & Retries

**Current State**:
- ❌ **No rate limiting**: Accounts can send unlimited emails
- ❌ **No retry logic**: Failed sends not retried
- ❌ **No backoff strategy**: No exponential backoff
- ❌ **No sending quotas**: No daily/hourly limits

**Required Implementation**:

1. **Rate Limiting Table**:
```sql
CREATE TABLE email_rate_limits (
  rate_limit_id TEXT PRIMARY KEY,
  email_domain_id TEXT NOT NULL,
  email_account_id TEXT,
  limit_type TEXT NOT NULL, -- 'daily', 'hourly', 'per_minute'
  limit_value INTEGER NOT NULL,
  current_count INTEGER DEFAULT 0,
  reset_at TIMESTAMP NOT NULL,
  FOREIGN KEY (email_domain_id) REFERENCES email_domains(emailDomainId)
);
```

2. **Rate Limiting Service**:
```typescript
// packages/server/src/services/email-rate-limit.ts (NEW FILE)
export const checkRateLimit = async (
  emailDomainId: string,
  emailAccountId?: string,
  limitType: 'daily' | 'hourly' | 'per_minute' = 'daily'
) => {
  const limit = await getRateLimit(emailDomainId, emailAccountId, limitType);
  
  if (limit.currentCount >= limit.limitValue) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Limit: ${limit.limitValue} ${limitType}`,
    });
  }
  
  await incrementRateLimit(limit.rateLimitId);
};

// Default limits
const DEFAULT_LIMITS = {
  daily: 1000,      // 1000 emails per day per account
  hourly: 100,     // 100 emails per hour per account
  per_minute: 10,  // 10 emails per minute per account
};
```

3. **Retry Logic with Exponential Backoff**:
```typescript
// packages/server/src/services/email-send.ts (NEW FILE)
export const sendEmailWithRetry = async (
  emailData: EmailData,
  maxRetries = 3
) => {
  let attempt = 0;
  let delay = 1000; // Start with 1 second

  while (attempt < maxRetries) {
    try {
      return await sendEmail(emailData);
    } catch (error) {
      attempt++;
      
      if (attempt >= maxRetries) {
        // Log permanent failure
        await logEmailFailure(emailData, error);
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      delay = Math.min(delay * 2, 30000); // Max 30 seconds
      await sleep(delay);
    }
  }
};
```

#### 3.3 Email Headers & Content Compliance

**Current State**:
- ❌ **No header validation**: Headers not checked for compliance
- ❌ **No content validation**: No spam content checking
- ❌ **No List-Unsubscribe header**: Missing unsubscribe mechanism
- ❌ **No Message-ID validation**: Could cause duplicate detection issues

**Required Headers**:
```typescript
// packages/server/src/services/email-headers.ts (NEW FILE)
export const validateEmailHeaders = (headers: Record<string, string>) => {
  const required = [
    'From',
    'To',
    'Subject',
    'Message-ID',
    'Date',
    'MIME-Version',
  ];
  
  const recommended = [
    'List-Unsubscribe',
    'List-Unsubscribe-Post',
    'Precedence',
    'X-Mailer',
  ];
  
  // Validate required headers
  for (const header of required) {
    if (!headers[header]) {
      throw new Error(`Missing required header: ${header}`);
    }
  }
  
  // Validate format
  if (!headers['Message-ID'].match(/^<.+@.+>$/)) {
    throw new Error('Invalid Message-ID format');
  }
  
  // Add recommended headers if missing
  if (!headers['List-Unsubscribe']) {
    headers['List-Unsubscribe'] = `<mailto:unsubscribe@${domain}>`;
  }
};

export const addComplianceHeaders = (
  headers: Record<string, string>,
  domain: string
) => {
  return {
    ...headers,
    'List-Unsubscribe': `<mailto:unsubscribe@${domain}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'Precedence': 'bulk',
    'X-Mailer': 'Dokploy Email Server',
    'X-Auto-Response-Suppress': 'All',
  };
};
```

#### 3.4 Sender Reputation Monitoring

**Current State**:
- ❌ **No reputation monitoring**: No tracking of sender score
- ❌ **No bounce rate tracking**: No bounce rate calculation
- ❌ **No complaint rate tracking**: No complaint monitoring
- ❌ **No deliverability metrics**: No inbox placement tracking

**Required Implementation**:

1. **Reputation Metrics Table**:
```sql
CREATE TABLE email_reputation_metrics (
  metric_id TEXT PRIMARY KEY,
  email_domain_id TEXT NOT NULL,
  metric_date DATE NOT NULL,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_complained INTEGER DEFAULT 0,
  bounce_rate DECIMAL(5,4) DEFAULT 0,
  complaint_rate DECIMAL(5,4) DEFAULT 0,
  delivery_rate DECIMAL(5,4) DEFAULT 0,
  sender_score INTEGER,
  blacklist_status JSONB,
  FOREIGN KEY (email_domain_id) REFERENCES email_domains(emailDomainId),
  UNIQUE(email_domain_id, metric_date)
);
```

2. **Reputation Monitoring Service**:
```typescript
// packages/server/src/services/email-reputation.ts (NEW FILE)
export const calculateReputationMetrics = async (
  emailDomainId: string,
  date: Date = new Date()
) => {
  const metrics = await db.query.emailReputationMetrics.findFirst({
    where: and(
      eq(emailReputationMetrics.emailDomainId, emailDomainId),
      eq(emailReputationMetrics.metricDate, date.toISOString().split('T')[0])
    ),
  });
  
  // Calculate bounce rate
  const bounceRate = metrics.totalBounced / metrics.totalSent;
  
  // Calculate complaint rate
  const complaintRate = metrics.totalComplained / metrics.totalSent;
  
  // Calculate delivery rate
  const deliveryRate = metrics.totalDelivered / metrics.totalSent;
  
  // Check blacklist status
  const blacklistStatus = await checkIPReputation(domain.mailServerIp);
  
  // Calculate sender score (0-100)
  const senderScore = calculateSenderScore({
    bounceRate,
    complaintRate,
    deliveryRate,
    blacklistStatus,
  });
  
  // Alert if reputation is poor
  if (senderScore < 50 || bounceRate > 0.05 || complaintRate > 0.001) {
    await alertPoorReputation(emailDomainId, {
      senderScore,
      bounceRate,
      complaintRate,
    });
  }
  
  return {
    senderScore,
    bounceRate,
    complaintRate,
    deliveryRate,
    blacklistStatus,
  };
};
```

#### 3.5 Multi-Tenant Isolation

**Current State**:
- ✅ **Organization-level isolation**: `organizationId` in all tables
- ✅ **Permission checks**: RBAC system in place
- ⚠️ **No sending isolation**: All domains share same IP
- ⚠️ **No reputation isolation**: One bad domain affects all

**Issues**:
1. **Shared IP Address**: All domains use same mail server IP
   - One spammer affects all domains
   - No IP-based reputation isolation

2. **No Domain Reputation Isolation**:
   - Bounce/complaint rates not isolated per domain
   - One bad domain can impact others

**Recommendations**:
1. **IP Pool Management**:
   - Assign dedicated IPs to high-volume domains
   - Isolate new domains on separate IPs
   - Monitor IP reputation separately

2. **Domain Reputation Tracking**:
   - Track metrics per domain
   - Isolate domains with poor reputation
   - Auto-suspend domains exceeding thresholds

---

## 4. Issues That Could Cause Spam

### 4.1 High-Risk Issues

1. **No Bounce Handling** ❌
   - **Risk**: Sending to invalid addresses repeatedly
   - **Impact**: High bounce rate → spam classification
   - **Fix**: Implement bounce processing (Section 3.1)

2. **No Complaint Handling** ❌
   - **Risk**: Users marking emails as spam
   - **Impact**: High complaint rate → blacklisting
   - **Fix**: Implement complaint processing (Section 3.1)

3. **No Rate Limiting** ❌
   - **Risk**: Accounts sending bulk emails
   - **Impact**: Appears as spam behavior
   - **Fix**: Implement rate limiting (Section 3.2)

4. **Weak SPF Record** ⚠️
   - **Risk**: `~all` allows soft-fail
   - **Impact**: SPF failures not strictly enforced
   - **Fix**: Use `-all` and include explicit IP (Section 2.1)

5. **No IP Reputation Monitoring** ❌
   - **Risk**: IP gets blacklisted unknowingly
   - **Impact**: All emails rejected
   - **Fix**: Implement reputation monitoring (Section 3.4)

6. **No Sender Warm-up** ❌
   - **Risk**: New IPs sending at full volume
   - **Impact**: Immediate spam classification
   - **Fix**: Implement warm-up process (Section 2.3)

### 4.2 Medium-Risk Issues

1. **No Content Validation** ⚠️
   - **Risk**: Spam-like content in emails
   - **Impact**: Content-based spam filtering
   - **Fix**: Add content validation (Section 3.3)

2. **No List-Unsubscribe Header** ⚠️
   - **Risk**: Users can't unsubscribe easily
   - **Impact**: Increased complaint rate
   - **Fix**: Add compliance headers (Section 3.3)

3. **No Sending Quotas** ⚠️
   - **Risk**: Accounts sending unlimited emails
   - **Impact**: Appears as spam behavior
   - **Fix**: Implement quotas (Section 3.2)

---

## 5. Security & Abuse Prevention

### 5.1 Current Security Measures ✅

- ✅ **Fail2ban**: Brute force protection
- ✅ **Rspamd**: Spam filtering
- ✅ **TLS/SSL**: Encrypted connections
- ✅ **Password hashing**: bcrypt
- ✅ **Permission system**: RBAC

### 5.2 Missing Security Measures ❌

1. **No Account Verification** ❌
   - **Risk**: Fake accounts sending spam
   - **Fix**: Require email verification before sending

2. **No Sending Authentication** ❌
   - **Risk**: Accounts can send without verification
   - **Fix**: Require SMTP authentication for all sends

3. **No Abuse Detection** ❌
   - **Risk**: No detection of spam patterns
   - **Fix**: Implement abuse detection algorithms

4. **No Account Suspension** ❌
   - **Risk**: Abusive accounts continue operating
   - **Fix**: Auto-suspend accounts with high bounce/complaint rates

---

## 6. Production-Grade Recommendations

### 6.1 Immediate Actions (P0 - Critical)

1. **Implement Bounce Handling** (2-3 days)
   - Create bounce/complaint/suppression tables
   - Implement bounce processing service
   - Add suppression list checks

2. **Add Rate Limiting** (1-2 days)
   - Implement rate limit tables
   - Add rate limit checks to sending
   - Configure default limits

3. **Improve SPF/DKIM/DMARC** (1 day)
   - Update SPF to use `-all` and explicit IP
   - Add DMARC reporting
   - Validate DNS records properly

4. **Add Reputation Monitoring** (2-3 days)
   - Create reputation metrics table
   - Implement monitoring service
   - Add alerting for poor reputation

### 6.2 Short-Term Actions (P1 - High Priority)

1. **Implement Complaint Handling** (2 days)
   - Process feedback loops
   - Add to suppression lists
   - Alert domain owners

2. **Add Email Headers Compliance** (1 day)
   - Validate required headers
   - Add List-Unsubscribe
   - Add compliance headers

3. **Implement Retry Logic** (1 day)
   - Add exponential backoff
   - Retry failed sends
   - Log permanent failures

4. **Add Sending Quotas** (1 day)
   - Per-account daily/hourly limits
   - Track sending volume
   - Block exceeding accounts

### 6.3 Medium-Term Actions (P2 - Important)

1. **IP Reputation Management** (3-4 days)
   - Blacklist monitoring
   - IP warm-up process
   - Reputation recovery

2. **Content Validation** (2 days)
   - Spam content checking
   - Header validation
   - Content scoring

3. **Multi-IP Support** (5-7 days)
   - IP pool management
   - Domain-to-IP assignment
   - IP reputation isolation

4. **Advanced Monitoring** (3-4 days)
   - Deliverability dashboard
   - Real-time metrics
   - Alerting system

---

## 7. Code Changes Required

### 7.1 Database Migrations

**File**: `apps/dokploy/drizzle/0136_email_deliverability.sql`

```sql
-- Bounce handling
CREATE TABLE email_bounces (
  bounce_id TEXT PRIMARY KEY,
  email_domain_id TEXT NOT NULL,
  email_account_id TEXT,
  recipient_email TEXT NOT NULL,
  bounce_type TEXT NOT NULL,
  bounce_code TEXT,
  bounce_message TEXT,
  bounced_at TIMESTAMP NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (email_domain_id) REFERENCES email_domains(emailDomainId)
);

-- Complaints
CREATE TABLE email_complaints (
  complaint_id TEXT PRIMARY KEY,
  email_domain_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  complaint_source TEXT,
  complaint_date TIMESTAMP NOT NULL,
  message_id TEXT,
  FOREIGN KEY (email_domain_id) REFERENCES email_domains(emailDomainId)
);

-- Suppression list
CREATE TABLE email_suppressions (
  suppression_id TEXT PRIMARY KEY,
  email_domain_id TEXT NOT NULL,
  email_address TEXT NOT NULL,
  suppression_type TEXT NOT NULL,
  suppressed_at TIMESTAMP NOT NULL,
  reason TEXT,
  FOREIGN KEY (email_domain_id) REFERENCES email_domains(emailDomainId),
  UNIQUE(email_domain_id, email_address)
);

-- Rate limiting
CREATE TABLE email_rate_limits (
  rate_limit_id TEXT PRIMARY KEY,
  email_domain_id TEXT NOT NULL,
  email_account_id TEXT,
  limit_type TEXT NOT NULL,
  limit_value INTEGER NOT NULL,
  current_count INTEGER DEFAULT 0,
  reset_at TIMESTAMP NOT NULL,
  FOREIGN KEY (email_domain_id) REFERENCES email_domains(emailDomainId)
);

-- Reputation metrics
CREATE TABLE email_reputation_metrics (
  metric_id TEXT PRIMARY KEY,
  email_domain_id TEXT NOT NULL,
  metric_date DATE NOT NULL,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_complained INTEGER DEFAULT 0,
  bounce_rate DECIMAL(5,4) DEFAULT 0,
  complaint_rate DECIMAL(5,4) DEFAULT 0,
  delivery_rate DECIMAL(5,4) DEFAULT 0,
  sender_score INTEGER,
  blacklist_status JSONB,
  FOREIGN KEY (email_domain_id) REFERENCES email_domains(emailDomainId),
  UNIQUE(email_domain_id, metric_date)
);
```

### 7.2 New Service Files

1. **`packages/server/src/services/email-bounces.ts`** - Bounce processing
2. **`packages/server/src/services/email-complaints.ts`** - Complaint handling
3. **`packages/server/src/services/email-suppressions.ts`** - Suppression list
4. **`packages/server/src/services/email-rate-limit.ts`** - Rate limiting
5. **`packages/server/src/services/email-reputation.ts`** - Reputation monitoring
6. **`packages/server/src/services/email-headers.ts`** - Header validation
7. **`packages/server/src/services/email-send.ts`** - Sending with retries

### 7.3 Configuration Updates

**File**: `templates/mail-server/mailserver.env`

```bash
# Add rate limiting
POSTFIX_SMTPD_CLIENT_CONNECTION_RATE_LIMIT=10
POSTFIX_SMTPD_CLIENT_MESSAGE_RATE_LIMIT=5
POSTFIX_SMTPD_CLIENT_RECIPIENT_RATE_LIMIT=5

# Add bounce handling
ENABLE_BOUNCE_HANDLING=1
BOUNCE_EMAIL_ADDRESS=postmaster@${MAIL_DOMAIN}

# Add feedback loop
ENABLE_FEEDBACK_LOOP=1
FEEDBACK_LOOP_EMAIL=abuse@${MAIL_DOMAIN}
```

---

## 8. DNS Records Template

### 8.1 Recommended DNS Configuration

```dns
# A Record
mail.example.com.    A    192.0.2.1

# MX Record
example.com.    MX    10 mail.example.com.

# SPF Record (STRICT)
example.com.    TXT    "v=spf1 mx a:mail.example.com ip4:192.0.2.1 -all"

# DKIM Record
mail._domainkey.example.com.    TXT    "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY"

# DMARC Record (PROGRESSIVE)
_dmarc.example.com.    TXT    "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; ruf=mailto:dmarc@example.com; pct=100; sp=quarantine; aspf=r; adkim=r"

# PTR Record (Reverse DNS - ask hosting provider)
192.0.2.1    PTR    mail.example.com.
```

### 8.2 DMARC Policy Progression

**Week 1-2**: `p=none` (monitoring only)
```dns
v=DMARC1; p=none; rua=mailto:dmarc@example.com; ruf=mailto:dmarc@example.com
```

**Week 3-4**: `p=quarantine` (quarantine failures)
```dns
v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; ruf=mailto:dmarc@example.com; pct=25
```

**Week 5-6**: Increase quarantine percentage
```dns
v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; ruf=mailto:dmarc@example.com; pct=50
```

**Week 7-8**: Full quarantine
```dns
v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; ruf=mailto:dmarc@example.com; pct=100
```

**Week 9+**: Move to reject (if reputation is good)
```dns
v=DMARC1; p=reject; rua=mailto:dmarc@example.com; ruf=mailto:dmarc@example.com; pct=100; sp=reject
```

---

## 9. Production Readiness Checklist

### 9.1 Authentication & DNS ✅/❌

- [x] SPF record configured
- [x] DKIM keys generated
- [x] DMARC record configured
- [ ] SPF uses `-all` (strict)
- [ ] SPF includes explicit IP
- [ ] DMARC has `ruf` (forensic reports)
- [ ] DMARC policy progresses to `reject`
- [ ] PTR record configured
- [ ] DNS records validated

### 9.2 Bounce & Complaint Handling ❌

- [ ] Bounce processing implemented
- [ ] Complaint processing implemented
- [ ] Suppression list implemented
- [ ] Feedback loop processing
- [ ] Automatic suppression on hard bounces
- [ ] Alert on high bounce rate (>5%)
- [ ] Alert on high complaint rate (>0.1%)

### 9.3 Rate Limiting & Quotas ❌

- [ ] Rate limiting implemented
- [ ] Daily sending quotas
- [ ] Hourly sending quotas
- [ ] Per-minute limits
- [ ] Per-account limits
- [ ] Per-domain limits
- [ ] Quota tracking

### 9.4 Reputation Management ❌

- [ ] IP reputation monitoring
- [ ] Domain reputation tracking
- [ ] Blacklist checking
- [ ] Sender score calculation
- [ ] Bounce rate tracking
- [ ] Complaint rate tracking
- [ ] Deliverability metrics
- [ ] Reputation alerts

### 9.5 Email Headers & Content ✅/❌

- [ ] Required headers validated
- [ ] List-Unsubscribe header
- [ ] Message-ID validation
- [ ] Content validation
- [ ] Spam content checking
- [ ] Header compliance

### 9.6 Security & Abuse Prevention ✅/❌

- [x] Fail2ban enabled
- [x] Rspamd enabled
- [x] TLS/SSL enabled
- [ ] Account verification required
- [ ] SMTP auth required
- [ ] Abuse detection
- [ ] Auto-suspension on abuse

### 9.7 Monitoring & Alerting ❌

- [ ] Deliverability dashboard
- [ ] Real-time metrics
- [ ] Bounce rate alerts
- [ ] Complaint rate alerts
- [ ] Blacklist alerts
- [ ] Reputation alerts
- [ ] Sending quota alerts

### 9.8 Retry & Error Handling ❌

- [ ] Retry logic implemented
- [ ] Exponential backoff
- [ ] Permanent failure logging
- [ ] Transient failure handling
- [ ] Error categorization

---

## 10. Estimated Implementation Timeline

### Phase 1: Critical Foundations (Week 1-2)
- Bounce/complaint/suppression tables
- Basic bounce processing
- Rate limiting
- SPF/DKIM/DMARC improvements

### Phase 2: Reputation & Monitoring (Week 3-4)
- Reputation metrics
- Blacklist monitoring
- Alerting system
- Dashboard

### Phase 3: Advanced Features (Week 5-6)
- Feedback loop processing
- Content validation
- IP warm-up
- Multi-IP support

### Phase 4: Polish & Testing (Week 7-8)
- Comprehensive testing
- Documentation
- Performance optimization
- Security audit

**Total Estimated Time**: 6-8 weeks for full production-grade implementation

---

## 11. Conclusion

Dokploy's email system has a **solid foundation** but requires **significant enhancements** to reach production-grade deliverability. The most critical gaps are:

1. **Bounce/complaint handling** (highest priority)
2. **Rate limiting** (prevents abuse)
3. **Reputation monitoring** (maintains sender score)
4. **SPF/DKIM/DMARC improvements** (authentication)

With these improvements, Dokploy can achieve **Zoho/Google Workspace/SendGrid-level reliability** and maintain excellent sender reputation.

**Current Status**: ⚠️ **60% Production-Ready**  
**Target Status**: ✅ **95% Production-Ready** (after implementing recommendations)

---

**Next Steps**:
1. Review and prioritize recommendations
2. Create implementation tickets
3. Begin Phase 1 implementation
4. Set up monitoring and alerting
5. Gradual rollout with testing

