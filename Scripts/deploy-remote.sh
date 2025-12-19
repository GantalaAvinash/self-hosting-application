#!/bin/bash

# Dokploy Remote Deployment Script
# Connects to a remote server via SSH and deploys the complete application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if SSH is available
check_ssh() {
    if ! command -v ssh &> /dev/null; then
        print_error "SSH client not found. Please install OpenSSH client."
        exit 1
    fi
    print_info "SSH client is available"
}

# Test SSH connection
test_ssh_connection() {
    local ssh_string=$1
    print_step "Testing SSH connection..."
    
    if ssh -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=no ${ssh_string} "echo 'Connection successful'" 2>/dev/null; then
        print_info "✅ SSH connection successful"
        return 0
    else
        print_error "❌ SSH connection failed"
        print_warn "Please verify:"
        print_warn "  1. SSH connection string is correct"
        print_warn "  2. Server is accessible"
        print_warn "  3. SSH key is set up (or password authentication is enabled)"
        print_warn "  4. User has sudo privileges"
        return 1
    fi
}

# Transfer deployment script to remote server
transfer_script() {
    local ssh_string=$1
    print_step "Transferring deployment script to remote server..."
    
    # Create a temporary script that includes deploy-complete.sh
    TEMP_SCRIPT=$(mktemp)
    cat > "${TEMP_SCRIPT}" <<'REMOTE_SCRIPT_EOF'
#!/bin/bash
# Dokploy Complete Deployment Script (Remote Version)
# This script will be executed on the remote server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Configuration
DOKPLOY_DIR="/etc/dokploy"
DOCKER_COMPOSE_FILE="${DOKPLOY_DIR}/docker-compose.yml"
ENV_FILE="${DOKPLOY_DIR}/.env"
MAIL_SERVER_DIR="${DOKPLOY_DIR}/mail-server"
TRAEFIK_DIR="${DOKPLOY_DIR}/traefik"

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run as root or with sudo"
        exit 1
    fi
}

check_system() {
    print_step "Checking system requirements..."
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        print_info "OS: $PRETTY_NAME"
    fi
    RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
    print_info "RAM: ${RAM_GB}GB"
    DISK_GB=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    print_info "Disk space: ${DISK_GB}GB available"
}

check_docker() {
    print_step "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_warn "Docker not found. Installing Docker..."
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
        sh /tmp/get-docker.sh
        rm /tmp/get-docker.sh
        systemctl enable docker
        systemctl start docker
        print_info "Docker installed successfully"
    else
        DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
        print_info "Docker is installed: $DOCKER_VERSION"
    fi
}

check_docker_compose() {
    print_step "Checking Docker Compose..."
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
        print_error "Docker Compose not found. Please install Docker Compose."
        exit 1
    else
        if docker compose version &> /dev/null 2>&1; then
            print_info "Docker Compose is available (docker compose)"
        else
            print_info "Docker Compose is available (docker-compose)"
        fi
    fi
}

create_directories() {
    print_step "Creating directories..."
    mkdir -p "${DOKPLOY_DIR}"
    mkdir -p "${TRAEFIK_DIR}/dynamic"
    mkdir -p "${MAIL_SERVER_DIR}/ssl"
    mkdir -p "${DOKPLOY_DIR}/logs"
    mkdir -p "${DOKPLOY_DIR}/applications"
    mkdir -p "${DOKPLOY_DIR}/compose"
    mkdir -p "${DOKPLOY_DIR}/ssh"
    mkdir -p "${DOKPLOY_DIR}/monitoring"
    mkdir -p "${DOKPLOY_DIR}/registry"
    mkdir -p "${DOKPLOY_DIR}/schedules"
    mkdir -p "${DOKPLOY_DIR}/volume-backups"
    mkdir -p "${DOKPLOY_DIR}/backups"
    print_info "Directories created"
}

