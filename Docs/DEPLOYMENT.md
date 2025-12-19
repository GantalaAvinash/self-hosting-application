# Dokploy Deployment Guide with Email Services

This guide explains how to deploy your custom Dokploy version with full email server capabilities to a production server.

## 🚀 Quick Deploy (Single Command)

### Option 1: Complete Deployment (Recommended) ⭐

**Deploys everything in one go: Core services + Email module + Traefik**

```bash
# Download and run the complete deployment script
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/dokploy/main/deploy-complete.sh | sudo bash
```

Or if you have the script locally:

```bash
sudo bash deploy-complete.sh
```

**What it does:**
- ✅ Checks system requirements
- ✅ Installs Docker (if needed)
- ✅ Creates all directories
- ✅ Generates secure passwords
- ✅ Deploys PostgreSQL, Redis, Dokploy, Traefik
- ✅ Sets up mail server (optional)
- ✅ Runs database migrations automatically
- ✅ Performs health checks
- ✅ Displays access information

### Option 2: Basic Deployment

```bash
# Download and run the basic deployment script
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/dokploy/main/deploy.sh | sudo bash
```

Or if you have the script locally:

```bash
sudo bash deploy.sh
```

### Option 3: Using Docker Compose

```bash
# Copy environment file
cp .env.production.example .env.production
# Edit .env.production with your values

# Deploy using docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

## 📋 Prerequisites

### Server Requirements
- **OS**: Ubuntu 20.04+, Debian 10+, CentOS 8+, Fedora 40+
- **RAM**: Minimum 2GB (4GB recommended)
- **Disk**: Minimum 30GB free space
- **CPU**: 1 core minimum (2+ recommended)

### Required Ports
The following ports must be available:
- **80**: HTTP traffic (Traefik)
- **443**: HTTPS traffic (Traefik)
- **3000**: Dokploy web interface
- **25**: SMTP (incoming mail)
- **143**: IMAP (mail client access)
- **465**: SMTPS (secure SMTP)
- **587**: Mail submission
- **993**: IMAPS (secure IMAP)

### Domain Requirements (Optional but Recommended)
- A domain name for Dokploy panel (e.g., `dokploy.example.com`)
- A subdomain for webmail (e.g., `webmail.example.com`)
- A subdomain for mail server (e.g., `mail.example.com`)

## 📦 What Gets Deployed

The deployment script will install and configure:

### Core Services
- **Dokploy**: Main application (port 3000)
- **Traefik**: Reverse proxy and load balancer
- **PostgreSQL**: Database for Dokploy
- **Redis**: Cache and session storage

### Email Services
- **docker-mailserver**: Full-featured mail server (Postfix + Dovecot)
- **Roundcube**: Web-based email client
- **Rspamd**: Spam filtering and email protection
- **MySQL**: Database for Roundcube
- **Redis**: Cache for mail services

## 🛠️ Installation Steps

### 1. Prepare Your Server

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install curl if not present
sudo apt install -y curl

# Ensure ports are not in use
sudo lsof -i :80,443,3000,25,143,465,587,993
```

### 2. Run Deployment Script

```bash
# Download and run the deployment script
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/dokploy/main/deploy.sh | sudo bash
```

The script will:
1. ✅ Check system requirements
2. ✅ Install Docker (if not present)
3. ✅ Create network and directories
4. ✅ Pull all required Docker images
5. ✅ Generate secure passwords
6. ✅ Configure Traefik reverse proxy
7. ✅ Generate SSL certificates for mail server
8. ✅ Deploy all services via Docker Compose
9. ✅ Display access information

### 3. Access Dokploy

After deployment completes (takes ~2-3 minutes):

```
Access Dokploy at: http://YOUR_SERVER_IP:3000
```

Complete the initial setup:
1. Create admin account
2. Set organization details
3. Configure email settings

## 📧 Email Configuration

### 1. Configure DNS Records

Add these DNS records for your domain (replace with your values):

#### A Records
```
mail.example.com    A    YOUR_SERVER_IP
webmail.example.com A    YOUR_SERVER_IP
```

#### MX Record
```
example.com         MX   10 mail.example.com
```

#### SPF Record
```
example.com         TXT  "v=spf1 mx ~all"
```

#### DMARC Record
```
_dmarc.example.com  TXT  "v=DMARC1; p=quarantine; rua=mailto:postmaster@example.com"
```

#### DKIM Record
Generate DKIM in Dokploy UI, then add:
```
mail._domainkey.example.com  TXT  "YOUR_DKIM_PUBLIC_KEY"
```

### 2. Create Email Domain in Dokploy

1. Navigate to **Settings > Email**
2. Click **Add Domain**
3. Fill in:
   - **Domain**: `example.com`
   - **Webmail URL**: `https://webmail.example.com`
   - **Mail Server IP**: `YOUR_SERVER_IP`
4. Generate DKIM keys
5. Verify DNS records

### 3. Create Email Accounts

1. Select your domain
2. Click **Add Account**
3. Enter username and password
4. Account will be created on mail server

### 4. Access Webmail

```
Webmail URL: http://YOUR_SERVER_IP/webmail
or: https://webmail.example.com (after DNS setup)
```

## 🔒 Security Configuration

### Enable HTTPS

1. **Update Traefik config** to use your domain:
   ```bash
   sudo nano /etc/dokploy/traefik/traefik.yml
   ```
   
   Update email to receive Let's Encrypt notifications:
   ```yaml
   certificatesResolvers:
     letsencrypt:
       acme:
         email: admin@example.com  # Change this
   ```

