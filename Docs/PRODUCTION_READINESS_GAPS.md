# Email Module - Production Readiness Gap Analysis

## Critical Issues Found

### 🔴 **CRITICAL: Mail Server Container Name Mismatch**

**Issue**: Code uses hardcoded `"mailserver"` but deployment scripts use `"dokploy-mailserver"`

**Location**: `packages/server/src/utils/mail-server.ts:9`

**Impact**: All mail server operations will fail in production deployments

**Files Affected**:
- `packages/server/src/utils/mail-server.ts` - All 15+ functions
- Deployment scripts use `dokploy-mailserver` container name

**Fix Required**: Make container name configurable via environment variable

---

### 🟡 **HIGH: DNS Verification Logic Incomplete**

**Issue**: DNS verification doesn't properly parse `dig` output

**Location**: `packages/server/src/services/email.ts:610-668`

**Problems**:
1. `dig +short MX` returns multiple lines, not just boolean
2. SPF record grep may fail silently
3. DKIM selector may be null/undefined
4. No proper parsing of DNS record values

**Impact**: DNS verification will give false negatives/positives

---

### 🟡 **HIGH: DKIM Generation Not Using Mail Server**

**Issue**: Uses `openssl` directly instead of mail server's DKIM generation

**Location**: `packages/server/src/services/email.ts:575-608`

**Problems**:
1. Keys generated outside mail server won't be recognized
2. Mail server has its own DKIM setup command
3. Keys stored in DB but not in mail server config

**Impact**: DKIM signatures won't work

---

### 🟡 **MEDIUM: Mail Server Health Component Not Connected**

**Issue**: Uses mock data instead of API call

**Location**: `apps/dokploy/components/dashboard/email/mail-server-health.tsx:20-44`

**Impact**: Health status not displayed correctly

---

### 🟡 **MEDIUM: Missing Permission Checks in Domain Details**

**Issue**: No permission checks for account/forward/alias operations in UI

**Location**: `apps/dokploy/components/dashboard/email/show-email-domain-details.tsx`

**Missing**:
- Permission check for creating accounts
- Permission check for deleting accounts
- Permission check for managing forwards/aliases

---

### 🟡 **MEDIUM: Missing Validation & Error Handling**

**Issues**:
1. Quota validation missing (max limit check)
2. Email format consistency not enforced
3. DNS verification errors not shown in UI
4. Account enable/disable functionality missing

---

## Step-by-Step Fixes Required

### Fix 1: Make Mail Server Container Name Configurable

**File**: `packages/server/src/constants/index.ts`

```typescript
export const MAILSERVER_CONTAINER = process.env.MAILSERVER_CONTAINER_NAME || "mailserver";
```

**File**: `packages/server/src/utils/mail-server.ts`

```typescript
import { MAILSERVER_CONTAINER } from "../constants";

// Replace all instances of hardcoded "mailserver"
```

**Environment Variable**: Add to `.env` and deployment scripts:
```bash
MAILSERVER_CONTAINER_NAME=dokploy-mailserver
```

---

### Fix 2: Fix DNS Verification Logic

**File**: `packages/server/src/services/email.ts`

**Current Issues**:
- `dig +short MX` returns: `10 mail.example.com.` (with priority)
- Need to check if MX record points to correct server
- SPF record parsing incomplete
- DKIM selector may be null

**Required Changes**:
1. Parse MX records properly
2. Validate MX points to mail server
3. Parse SPF record value correctly
4. Handle missing DKIM selector
5. Better error messages

---

### Fix 3: Fix DKIM Generation

**File**: `packages/server/src/services/email.ts`

**Current**: Uses `openssl` directly
**Required**: Use mail server's DKIM setup command

```typescript
// Use mail server's DKIM generation
await mailServer.generateDkimKeys(domain.domain);
// Then read the public key from mail server
const publicKey = await mailServer.getDkimPublicKey(domain.domain);
```

---

### Fix 4: Connect Mail Server Health Component

**File**: `apps/dokploy/components/dashboard/email/mail-server-health.tsx`

**Replace mock with**:
```typescript
const { data: health, refetch } = api.email.checkMailServerHealth.useQuery(
  undefined,
  { refetchInterval: 30000 } // Auto-refresh every 30s
);
```

---

### Fix 5: Add Permission Checks to Domain Details

**File**: `apps/dokploy/components/dashboard/email/show-email-domain-details.tsx`

**Add**:
```typescript
const { data: member } = api.user.get.useQuery();
const canCreateAccounts = member?.canCreateEmailAccounts || member?.role !== "member";
const canDeleteAccounts = member?.canDeleteEmailAccounts || member?.role !== "member";
const canManageForwards = member?.canManageEmailForwards || member?.role !== "member";
```

**Apply to**:
- `AddEmailAccount` button
- Delete account buttons
- `AddEmailForward` button
- `AddEmailAlias` button

---

### Fix 6: Add Missing Validations

**File**: `packages/server/src/services/email.ts`

**Add**:
1. Quota max limit validation (e.g., 100GB)
2. Email format consistency (lowercase enforcement)
3. Username uniqueness across all domains (optional)

**File**: `apps/dokploy/server/db/schema/email.ts`

