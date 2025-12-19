# Remote Deployment Guide

**Date**: 2025-01-27  
**Status**: ✅ **READY**

---

## 🚀 Remote Deployment via SSH

Yes! I can connect to your server via SSH and deploy the complete application automatically.

---

## Quick Start

### Single Command Remote Deployment ✅

```bash
./deploy-remote.sh user@server.example.com
```

**That's it!** This will:
1. ✅ Connect to your server via SSH
2. ✅ Transfer the deployment script
3. ✅ Execute the complete deployment
4. ✅ Deploy all services automatically
5. ✅ Run database migrations
6. ✅ Perform health checks
7. ✅ Display access information

---

## Usage

### Basic Usage

```bash
./deploy-remote.sh user@server.example.com
```

### With SSH Key

```bash
./deploy-remote.sh -i ~/.ssh/id_rsa user@server.example.com
```

### With Custom Port

```bash
./deploy-remote.sh -p 2222 user@server.example.com
```

### With Multiple Options

```bash
./deploy-remote.sh -i ~/.ssh/id_rsa -p 2222 -o StrictHostKeyChecking=no user@server.example.com
```

---

## SSH Connection String Format

The script accepts any valid SSH connection string:

```
[ssh_options] user@hostname
```

### Examples

**Basic**:
```bash
./deploy-remote.sh root@192.168.1.100
```

**With SSH Key**:
```bash
./deploy-remote.sh -i ~/.ssh/my_key user@server.com
```

**With Port**:
```bash
./deploy-remote.sh -p 2222 user@server.com
```

**Full Example**:
```bash
./deploy-remote.sh -i ~/.ssh/id_rsa -p 2222 -o UserKnownHostsFile=/dev/null root@192.168.1.100
```

---

## Prerequisites

### On Your Local Machine

- ✅ SSH client installed
- ✅ SSH access to the remote server
- ✅ SSH key set up (or password authentication enabled)
- ✅ User has sudo privileges on remote server

### On Remote Server

- ✅ Ubuntu 20.04+, Debian 10+, CentOS 8+, or Fedora 40+
- ✅ Minimum 2GB RAM (4GB recommended)
- ✅ Minimum 30GB disk space
- ✅ Ports 80, 443, 3000, 25, 143, 465, 587, 993 available
- ✅ Internet connection (for pulling Docker images)

---

## What Gets Deployed

### Core Services ✅

- **Dokploy**: Main application (port 3000)
- **PostgreSQL**: Database
- **Redis**: Cache
- **Traefik**: Reverse proxy (ports 80, 443, 8080)

### Email Module ✅

- **Mail Server**: docker-mailserver
- **Roundcube**: Webmail
- **Rspamd**: Spam filtering
- **MySQL**: Roundcube database

### Features ✅

- ✅ Automatic database migrations
- ✅ Health checks on all services
- ✅ Secure password generation
- ✅ Complete directory structure
- ✅ Docker network setup

---

## Deployment Process

### Step 1: Run Remote Deployment Script

```bash
./deploy-remote.sh user@server.example.com
```

### Step 2: Confirm Deployment

The script will:
1. Test SSH connection
2. Get server information
3. Ask for confirmation
4. Transfer deployment script
5. Execute deployment remotely

### Step 3: Wait for Completion

**Time**: ~5-10 minutes

The script will:
- Install Docker (if needed)
- Pull Docker images
- Start all services
- Run migrations
- Perform health checks
- Display access information

### Step 4: Access Dokploy

After deployment, access Dokploy at:
```
http://YOUR_SERVER_IP:3000
```

---

## Security Considerations

### SSH Key Authentication (Recommended)

**Set up SSH key**:
```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# Copy public key to server
ssh-copy-id user@server.example.com

# Test connection
ssh user@server.example.com
```

**Use with deployment**:
```bash
./deploy-remote.sh -i ~/.ssh/id_rsa user@server.example.com
```

### Password Authentication

If using password authentication, you'll be prompted for the password during:
1. SSH connection test
2. Script transfer
3. Remote execution

### Sudo Privileges

The remote user must have sudo privileges. The script will:
- Check for root/sudo access
- Execute commands with `sudo` when needed

---

## Troubleshooting

### SSH Connection Failed

**Error**: `Connection refused` or `Permission denied`

**Solutions**:
1. Verify server is accessible: `ping server.example.com`
2. Check SSH service: `ssh -v user@server.example.com`
3. Verify SSH key: `ssh -i ~/.ssh/id_rsa user@server.example.com`
4. Check firewall rules
5. Verify SSH port (default: 22)

