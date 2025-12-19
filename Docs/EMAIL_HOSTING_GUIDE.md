# Email Hosting Integration for Dokploy

## Overview
This feature adds complete email hosting capabilities to Dokploy, allowing users to manage their own email infrastructure directly through the platform.

## Features Implemented

### ✅ Database Layer
- **4 Database Tables**:
  - `email_domains` - Email domain management
  - `email_accounts` - User mailboxes
  - `email_forwards` - Email forwarding rules
  - `email_aliases` - Email aliases

- **Schema Features**:
  - Unique constraints on domains and email addresses
  - Foreign key relationships with projects, servers, and organizations
  - DKIM key storage for email authentication
  - DNS verification tracking
  - Quota management
  - Enable/disable accounts

### ✅ Service Layer
- **Domain Services** (`packages/server/src/services/email.ts`):
  - Create, read, update, delete domains
  - DKIM key generation (RSA 2048-bit)
  - DNS verification (MX, SPF, DKIM, DMARC)
  - Connection info generation

- **Account Services**:
  - Create, read, update, delete email accounts
  - Password hashing with bcrypt
  - Quota management
  - Enable/disable functionality

- **Forward Services**:
  - Create, read, update, delete email forwards
  - Forward emails to external addresses

- **Alias Services**:
  - Create, read, update, delete email aliases
  - Multiple aliases per account

### ✅ API Layer
- **tRPC Router** (`apps/dokploy/server/api/routers/email.ts`):
  - All CRUD operations for domains, accounts, forwards, and aliases
  - Organization-level authorization
  - DKIM generation endpoint
  - DNS verification endpoint
  - Connection info retrieval

### ✅ Docker Infrastructure
- **Mail Server Stack** (`templates/mail-server/`):
  - **docker-mailserver**: Production-ready Postfix + Dovecot
  - **Roundcube**: Web-based email client
  - **Rspamd**: Advanced spam filtering
  - **Redis**: Caching for spam filter
  - **MySQL**: Database for Roundcube

- **Features**:
  - SSL/TLS encryption
  - IMAP, POP3, SMTP support
  - DKIM, SPF, DMARC authentication
  - Fail2ban protection
  - 50MB message size limit
  - Quota management

### ✅ UI Components
- **Main Dashboard** (`apps/dokploy/pages/dashboard/email.tsx`):
  - Grid view of all email domains
  - Domain status badges (active/pending/disabled)
  - DNS verification status
  - Quick actions (verify DNS, manage domain, delete)
  - Search and filter functionality

- **Domain Details Page** (`apps/dokploy/pages/dashboard/email/[domainId].tsx`):
  - DNS configuration instructions with copy buttons
  - Tabbed interface for accounts, forwards, and aliases
  - Real-time DKIM key generation
  - Connection settings display

- **Dialog Components**:
  - Add Email Domain
  - Add Email Account (with quota and password confirmation)
  - Add Email Forward
  - Add Email Alias

### ✅ Mail Server Integration
- **Docker Utilities** (`packages/server/src/utils/mail-server.ts`):
  - Container health checking
  - Mailbox creation/deletion
  - Password updates
  - Alias management
  - DKIM key generation
  - Quota management
  - Log retrieval
  - Forwarding configuration

### ✅ Database Migration
- **Migration File** (`apps/dokploy/drizzle/0133_email_hosting.sql`):
  - Creates all 4 email tables
  - Sets up foreign key constraints
  - Creates performance indexes
  - Ready to deploy

### ✅ Navigation Integration
- Added "Email Hosting" menu item in sidebar
- Accessible from main dashboard navigation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Domains   │  │   Accounts   │  │ Forwards/Aliases │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       API Layer (tRPC)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  email.createDomain, email.createAccount, etc.      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
│  ┌────────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │   Domain   │  │   Account   │  │  Forward/Alias    │   │
│  │  Services  │  │  Services   │  │    Services       │   │
│  └────────────┘  └─────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────┘
            │                           │
            ▼                           ▼
┌──────────────────────┐    ┌───────────────────────────────┐
│   Database (Drizzle) │    │   Mail Server (Docker)        │
│                      │    │  ┌────────────────────────┐   │
│ • email_domains      │    │  │  docker-mailserver     │   │
│ • email_accounts     │    │  │  (Postfix + Dovecot)   │   │
│ • email_forwards     │    │  └────────────────────────┘   │
│ • email_aliases      │    │  ┌────────────────────────┐   │
│                      │    │  │     Roundcube          │   │
└──────────────────────┘    │  │    (Webmail Client)    │   │
                            │  └────────────────────────┘   │
                            │  ┌────────────────────────┐   │
                            │  │      Rspamd            │   │
                            │  │   (Spam Filtering)     │   │
                            │  └────────────────────────┘   │
                            └───────────────────────────────┘
