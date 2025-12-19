# Dokploy Mail Server Setup

## Overview
This template deploys a complete mail server infrastructure with:
- **Postfix** - SMTP server for sending/receiving emails
- **Dovecot** - IMAP/POP3 server for mailbox access
- **Roundcube** - Web-based email client
- **Rspamd** - Advanced spam filtering
- **Redis** - Caching for spam filter

## Prerequisites
1. A domain name (e.g., `example.com`)
2. DNS access to create MX, SPF, DKIM, and DMARC records
3. SSL certificate for your mail domain
4. Open ports: 25, 143, 465, 587, 993, 8080, 11334

## Environment Variables
Create a `.env` file with the following variables:

```env
# Mail Server
MAIL_HOSTNAME=mail.example.com
MAIL_DOMAIN=example.com

# Database
MYSQL_ROOT_PASSWORD=<strong-password>
ROUNDCUBE_DB_PASSWORD=<strong-password>

# Rspamd
RSPAMD_PASSWORD=<strong-password>
```

## DNS Records Required

### MX Record
```
Type: MX
Host: @
Value: mail.example.com
Priority: 10
```

### A Record
```
Type: A
Host: mail
Value: <your-server-ip>
```

### SPF Record
```
Type: TXT
Host: @
Value: v=spf1 mx ~all
```

### DKIM Record
After deployment, generate DKIM keys:
```bash
docker exec mailserver setup config dkim
```

Then add the TXT record:
```
Type: TXT
Host: mail._domainkey
Value: <generated-dkim-public-key>
```

### DMARC Record
```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:postmaster@example.com
```

## Setup Instructions

### 1. Deploy the Stack
```bash
docker-compose up -d
```

### 2. Create Your First Email Account
```bash
docker exec -it mailserver setup email add admin@example.com <password>
```

### 3. Generate DKIM Keys
```bash
docker exec -it mailserver setup config dkim
```

### 4. Configure SSL
Place your SSL certificates in:
```
./mail-config/ssl/cert.pem
./mail-config/ssl/key.pem
```

### 5. Access Webmail
Open your browser and navigate to:
```
http://your-server-ip:8080
```

Login with your email credentials.

### 6. Access Rspamd UI
```
http://your-server-ip:11334
```
Password: The one you set in RSPAMD_PASSWORD

## Email Client Configuration

### IMAP (Incoming)
- Server: mail.example.com
- Port: 993
- Security: SSL/TLS

### SMTP (Outgoing)
- Server: mail.example.com
- Port: 587
- Security: STARTTLS

## Managing Email Accounts

### Add Account
```bash
docker exec -it mailserver setup email add user@example.com password
```

### Delete Account
```bash
docker exec -it mailserver setup email del user@example.com
```

### Update Password
```bash
docker exec -it mailserver setup email update user@example.com new-password
```

### List Accounts
```bash
docker exec -it mailserver setup email list
```

## Managing Aliases

### Add Alias
```bash
docker exec -it mailserver setup alias add alias@example.com user@example.com
```

### Delete Alias
```bash
docker exec -it mailserver setup alias del alias@example.com user@example.com
```

## Troubleshooting

### Check Logs
```bash
# Mail server logs
docker logs mailserver

# Roundcube logs
docker logs roundcube

# Rspamd logs
docker logs rspamd
```

### Test SMTP
```bash
docker exec -it mailserver nc localhost 25
```

### Test IMAP
```bash
docker exec -it mailserver nc localhost 143
```

### Verify DNS Records
```bash
# MX Record
dig MX example.com

# SPF Record
dig TXT example.com | grep spf

# DKIM Record
dig TXT mail._domainkey.example.com

# DMARC Record
dig TXT _dmarc.example.com
```

## Security Best Practices

1. **Use Strong Passwords**: Always use complex passwords for email accounts
2. **Enable Fail2ban**: Already enabled in the template
3. **Regular Updates**: Keep the containers updated
4. **SSL/TLS Only**: Disable non-encrypted connections
5. **SPF/DKIM/DMARC**: Properly configure all email authentication methods
6. **Firewall**: Only open required ports
7. **Backups**: Regularly backup mail data volumes

## Port Mapping

| Port | Service | Description |
|------|---------|-------------|
| 25   | SMTP    | Mail transfer (often blocked by ISPs) |
| 143  | IMAP    | Mail retrieval (non-encrypted) |
| 465  | SMTPS   | Mail submission (SSL/TLS) |
| 587  | Submission | Mail submission (STARTTLS) |
| 993  | IMAPS   | Mail retrieval (SSL/TLS) |
| 8080 | Roundcube | Webmail interface |
| 11334 | Rspamd | Spam filter UI |

## Volumes

- `mail-data`: Email storage
- `mail-state`: Server state and configuration
- `mail-logs`: Mail server logs
- `mail-config`: Additional configuration files
- `roundcube-data`: Webmail data
- `roundcube-db-data`: Database for webmail
- `rspamd-data`: Spam filter data
- `redis-data`: Redis cache

## Support

For issues and questions:
- Docker Mailserver: https://docker-mailserver.github.io
- Roundcube: https://roundcube.net/support
- Rspamd: https://rspamd.com/doc/
