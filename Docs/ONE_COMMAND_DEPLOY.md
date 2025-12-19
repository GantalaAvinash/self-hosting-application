# One-Command Deployment Guide

**Date**: 2025-01-27  
**Status**: ✅ **READY**

---

## 🚀 Deploy Everything in One Command

Yes! You can now deploy the **entire Dokploy application with all features** in a single command.

---

## Quick Start

### Single Command Deployment ✅

```bash
sudo bash deploy-complete.sh
```

**That's it!** This single command will:

1. ✅ Check system requirements
2. ✅ Install Docker (if needed)
3. ✅ Create all directories
4. ✅ Generate secure passwords
5. ✅ Deploy all core services:
   - PostgreSQL database
   - Redis cache
   - Dokploy application
   - Traefik reverse proxy
6. ✅ Set up mail server (optional)
7. ✅ Run database migrations automatically
8. ✅ Perform health checks
9. ✅ Display access information

---

## What Gets Deployed

### Core Services ✅

- **Dokploy**: Main application (port 3000)
- **PostgreSQL**: Database (port 5432)
- **Redis**: Cache (port 6379)
- **Traefik**: Reverse proxy (ports 80, 443, 8080)

### Email Module ✅

- **Mail Server**: docker-mailserver (ports 25, 143, 465, 587, 993)
- **Roundcube**: Webmail interface (port 8080)
- **Rspamd**: Spam filtering
- **MySQL**: Roundcube database

### Features Included ✅

- ✅ **Automatic Database Migrations**
  - All migrations run automatically
  - Email module migrations included (0135, 0136)
  
- ✅ **Health Checks**
  - All services monitored
  - Automatic restart on failure
  
- ✅ **Email Module**
  - Full email hosting capabilities
  - Deliverability features
  - Reputation monitoring
  - Bounce/complaint handling

---

## Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04+, Debian 10+, CentOS 8+, Fedora 40+
- **RAM**: Minimum 2GB (4GB recommended)
- **Disk**: Minimum 30GB free space
- **CPU**: 1 core minimum (2+ recommended)

### Required Ports

The following ports must be available:
- **80**: HTTP (Traefik)
- **443**: HTTPS (Traefik)
- **3000**: Dokploy web interface
- **8080**: Traefik dashboard / Roundcube webmail
- **25**: SMTP (mail)
- **143**: IMAP (mail)
- **465**: SMTPS (mail)
- **587**: Mail submission
- **993**: IMAPS (mail)

---

## Deployment Process

### Step 1: Run Deployment Script

```bash
sudo bash deploy-complete.sh
```

### Step 2: Wait for Completion

The script will:
- Check requirements (~30 seconds)
- Pull images (~2-5 minutes depending on connection)
- Start services (~1-2 minutes)
- Run migrations (~30 seconds)
- Health checks (~30 seconds)

**Total time**: ~5-10 minutes

### Step 3: Access Dokploy

After deployment completes:

```
Access Dokploy at: http://YOUR_SERVER_IP:3000
```

### Step 4: Complete Setup

1. Create admin account in Dokploy UI
2. Set organization details
3. Configure email domain (if using email module)
4. Set up DNS records

---

## Post-Deployment Configuration

### 1. Review Environment File

```bash
sudo cat /etc/dokploy/.env
```

**Important variables to update**:
- `ACME_EMAIL` - Email for Let's Encrypt certificates
- `MAIL_HOSTNAME` - Mail server hostname
- `MAIL_DOMAIN` - Your email domain

### 2. Configure DNS Records

Add these DNS records for your domain:

**A Records**:
```
mail.example.com    A    YOUR_SERVER_IP
webmail.example.com A   YOUR_SERVER_IP
```

**MX Record**:
```
example.com    MX    10 mail.example.com
```

**SPF Record**:
```
example.com    TXT   "v=spf1 mx ~all"
```

**DMARC Record**:
```
_dmarc.example.com  TXT  "v=DMARC1; p=quarantine; rua=mailto:postmaster@example.com"
```

**DKIM Record** (generate in Dokploy UI first):
```
mail._domainkey.example.com  TXT  "YOUR_DKIM_PUBLIC_KEY"
```

### 3. Start Mail Server (if not auto-started)

```bash
cd /etc/dokploy/mail-server
# Update mailserver.env with your domain
docker compose up -d
```

---

## Verification

### Check All Services

```bash
# View all running containers
docker ps

# Check Dokploy health
curl http://localhost:3000/api/health

# Check mail server health (if running)
curl http://localhost:3000/api/email/checkMailServerHealth
```