```

## Installation & Setup

### 1. Run Database Migration
```bash
cd apps/dokploy
npm run db:migrate
```

### 2. Deploy Mail Server
```bash
cd templates/mail-server
docker-compose up -d
```

### 3. Configure Environment Variables
Update `templates/mail-server/mailserver.env` with your settings:
```env
MAIL_HOSTNAME=mail.yourdomain.com
MAIL_DOMAIN=yourdomain.com
```

### 4. Configure DNS Records
For each email domain, add these DNS records:

**MX Record:**
```
Type: MX
Host: @
Value: mail.yourdomain.com
Priority: 10
```

**A Record:**
```
Type: A
Host: mail
Value: YOUR_SERVER_IP
```

**SPF Record:**
```
Type: TXT
Host: @
Value: v=spf1 mx ~all
```

**DKIM Record** (generated automatically in UI):
```
Type: TXT
Host: mail._domainkey
Value: <generated-key>
```

**DMARC Record:**
```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:postmaster@yourdomain.com
```

### 5. Access Services
- **Dokploy Dashboard**: https://your-dokploy-url/dashboard/email
- **Roundcube Webmail**: http://your-server-ip:8080
- **Rspamd UI**: http://your-server-ip:11334

## Usage Guide

### Creating an Email Domain
1. Navigate to **Dashboard → Email Hosting**
2. Click **Add Domain**
3. Enter domain name (e.g., `example.com`)
4. Optionally link to a project
5. Click **Create Domain**
6. Copy and configure DNS records
7. Click **Verify DNS** to check configuration

### Creating Email Accounts
1. Click on a domain card
2. Go to **Email Accounts** tab
3. Click **Add Account**
4. Enter username, password, and optional full name
5. Set quota (in MB) or leave empty for unlimited
6. Click **Create Account**

### Setting Up Email Forwards
1. Navigate to domain details
2. Go to **Forwards** tab
3. Click **Add Forward**
4. Enter source address (e.g., `contact`)
5. Enter destination email (can be external)
6. Click **Create Forward**

### Creating Email Aliases
1. Navigate to domain details
2. Go to **Aliases** tab
3. Click **Add Alias**
4. Enter alias address (e.g., `sales`)
5. Select destination account
6. Click **Create Alias**

## Email Client Configuration

### IMAP (Incoming Mail)
- **Server**: mail.yourdomain.com
- **Port**: 993
- **Security**: SSL/TLS
- **Username**: your-email@yourdomain.com
- **Password**: [your password]

### SMTP (Outgoing Mail)
- **Server**: mail.yourdomain.com
- **Port**: 587 (or 465 for SSL)
- **Security**: STARTTLS (or SSL/TLS)
- **Username**: your-email@yourdomain.com
- **Password**: [your password]

## Security Features

### Authentication
- ✅ SPF (Sender Policy Framework)
- ✅ DKIM (DomainKeys Identified Mail) - 2048-bit RSA keys
- ✅ DMARC (Domain-based Message Authentication)

### Spam Protection
- ✅ Rspamd with machine learning
- ✅ Greylisting
- ✅ SPF/DKIM/DMARC verification
- ✅ Fail2ban protection against brute force

### Encryption
- ✅ TLS/SSL for all connections
- ✅ Encrypted password storage (bcrypt)
- ✅ Encrypted mail transport

## File Structure

```
dokploy/
├── apps/dokploy/
│   ├── components/dashboard/email/
│   │   ├── show-email-domains.tsx          # Main domain list
│   │   ├── show-email-domain-details.tsx   # Domain management
│   │   ├── add-email-domain.tsx            # Domain creation
│   │   ├── add-email-account.tsx           # Account creation
│   │   ├── add-email-forward.tsx           # Forward creation
│   │   └── add-email-alias.tsx             # Alias creation
│   ├── pages/dashboard/
│   │   └── email/
│   │       ├── index.tsx                   # Email dashboard page
│   │       └── [domainId].tsx              # Domain details page
│   ├── server/api/routers/
│   │   └── email.ts                        # tRPC email router
│   └── drizzle/
│       └── 0133_email_hosting.sql          # Database migration
├── packages/server/src/
│   ├── db/schema/
│   │   ├── email.ts                        # Database schema
│   │   └── index.ts                        # Schema exports
│   ├── services/
│   │   └── email.ts                        # Business logic
│   └── utils/
│       └── mail-server.ts                  # Docker integration
└── templates/mail-server/
    ├── docker-compose.yml                   # Mail server stack
    ├── mailserver.env                       # Configuration
    └── README.md                            # Setup instructions