2. **Configure domain in Dokploy**:
   - Go to Settings > Domains
   - Add your domain with SSL/TLS (Let's Encrypt)

3. **Disable port 3000 access** (after HTTPS is working):
   ```bash
   docker service update --publish-rm "published=3000,target=3000,mode=host" dokploy
   ```

### Firewall Configuration

```bash
# Allow required ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 25/tcp   # SMTP
sudo ufw allow 143/tcp  # IMAP
sudo ufw allow 465/tcp  # SMTPS
sudo ufw allow 587/tcp  # Submission
sudo ufw allow 993/tcp  # IMAPS
sudo ufw enable
```

## 📊 Managing Your Deployment

### View Service Status
```bash
docker ps --filter "name=dokploy"
```

### View Logs
```bash
# All services
docker-compose -f /etc/dokploy/docker-compose.yml logs -f

# Specific service
docker logs dokploy -f
docker logs dokploy-mailserver -f
docker logs dokploy-roundcube -f
```

### Restart Services
```bash
# All services
docker-compose -f /etc/dokploy/docker-compose.yml restart

# Specific service
docker restart dokploy
docker restart dokploy-mailserver
```

### Stop Services
```bash
docker-compose -f /etc/dokploy/docker-compose.yml down
```

### Start Services
```bash
docker-compose -f /etc/dokploy/docker-compose.yml up -d
```

### Update Dokploy
```bash
cd /etc/dokploy

# Create backup before updating
sudo bash rollback.sh --backup

# Pull latest image
docker-compose pull dokploy
docker-compose up -d dokploy

# Verify deployment
docker logs dokploy -f
```

### Rollback to Previous Version
```bash
# List available backups
sudo bash rollback.sh --list

# Rollback database
sudo bash rollback.sh --db /etc/dokploy/backups/backup-YYYYMMDD-HHMMSS.sql

# Rollback to specific image version
sudo bash rollback.sh --image v0.26.1
```

## 🔑 Credentials

All generated passwords are stored in:
```bash
/etc/dokploy/.env
```

To view:
```bash
sudo cat /etc/dokploy/.env
```

Contains:
- PostgreSQL password
- Redis password
- Mail database passwords
- JWT secret
- Rspamd password
- **MAILSERVER_CONTAINER_NAME** (email module - default: "mailserver")
- **MAILSERVER_CONTAINER_NAME** (email module - default: "mailserver")

## 🐛 Troubleshooting

### Dokploy won't start
```bash
# Check logs
docker logs dokploy

# Check database connection
docker exec dokploy-postgres pg_isready -U dokploy

# Restart service
docker restart dokploy
```

### Mail server issues
```bash
# Check mail server logs
docker logs dokploy-mailserver

# Check mail server status
docker exec dokploy-mailserver supervisorctl status

# Test SMTP connection
telnet YOUR_SERVER_IP 25
```

### Roundcube not accessible
```bash
# Check Roundcube logs
docker logs dokploy-roundcube

# Check database connection
docker exec dokploy-roundcube-db mysql -u roundcube -p roundcube

# Restart Roundcube
docker restart dokploy-roundcube
```

### DNS not verifying
```bash
# Check DNS records from server
dig MX example.com
dig TXT example.com
dig A mail.example.com

# Check from external DNS
nslookup -type=MX example.com 8.8.8.8
```

## 📚 File Locations

```
/etc/dokploy/
├── docker-compose.yml          # Main compose file (or docker-compose.prod.yml)
├── .env                        # Environment variables
├── backups/                    # Database backups (created by rollback.sh)
├── traefik/
│   ├── traefik.yml            # Traefik configuration
│   └── dynamic/               # Dynamic configs
└── mail-server/
    └── ssl/                   # SSL certificates
        ├── cert.pem
        └── key.pem

/var/lib/dokploy/
├── postgres/                  # PostgreSQL data
└── redis/                     # Redis data
```

## 🔄 Database Migrations

Database migrations are **automatically run** when the Dokploy container starts. The startup script will:
1. Run all pending migrations from the `drizzle/` folder
2. Start the application
3. Health check verifies the application is running

**Manual Migration** (if needed):
```bash
docker exec dokploy pnpm run migration:run
```

**Email Module Migrations**:
The following migrations are automatically applied:
- `0135_add_email_permissions.sql` - Email permissions
- `0136_email_deliverability.sql` - Deliverability tables

## 🔄 Backup and Restore

### Backup
```bash
# Create backup directory
mkdir -p ~/dokploy-backup

# Backup PostgreSQL database
docker exec dokploy-postgres pg_dump -U dokploy dokploy > ~/dokploy-backup/dokploy-$(date +%Y%m%d).sql

# Backup mail data
sudo tar -czf ~/dokploy-backup/mail-data-$(date +%Y%m%d).tar.gz /var/lib/docker/volumes/dokploy_mail-data

# Backup environment file
sudo cp /etc/dokploy/.env ~/dokploy-backup/.env.backup
```

### Restore
```bash
# Restore database
cat ~/dokploy-backup/dokploy-20231215.sql | docker exec -i dokploy-postgres psql -U dokploy -d dokploy

# Restore mail data
sudo tar -xzf ~/dokploy-backup/mail-data-20231215.tar.gz -C /
```

## 🆘 Support

If you encounter issues:

1. Check logs: `docker-compose -f /etc/dokploy/docker-compose.yml logs`
2. Check GitHub issues: https://github.com/Dokploy/dokploy/issues
3. Join Discord: https://discord.gg/2tBnJ3jDJc

## 📝 License

This deployment is based on Dokploy, which is open source under the Apache License 2.0.