### View Logs

```bash
# Dokploy logs
docker logs dokploy -f

# Mail server logs
docker logs mailserver -f

# All services
cd /etc/dokploy
docker compose logs -f
```

---

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker logs dokploy
docker logs dokploy-postgres
docker logs dokploy-redis

# Restart services
cd /etc/dokploy
docker compose restart
```

### Migrations Not Running

Migrations run automatically, but you can verify:

```bash
# Check migration logs
docker logs dokploy | grep -i migration

# Run manually if needed
docker exec dokploy pnpm run migration:run
```

### Mail Server Issues

```bash
# Check mail server status
docker ps | grep mailserver

# Check mail server logs
docker logs mailserver

# Restart mail server
docker restart mailserver
```

### Port Conflicts

```bash
# Check what's using ports
sudo lsof -i :3000
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services
sudo systemctl stop apache2  # if using Apache
sudo systemctl stop nginx     # if using Nginx
```

---

## What's Included

### ✅ All Features

- ✅ **Core Application**: Full Dokploy functionality
- ✅ **Email Hosting**: Complete email module
- ✅ **Email Deliverability**: All deliverability features
  - Bounce management
  - Complaint handling
  - Suppression lists
  - Rate limiting
  - Reputation monitoring
- ✅ **Database**: PostgreSQL with automatic migrations
- ✅ **Cache**: Redis for performance
- ✅ **Reverse Proxy**: Traefik with SSL support
- ✅ **Webmail**: Roundcube interface
- ✅ **Spam Protection**: Rspamd filtering

### ✅ All UI Components

- ✅ Email domain management
- ✅ Email account management
- ✅ Email forward management
- ✅ Email alias management
- ✅ Reputation dashboard
- ✅ Bounce management
- ✅ Complaint management
- ✅ Suppression list
- ✅ Rate limit monitoring
- ✅ DNS records display
- ✅ Account connection info
- ✅ Mail server health

---

## Environment Variables

All environment variables are automatically generated in `/etc/dokploy/.env`:

**Core**:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - JWT signing secret

**Email Module**:
- `MAILSERVER_CONTAINER_NAME` - Mail server container (default: "mailserver")

**Mail Server**:
- `MAIL_HOSTNAME` - Mail server hostname
- `MAIL_DOMAIN` - Email domain
- `ROUNDCUBE_DB_PASSWORD` - Roundcube database password
- `RSPAMD_PASSWORD` - Rspamd password

**Review and update** `/etc/dokploy/.env` after deployment.

---

## Next Steps After Deployment

### 1. Initial Setup

1. Access Dokploy: `http://YOUR_SERVER_IP:3000`
2. Create admin account
3. Complete organization setup

### 2. Email Module Setup

1. Go to **Email Hosting** in Dokploy
2. Click **Add Domain**
3. Enter your domain
4. Generate DKIM keys
5. Add DNS records (see above)
6. Verify DNS records
7. Create email accounts

### 3. SSL/HTTPS Setup

1. Update `ACME_EMAIL` in `/etc/dokploy/.env`
2. Configure domain in Traefik
3. SSL certificates will be auto-generated

### 4. Security Hardening

1. Set up firewall rules
2. Disable port 3000 after HTTPS is working
3. Review and update passwords
4. Enable 2FA for admin accounts

---

## Rollback

If something goes wrong:

```bash
# List backups
sudo bash rollback.sh --list

# Rollback database
sudo bash rollback.sh --db /etc/dokploy/backups/backup-YYYYMMDD-HHMMSS.sql

# Rollback to previous image version
sudo bash rollback.sh --image v0.26.1
```

---

## Support

### Check Status

```bash
# All services
docker ps

# Service health
curl http://localhost:3000/api/health

# Service logs
docker logs dokploy -f
```

### Common Issues

See `DEPLOYMENT.md` for detailed troubleshooting.

---

## Summary

### ✅ **Yes, You Can Deploy Everything in One Command!**

```bash
sudo bash deploy-complete.sh
```

**This single command deploys**:
- ✅ Core Dokploy application
- ✅ PostgreSQL database
- ✅ Redis cache
- ✅ Traefik reverse proxy
- ✅ Mail server (optional)
- ✅ All email module features
- ✅ All deliverability features
- ✅ All UI components
- ✅ Automatic migrations
- ✅ Health checks

**Time**: ~5-10 minutes  
**Effort**: Single command  
**Result**: Fully functional Dokploy with email hosting

---

**Ready to Deploy**: ✅ **YES**