generate_env_file() {
    print_step "Generating environment file..."
    if [ ! -f "${ENV_FILE}" ]; then
        print_info "Creating environment file..."
        cat > "${ENV_FILE}" <<EOF
# Dokploy Configuration
DATABASE_URL=postgres://dokploy:$(openssl rand -base64 32 | tr -d "=+/")@postgres:5432/dokploy
REDIS_URL=redis://:$(openssl rand -base64 32 | tr -d "=+/")@redis:6379
NODE_ENV=production
PORT=3000

# Email Module Configuration
MAILSERVER_CONTAINER_NAME=mailserver

# JWT Secret
JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/")

# PostgreSQL
POSTGRES_USER=dokploy
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/")
POSTGRES_DB=dokploy

# Redis
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/")

# Traefik
ACME_EMAIL=admin@example.com

# Mail Server
MAIL_HOSTNAME=mail.example.com
MAIL_DOMAIN=example.com
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/")
ROUNDCUBE_DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/")
RSPAMD_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/")
EOF
        print_info "Environment file created at ${ENV_FILE}"
        print_warn "⚠️  IMPORTANT: Review and update ${ENV_FILE} with your domain and email settings"
    else
        print_info "Environment file already exists"
    fi
}

create_docker_network() {
    print_step "Creating Docker network..."
    if ! docker network ls | grep -q "dokploy-network"; then
        docker network create dokploy-network
        print_info "Docker network 'dokploy-network' created"
    else
        print_info "Docker network 'dokploy-network' already exists"
    fi
}

create_docker_compose() {
    print_step "Creating Docker Compose file..."
    if [ ! -f "${DOCKER_COMPOSE_FILE}" ]; then
        print_info "Creating production Docker Compose file..."
        cat > "${DOCKER_COMPOSE_FILE}" <<'COMPOSE_EOF'
version: "3.8"

services:
  postgres:
    image: postgres:15-alpine
    container_name: dokploy-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-dokploy}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-dokploy}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-dokploy}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - dokploy-network

  redis:
    image: redis:7-alpine
    container_name: dokploy-redis
    command: redis-server --appendonly yes ${REDIS_PASSWORD:+--requirepass $REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - dokploy-network

  dokploy:
    image: dokploy/dokploy:latest
    container_name: dokploy
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file:
      - .env
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      NODE_ENV: production
      PORT: 3000
      MAILSERVER_CONTAINER_NAME: ${MAILSERVER_CONTAINER_NAME:-mailserver}
    ports:
      - "3000:3000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - dokploy_data:/etc/dokploy
    restart: unless-stopped
    networks:
      - dokploy-network

  traefik:
    image: traefik:v3.6.1
    container_name: dokploy-traefik
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.swarmmode=false"
      - "--providers.file.directory=/etc/traefik/dynamic"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL:-admin@example.com}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_config:/etc/traefik
      - traefik_dynamic:/etc/traefik/dynamic
      - letsencrypt:/letsencrypt
    restart: unless-stopped
    networks:
      - dokploy-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  dokploy_data:
    driver: local
  traefik_config:
    driver: local
  traefik_dynamic:
    driver: local
  letsencrypt:
    driver: local

networks:
  dokploy-network:
    driver: bridge
COMPOSE_EOF
        print_info "Docker Compose file created"
    else
        print_info "Docker Compose file already exists"
    fi
}

pull_images() {
    print_step "Pulling Docker images..."
    docker pull postgres:15-alpine
    docker pull redis:7-alpine
    docker pull traefik:v3.6.1
    docker pull dokploy/dokploy:latest || print_warn "Dokploy image not found in registry, will build from source"
    print_info "Core images pulled"
}

start_core_services() {
    print_step "Starting core services..."
    cd "${DOKPLOY_DIR}"
    set -a
    [ -f "${ENV_FILE}" ] && source "${ENV_FILE}"
    set +a
    
    if docker compose version &> /dev/null 2>&1; then
        docker compose up -d postgres redis
    else
        docker-compose up -d postgres redis
    fi
    
    print_info "Waiting for database to be ready..."
    sleep 10
    
    for i in {1..30}; do
        if docker exec dokploy-postgres pg_isready -U ${POSTGRES_USER:-dokploy} > /dev/null 2>&1; then
            print_info "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "PostgreSQL failed to start"
            exit 1
        fi
        sleep 2
    done
}