```

## API Endpoints

### Domains
- `email.createDomain` - Create a new email domain
- `email.getAllDomains` - List all domains
- `email.getDomain` - Get domain details
- `email.updateDomain` - Update domain settings
- `email.removeDomain` - Delete domain
- `email.generateDkim` - Generate DKIM keys
- `email.verifyDns` - Verify DNS configuration

### Accounts
- `email.createAccount` - Create email account
- `email.getAllAccounts` - List domain accounts
- `email.getAccount` - Get account details
- `email.updateAccount` - Update account settings
- `email.removeAccount` - Delete account
- `email.getConnectionInfo` - Get client settings

### Forwards
- `email.createForward` - Create email forward
- `email.getAllForwards` - List domain forwards
- `email.getForward` - Get forward details
- `email.updateForward` - Update forward
- `email.removeForward` - Delete forward

### Aliases
- `email.createAlias` - Create email alias
- `email.getAllAliases` - List domain aliases
- `email.getAlias` - Get alias details
- `email.updateAlias` - Update alias
- `email.removeAlias` - Delete alias

## Known Limitations

1. **Password Storage**: Currently, passwords are hashed and cannot be recovered. When creating accounts, the plaintext password must be passed to the mail server during creation.

2. **Mail Server Dependency**: The mail server must be running for account/alias/forward operations to work. The UI will show database records, but the actual email functionality requires the Docker containers.

3. **Single Mail Server**: Currently designed for a single mail server instance. Multi-server support would require additional configuration.

4. **DNS Verification**: Automated DNS verification may not work in all environments due to DNS propagation delays.

## Future Enhancements

### Planned Features
- [ ] Catch-all address configuration
- [ ] Email quota usage tracking
- [ ] Mailbox statistics and analytics
- [ ] Advanced spam filter configuration
- [ ] Custom mail server templates
- [ ] Multi-server support
- [ ] Automatic SSL certificate management (Let's Encrypt)
- [ ] Email backup and restore
- [ ] Email migration tools
- [ ] Vacation/auto-responder settings
- [ ] Mailing list support
- [ ] IMAP folder management
- [ ] Email search functionality

### Technical Improvements
- [ ] Real-time mail server status monitoring
- [ ] WebSocket-based quota usage updates
- [ ] Bulk email account creation
- [ ] CSV import/export for accounts
- [ ] API rate limiting
- [ ] Email sending statistics
- [ ] Audit logging for all email operations

## Troubleshooting

### Mail Server Not Running
```bash
docker ps | grep mailserver
docker logs mailserver
```

### DNS Not Verifying
1. Check DNS propagation: `dig MX yourdomain.com`
2. Wait 24-48 hours for full DNS propagation
3. Use `dig` or `nslookup` to verify each record type

### Cannot Send/Receive Email
1. Check firewall rules (ports 25, 143, 465, 587, 993)
2. Verify DNS records are correct
3. Check mail server logs: `docker logs mailserver`
4. Verify SPF/DKIM/DMARC configuration

### Webmail Not Accessible
```bash
docker ps | grep roundcube
docker logs roundcube
```

### Spam Filter Issues
```bash
docker logs rspamd
# Access Rspamd UI at http://your-ip:11334
```

## Testing

### Test Email Sending
```bash
docker exec -it mailserver nc localhost 25
EHLO test
MAIL FROM: user@yourdomain.com
RCPT TO: test@external.com
DATA
Subject: Test
Test message
.
QUIT
```

### Test IMAP
```bash
docker exec -it mailserver nc localhost 143
```

### Test Authentication
```bash
docker exec -it mailserver doveadm auth test user@yourdomain.com password
```

## Contributing

When adding new email features:
1. Add database schema changes to a new migration file
2. Update service layer in `packages/server/src/services/email.ts`
3. Add tRPC endpoints in `apps/dokploy/server/api/routers/email.ts`
4. Create UI components in `apps/dokploy/components/dashboard/email/`
5. Update this README with new features

## Support

For issues or questions:
- Check the logs: `docker logs mailserver`
- Review DNS configuration
- Check firewall and network settings
- Consult docker-mailserver documentation: https://docker-mailserver.github.io/

## License

This email hosting integration follows the same license as Dokploy.