### Permission Denied

**Error**: `Permission denied (publickey)`

**Solutions**:
1. Set up SSH key authentication
2. Verify key permissions: `chmod 600 ~/.ssh/id_rsa`
3. Add key to SSH agent: `ssh-add ~/.ssh/id_rsa`
4. Check server's `~/.ssh/authorized_keys`

### Sudo Access Required

**Error**: `Please run as root or with sudo`

**Solutions**:
1. Use root user: `./deploy-remote.sh root@server.example.com`
2. Add user to sudoers: `usermod -aG sudo username`
3. Use sudo in SSH: `ssh -t user@server.com sudo bash /tmp/deploy-dokploy.sh`

### Deployment Fails

**Check logs**:
```bash
# SSH to server
ssh user@server.example.com

# View Dokploy logs
sudo docker logs dokploy -f

# View all service logs
cd /etc/dokploy
sudo docker compose logs -f
```

### Port Already in Use

**Error**: Port conflicts

**Solutions**:
1. Stop conflicting services
2. Change ports in docker-compose.yml
3. Check what's using ports: `sudo lsof -i :3000`

---

## Post-Deployment

### Verify Deployment

```bash
# SSH to server
ssh user@server.example.com

# Check running containers
sudo docker ps

# Check health
curl http://localhost:3000/api/health

# View logs
sudo docker logs dokploy -f
```

### Access Dokploy

1. Open browser: `http://YOUR_SERVER_IP:3000`
2. Complete initial setup
3. Create admin account
4. Configure organization

### Configure Email Module

1. Go to **Email Hosting** in Dokploy
2. Add your domain
3. Generate DKIM keys
4. Configure DNS records
5. Verify DNS
6. Create email accounts

---

## Advanced Usage

### Custom SSH Options

```bash
# Disable host key checking
./deploy-remote.sh -o StrictHostKeyChecking=no user@server.com

# Use specific SSH config
./deploy-remote.sh -F ~/.ssh/config user@server.com

# Verbose SSH output
./deploy-remote.sh -v user@server.com
```

### Non-Interactive Mode

For automation, you can modify the script to skip confirmation:

```bash
# Edit deploy-remote.sh
# Change: read -p "Continue? (yes/no): " confirm
# To: confirm="yes"
```

### Custom Deployment Directory

The script deploys to `/etc/dokploy` by default. To change:

1. Edit `deploy-remote.sh`
2. Change `DOKPLOY_DIR` variable
3. Or modify the remote script after transfer

---

## Example Session

```bash
$ ./deploy-remote.sh root@192.168.1.100

🚀 Dokploy Remote Deployment Tool
==========================================

SSH Connection: root@192.168.1.100

[INFO] SSH client is available
[STEP] Testing SSH connection...
[INFO] ✅ SSH connection successful
[STEP] Getting server information...
[INFO] Server: server.example.com (192.168.1.100)

⚠️  This will deploy Dokploy on the remote server:
   Server: root@192.168.1.100

This will:
  - Install Docker (if not present)
  - Create directories in /etc/dokploy
  - Deploy all services (PostgreSQL, Redis, Dokploy, Traefik)
  - Run database migrations
  - Start all services

Continue? (yes/no): yes

[STEP] Transferring deployment script to remote server...
[INFO] ✅ Script transferred successfully
[STEP] Executing deployment on remote server...
⚠️  This may take 5-10 minutes...

[STEP] Checking system requirements...
[INFO] OS: Ubuntu 22.04.3 LTS
[INFO] RAM: 4GB
[INFO] Disk space: 50GB available
...

[INFO] ✅ Deployment completed successfully!

==========================================
✅ Deployment Complete!
==========================================

Access Dokploy at: http://192.168.1.100:3000
```

---

## Summary

### ✅ **Yes, I Can Deploy Remotely!**

**Command**:
```bash
./deploy-remote.sh user@server.example.com
```

**What It Does**:
- ✅ Connects via SSH
- ✅ Transfers deployment script
- ✅ Executes complete deployment
- ✅ Deploys all services
- ✅ Runs migrations
- ✅ Performs health checks

**Time**: ~5-10 minutes  
**Effort**: Single command  
**Result**: Fully functional Dokploy on remote server

---

**Ready for Remote Deployment**: ✅ **YES**

**Just provide your SSH connection string!**