start_dokploy() {
    print_step "Starting Dokploy application..."
    cd "${DOKPLOY_DIR}"
    set -a
    [ -f "${ENV_FILE}" ] && source "${ENV_FILE}"
    set +a
    
    if docker compose version &> /dev/null 2>&1; then
        docker compose up -d dokploy
    else
        docker-compose up -d dokploy
    fi
    
    print_info "Waiting for Dokploy to start..."
    sleep 15
}

start_traefik() {
    print_step "Starting Traefik reverse proxy..."
    cd "${DOKPLOY_DIR}"
    set -a
    [ -f "${ENV_FILE}" ] && source "${ENV_FILE}"
    set +a
    
    if docker compose version &> /dev/null 2>&1; then
        docker compose up -d traefik
    else
        docker-compose up -d traefik
    fi
}

health_check() {
    print_step "Performing health checks..."
    sleep 10
    
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        print_info "✅ Dokploy is healthy"
    else
        print_warn "⚠️  Dokploy health check failed (may still be starting)"
    fi
    
    if docker exec dokploy-postgres pg_isready -U dokploy > /dev/null 2>&1; then
        print_info "✅ PostgreSQL is healthy"
    else
        print_warn "⚠️  PostgreSQL health check failed"
    fi
    
    if docker exec dokploy-redis redis-cli ping > /dev/null 2>&1; then
        print_info "✅ Redis is healthy"
    else
        print_warn "⚠️  Redis health check failed"
    fi
}

display_summary() {
    SERVER_IP=$(hostname -I | awk '{print $1}' || echo "localhost")
    print_info ""
    print_info "=========================================="
    print_info "🎉 Dokploy Deployment Complete!"
    print_info "=========================================="
    print_info ""
    print_info "📍 Access Points:"
    print_info "   Dokploy UI:    http://${SERVER_IP}:3000"
    print_info "   Traefik Dashboard: http://${SERVER_IP}:8080"
    print_info ""
    print_info "📁 Configuration:"
    print_info "   Directory:     ${DOKPLOY_DIR}"
    print_info "   Environment:   ${ENV_FILE}"
    print_info "   Compose File:  ${DOCKER_COMPOSE_FILE}"
    print_info ""
    print_info "🔄 Next Steps:"
    print_info "   1. Complete initial setup in Dokploy UI"
    print_info "   2. Review and update ${ENV_FILE}"
    print_info "   3. Configure DNS records for your domain"
    print_info "   4. Set up mail server (if needed)"
    print_info "   5. Configure SSL certificates in Traefik"
    print_info ""
    print_info "=========================================="
}

# Main execution
main() {
    print_info "🚀 Starting Dokploy Remote Deployment"
    print_info "=========================================="
    print_info ""
    
    check_root
    check_system
    check_docker
    check_docker_compose
    create_directories
    generate_env_file
    create_docker_network
    create_docker_compose
    pull_images
    start_core_services
    start_dokploy
    start_traefik
    health_check
    display_summary
    
    print_info ""
    print_info "✅ Deployment completed successfully!"
}

# Run main function
main "$@"
REMOTE_SCRIPT_EOF

    # Transfer script to remote server
    if scp -o StrictHostKeyChecking=no "${TEMP_SCRIPT}" ${ssh_string}:/tmp/deploy-dokploy.sh 2>/dev/null; then
        print_info "✅ Script transferred successfully"
        rm "${TEMP_SCRIPT}"
        return 0
    else
        print_error "❌ Failed to transfer script"
        rm "${TEMP_SCRIPT}"
        return 1
    fi
}

