#!/bin/bash

# Dokploy Update and Deploy Script
# Connects to server, pulls latest code, rebuilds, and restarts services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

if [ $# -eq 0 ]; then
    print_error "Usage: $0 <ssh_connection_string>"
    print_info "Example: $0 root@20.193.140.177"
    exit 1
fi

SSH_STRING="$*"
DOKPLOY_DIR="/etc/dokploy"

print_info "🚀 Dokploy Update Script"
print_info "=========================================="
print_info "SSH Connection: ${SSH_STRING}"
print_info ""

# Test SSH connection
print_step "Testing SSH connection..."
if ! ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${SSH_STRING} "echo 'Connection successful'" 2>/dev/null; then
    print_error "❌ SSH connection failed"
    exit 1
fi
print_info "✅ SSH connection successful"
print_info ""

# Step 1: Navigate to dokploy directory and pull latest code
print_step "Step 1: Pulling latest code from Git..."
ssh -o StrictHostKeyChecking=no ${SSH_STRING} << 'ENDSSH'
cd /etc/dokploy || { echo "Directory /etc/dokploy not found. Is Dokploy deployed?"; exit 1; }
if [ -d ".git" ]; then
    echo "Pulling latest changes from Git..."
    git pull origin main || git pull origin master
    echo "✅ Code updated"
else
    echo "⚠️  Not a Git repository. Cloning fresh..."
    cd /tmp
    rm -rf dokploy
    git clone https://github.com/GantalaAvinash/self-hosting-application.git dokploy
    cd dokploy
    echo "✅ Repository cloned"
fi
ENDSSH

# Step 2: Rebuild and restart services
print_step "Step 2: Rebuilding and restarting services..."
ssh -o StrictHostKeyChecking=no ${SSH_STRING} << 'ENDSSH'
cd /etc/dokploy || cd /tmp/dokploy

# Check if docker-compose.prod.yml exists
if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
elif [ -f "docker-compose.yml" ]; then
    COMPOSE_FILE="docker-compose.yml"
else
    echo "⚠️  No docker-compose file found. Checking if services are running..."
    docker ps | grep dokploy || echo "No Dokploy containers found"
    exit 1
fi

echo "Using compose file: ${COMPOSE_FILE}"

# Stop services
echo "Stopping services..."
if docker compose version &> /dev/null 2>&1; then
    docker compose -f ${COMPOSE_FILE} down || true
else
    docker-compose -f ${COMPOSE_FILE} down || true
fi

# Rebuild and start
echo "Rebuilding and starting services..."
if docker compose version &> /dev/null 2>&1; then
    docker compose -f ${COMPOSE_FILE} build --no-cache dokploy || true
    docker compose -f ${COMPOSE_FILE} up -d --build
else
    docker-compose -f ${COMPOSE_FILE} build --no-cache dokploy || true
    docker-compose -f ${COMPOSE_FILE} up -d --build
fi

echo "✅ Services restarted"
ENDSSH

# Step 3: Wait for services to be ready
print_step "Step 3: Waiting for services to be ready..."
sleep 15

# Step 4: Health check with curl
print_step "Step 4: Performing health checks with curl..."

# Get server IP
SERVER_IP=$(ssh -o StrictHostKeyChecking=no ${SSH_STRING} "hostname -I | awk '{print \$1}'" 2>/dev/null || echo "20.193.140.177")

print_info ""
print_info "Testing endpoints:"
print_info ""

# Test 1: Health endpoint
print_step "Testing /api/health..."
ssh -o StrictHostKeyChecking=no ${SSH_STRING} "curl -s -o /dev/null -w 'HTTP Status: %{http_code}\n' http://localhost:3000/api/health || echo 'Health check failed'"

# Test 2: Email API endpoint (should return empty array, not error)
print_step "Testing email.getAllDomains (requires auth, but should not return 400)..."
ssh -o StrictHostKeyChecking=no ${SSH_STRING} "curl -s http://localhost:3000/api/trpc/email.getAllDomains 2>&1 | head -20 || echo 'Endpoint test completed'"

# Test 3: Check container status
print_step "Checking container status..."
ssh -o StrictHostKeyChecking=no ${SSH_STRING} << 'ENDSSH'
echo "Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "dokploy|postgres|redis|traefik" || echo "No Dokploy containers found"
ENDSSH

# Test 4: Check logs for errors
print_step "Checking recent logs for errors..."
ssh -o StrictHostKeyChecking=no ${SSH_STRING} << 'ENDSSH'
echo "Recent Dokploy logs (last 20 lines):"
docker logs dokploy --tail 20 2>&1 | tail -20 || echo "Could not fetch logs"
ENDSSH

print_info ""
print_info "=========================================="
print_info "✅ Update Complete!"
print_info "=========================================="
print_info ""
print_info "📍 Access Points:"
print_info "   Dokploy UI:    http://${SERVER_IP}:3000"
print_info "   Traefik Dashboard: http://${SERVER_IP}:8080"
print_info ""
print_info "🔍 To check logs:"
print_info "   ssh ${SSH_STRING} 'docker logs dokploy -f'"
print_info ""
print_info "🧪 To test with curl:"
print_info "   curl http://${SERVER_IP}:3000/api/health"
print_info ""