**Update schema validation**:
```typescript
quota: z.number().min(0).max(102400).optional(), // Max 100GB
```

---

### Fix 7: Add Account Enable/Disable UI

**Missing**: Toggle to enable/disable accounts

**File**: `apps/dokploy/components/dashboard/email/show-email-domain-details.tsx`

**Add**: Switch component for `account.enabled` field

---

### Fix 8: Improve Error Messages

**Files**: All email components

**Add**:
- DNS verification status display
- Clear error messages for DNS failures
- Mail server health warnings
- Quota exceeded warnings

---

## Required Code Changes

### 1. Constants Update

**File**: `packages/server/src/constants/index.ts`

```typescript
export const MAILSERVER_CONTAINER = process.env.MAILSERVER_CONTAINER_NAME || "mailserver";
```

### 2. Mail Server Utils Update

**File**: `packages/server/src/utils/mail-server.ts`

- Import `MAILSERVER_CONTAINER` from constants
- Replace all hardcoded `"mailserver"` strings

### 3. DNS Verification Fix

**File**: `packages/server/src/services/email.ts`

- Properly parse `dig` output
- Validate MX record points to mail server
- Handle missing DKIM selector
- Better error handling

### 4. DKIM Generation Fix

**File**: `packages/server/src/services/email.ts`

- Use mail server's DKIM generation
- Read keys from mail server
- Store in database

### 5. Frontend Permission Integration

**Files**: 
- `show-email-domain-details.tsx`
- `add-email-account.tsx`
- `add-email-forward.tsx`
- `add-email-alias.tsx`

- Add permission checks
- Hide/show buttons based on permissions

### 6. Health Component Fix

**File**: `mail-server-health.tsx`

- Connect to API endpoint
- Auto-refresh functionality
- Better error display

---

## Validation Checks Required

### Backend Validation

1. **Container Name Resolution**
   - [ ] Test with `mailserver` container name
   - [ ] Test with `dokploy-mailserver` container name
   - [ ] Test with environment variable override

2. **DNS Verification**
   - [ ] Test with valid MX record
   - [ ] Test with invalid MX record
   - [ ] Test with missing SPF record
   - [ ] Test with missing DKIM record
   - [ ] Test with missing DMARC record

3. **DKIM Generation**
   - [ ] Test DKIM key generation via mail server
   - [ ] Test DKIM key retrieval
   - [ ] Test DNS record format

4. **Transaction Safety**
   - [ ] Test account creation with mail server down
   - [ ] Test account deletion with mail server down
   - [ ] Test password update with mail server down

5. **Permission System**
   - [ ] Test member without permissions
   - [ ] Test member with partial permissions
   - [ ] Test service-level access filtering

### Frontend Validation

1. **Permission UI**
   - [ ] Test button visibility based on permissions
   - [ ] Test error messages for unauthorized actions
   - [ ] Test permission-based form rendering

2. **Health Component**
   - [ ] Test health check API call
   - [ ] Test auto-refresh
   - [ ] Test error states

3. **DNS Status Display**
   - [ ] Test DNS verification status display
   - [ ] Test DNS record copy functionality
   - [ ] Test DNS verification button

---

## Missing Infrastructure/Configuration

### 1. Environment Variables

**Required in `.env`**:
```bash
MAILSERVER_CONTAINER_NAME=dokploy-mailserver  # or mailserver for dev
```

**Update deployment scripts** to set this variable

### 2. DNS Verification Dependencies

**Required**: `dig` command available on server
- Most Linux distros have `dnsutils` package
- Add to deployment documentation

### 3. Mail Server Integration

**Required**: Mail server container must be:
- Running before email operations
- Accessible via Docker socket
- Configured with proper volumes

### 4. Error Monitoring

**Recommended**: Add logging/monitoring for:
- Mail server operation failures
- DNS verification failures
- Transaction rollbacks

---

## Implementation Priority

### P0 (Critical - Blocks Production)
1. ✅ Fix mail server container name mismatch
2. ✅ Fix DNS verification logic
3. ✅ Fix DKIM generation

### P1 (High - Required for Production)
4. ✅ Connect mail server health component
5. ✅ Add permission checks to domain details
6. ✅ Add quota validation

### P2 (Medium - Nice to Have)
7. ✅ Add account enable/disable UI
8. ✅ Improve error messages
9. ✅ Add DNS status display improvements

---

## Testing Checklist

### Unit Tests Needed
- [ ] Mail server container name resolution
- [ ] DNS verification parsing
- [ ] DKIM key generation
- [ ] Permission helper functions
- [ ] Transaction rollback scenarios

### Integration Tests Needed
- [ ] End-to-end account creation flow
- [ ] DNS verification flow
- [ ] Permission enforcement
- [ ] Mail server health checks
- [ ] Error recovery scenarios

### Manual Testing
- [ ] Test with `mailserver` container
- [ ] Test with `dokploy-mailserver` container
- [ ] Test DNS verification with real domains
- [ ] Test permission system with different roles
- [ ] Test mail server down scenarios

---

**Status**: Analysis Complete  
**Next Steps**: Implement P0 fixes, then P1, then P2