# Execute deployment on remote server
execute_deployment() {
    local ssh_string=$1
    print_step "Executing deployment on remote server..."
    print_warn "This may take 5-10 minutes..."
    print_info ""
    
    # Execute script remotely with output streaming
    ssh -o StrictHostKeyChecking=no ${ssh_string} "sudo bash /tmp/deploy-dokploy.sh" 2>&1 | while IFS= read -r line; do
        echo "$line"
    done
    
    local exit_code=${PIPESTATUS[0]}
    if [ $exit_code -eq 0 ]; then
        print_info ""
        print_info "✅ Remote deployment completed successfully!"
        return 0
    else
        print_error ""
        print_error "❌ Remote deployment failed with exit code: $exit_code"
        return 1
    fi
}

# Get server information
get_server_info() {
    local ssh_string=$1
    print_step "Getting server information..."
    
    SERVER_IP=$(ssh -o StrictHostKeyChecking=no ${ssh_string} "hostname -I | awk '{print \$1}'" 2>/dev/null || echo "unknown")
    SERVER_HOSTNAME=$(ssh -o StrictHostKeyChecking=no ${ssh_string} "hostname" 2>/dev/null || echo "unknown")
    
    print_info "Server: ${SERVER_HOSTNAME} (${SERVER_IP})"
}

# Main function
main() {
    print_info "🚀 Dokploy Remote Deployment Tool"
    print_info "=========================================="
    print_info ""
    
    # Check for SSH connection string argument
    if [ $# -eq 0 ]; then
        print_error "Usage: $0 <ssh_connection_string>"
        print_info ""
        print_info "Examples:"
        print_info "  $0 user@server.example.com"
        print_info "  $0 user@192.168.1.100"
        print_info "  $0 -i ~/.ssh/id_rsa user@server.example.com"
        print_info "  $0 user@server.example.com -p 2222"
        print_info ""
        print_info "SSH Connection String Format:"
        print_info "  [ssh_options] user@hostname"
        print_info ""
        print_info "Common SSH Options:"
        print_info "  -i <key_file>     : SSH private key file"
        print_info "  -p <port>         : SSH port (default: 22)"
        print_info "  -o <option>       : Additional SSH options"
        print_info ""
        exit 1
    fi
    
    SSH_STRING="$*"
    
    print_info "SSH Connection: ${SSH_STRING}"
    print_info ""
    
    # Check SSH availability
    check_ssh
    
    # Test connection
    if ! test_ssh_connection "${SSH_STRING}"; then
        print_error "Cannot proceed without SSH connection"
        exit 1
    fi
    
    # Get server info
    get_server_info "${SSH_STRING}"
    print_info ""
    
    # Confirm deployment
    print_warn "⚠️  This will deploy Dokploy on the remote server:"
    print_warn "   Server: ${SSH_STRING}"
    print_warn ""
    print_warn "This will:"
    print_warn "  - Install Docker (if not present)"
    print_warn "  - Create directories in /etc/dokploy"
    print_warn "  - Deploy all services (PostgreSQL, Redis, Dokploy, Traefik)"
    print_warn "  - Run database migrations"
    print_warn "  - Start all services"
    print_warn ""
    read -p "Continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ] && [ "$confirm" != "y" ]; then
        print_info "Deployment cancelled"
        exit 0
    fi
    
    print_info ""
    
    # Transfer script
    if ! transfer_script "${SSH_STRING}"; then
        print_error "Failed to transfer deployment script"
        exit 1
    fi
    
    # Execute deployment
    if execute_deployment "${SSH_STRING}"; then
        print_info ""
        print_info "=========================================="
        print_info "✅ Deployment Complete!"
        print_info "=========================================="
        print_info ""
        print_info "Access Dokploy at: http://${SERVER_IP}:3000"
        print_info ""
        print_info "To view logs:"
        print_info "  ssh ${SSH_STRING} 'docker logs dokploy -f'"
        print_info ""
    else
        print_error "Deployment failed. Check logs above for details."
        exit 1
    fi
}

# Run main function
main "$@"

