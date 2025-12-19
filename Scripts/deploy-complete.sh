#!/bin/bash

# Dokploy Complete Deployment Script
# Deploys entire application with all features including email module

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOKPLOY_DIR="/etc/dokploy"
DOCKER_COMPOSE_FILE="${DOKPLOY_DIR}/docker-compose.yml"
ENV_FILE="${DOKPLOY_DIR}/.env"
MAIL_SERVER_DIR="${DOKPLOY_DIR}/mail-server"
TRAEFIK_DIR="${DOKPLOY_DIR}/traefik"

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

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run as root or with sudo"
        exit 1
    fi
}

check_system() {
    print_step "Checking system requirements..."
    
    # Check OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        print_info "OS: $PRETTY_NAME"
    fi
    
    # Check RAM
    RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$RAM_GB" -lt 2 ]; then
        print_warn "System has less than 2GB RAM (found: ${RAM_GB}GB). 4GB+ recommended."
    else
        print_info "RAM: ${RAM_GB}GB"
    fi
    
    # Check disk space
    DISK_GB=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$DISK_GB" -lt 30 ]; then
        print_warn "Less than 30GB free disk space (found: ${DISK_GB}GB)"
    else
        print_info "Disk space: ${DISK_GB}GB available"
    fi
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

check_ports() {
    print_step "Checking required ports..."
    PORTS=(80 443 3000 25 143 465 587 993)
    CONFLICTS=()
    
    for port in "${PORTS[@]}"; do
        if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; then
            CONFLICTS+=($port)
            print_warn "Port ${port} is already in use"
        fi
    done
    
    if [ ${#CONFLICTS[@]} -gt 0 ]; then
        print_warn "Ports in use: ${CONFLICTS[*]}"
        print_warn "You may need to stop conflicting services"
    else
        print_info "All required ports are available"
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
        cat > "${DOCKER_COMPOSE_FILE}" <<'EOF'
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
EOF
        print_info "Docker Compose file created"
    else
        print_info "Docker Compose file already exists"
    fi
}

setup_mail_server() {
    print_step "Setting up mail server..."
    
    # Copy mail server template
    if [ ! -f "${MAIL_SERVER_DIR}/docker-compose.yml" ]; then
        print_info "Setting up mail server configuration..."
        mkdir -p "${MAIL_SERVER_DIR}"
        
        # Copy mail server docker-compose
        if [ -f "templates/mail-server/docker-compose.yml" ]; then
            cp templates/mail-server/docker-compose.yml "${MAIL_SERVER_DIR}/docker-compose.yml"
            print_info "Mail server docker-compose copied"
        fi
        
        # Copy mail server env template
        if [ -f "templates/mail-server/mailserver.env" ]; then
            cp templates/mail-server/mailserver.env "${MAIL_SERVER_DIR}/mailserver.env"
            print_info "Mail server environment file copied"
            print_warn "⚠️  Update ${MAIL_SERVER_DIR}/mailserver.env with your domain settings"
        fi
        
        # Generate SSL certificates for mail server (self-signed for now)
        if [ ! -f "${MAIL_SERVER_DIR}/ssl/cert.pem" ]; then
            print_info "Generating self-signed SSL certificates for mail server..."
            mkdir -p "${MAIL_SERVER_DIR}/ssl"
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout "${MAIL_SERVER_DIR}/ssl/key.pem" \
                -out "${MAIL_SERVER_DIR}/ssl/cert.pem" \
                -subj "/C=US/ST=State/L=City/O=Organization/CN=mail.example.com" 2>/dev/null || true
            print_info "SSL certificates generated (self-signed)"
            print_warn "⚠️  Replace with proper SSL certificates for production"
        fi
    else
        print_info "Mail server configuration already exists"
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
    
    # Source environment file
    set -a
    [ -f "${ENV_FILE}" ] && source "${ENV_FILE}"
    set +a
    
    # Start services
    if docker compose version &> /dev/null 2>&1; then
        docker compose up -d postgres redis
    else
        docker-compose up -d postgres redis
    fi
    
    print_info "Waiting for database to be ready..."
    sleep 10
    
    # Wait for postgres to be healthy
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
    
    # Source environment file
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
    
    # Source environment file
    set -a
    [ -f "${ENV_FILE}" ] && source "${ENV_FILE}"
    set +a
    
    if docker compose version &> /dev/null 2>&1; then
        docker compose up -d traefik
    else
        docker-compose up -d traefik
    fi
}

start_mail_server() {
    print_step "Starting mail server (optional)..."
    
    if [ -f "${MAIL_SERVER_DIR}/docker-compose.yml" ]; then
        cd "${MAIL_SERVER_DIR}"
        
        # Source main env file for mail server vars
        set -a
        [ -f "${ENV_FILE}" ] && source "${ENV_FILE}"
        set +a
        
        if docker compose version &> /dev/null 2>&1; then
            docker compose up -d || print_warn "Mail server failed to start (check configuration)"
        else
            docker-compose up -d || print_warn "Mail server failed to start (check configuration)"
        fi
        
        print_info "Mail server started (if configuration is correct)"
    else
        print_warn "Mail server configuration not found, skipping"
        print_info "You can set up mail server later using templates/mail-server/"
    fi
}

health_check() {
    print_step "Performing health checks..."
    sleep 10
    
    # Check Dokploy
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        print_info "✅ Dokploy is healthy"
    else
        print_warn "⚠️  Dokploy health check failed (may still be starting)"
        print_info "Check logs: docker logs dokploy"
    fi
    
    # Check PostgreSQL
    if docker exec dokploy-postgres pg_isready -U dokploy > /dev/null 2>&1; then
        print_info "✅ PostgreSQL is healthy"
    else
        print_warn "⚠️  PostgreSQL health check failed"
    fi
    
    # Check Redis
    if docker exec dokploy-redis redis-cli ping > /dev/null 2>&1; then
        print_info "✅ Redis is healthy"
    else
        print_warn "⚠️  Redis health check failed"
    fi
    
    # Check Traefik
    if curl -f http://localhost:8080/api/rawdata > /dev/null 2>&1; then
        print_info "✅ Traefik is healthy"
    else
        print_warn "⚠️  Traefik health check failed"
    fi
    
    # Check mail server (if running)
    if docker ps --format '{{.Names}}' | grep -q "^mailserver$"; then
        if docker exec mailserver supervisorctl status > /dev/null 2>&1; then
            print_info "✅ Mail server is healthy"
        else
            print_warn "⚠️  Mail server health check failed"
        fi
    fi
}

display_summary() {
    print_info ""
    print_info "=========================================="
    print_info "🎉 Dokploy Deployment Complete!"
    print_info "=========================================="
    print_info ""
    print_info "📍 Access Points:"
    print_info "   Dokploy UI:    http://$(hostname -I | awk '{print $1}'):3000"
    print_info "   Traefik Dashboard: http://$(hostname -I | awk '{print $1}'):8080"
    print_info ""
    print_info "📁 Configuration:"
    print_info "   Directory:     ${DOKPLOY_DIR}"
    print_info "   Environment:   ${ENV_FILE}"
    print_info "   Compose File:  ${DOCKER_COMPOSE_FILE}"
    print_info ""
    print_info "📧 Email Module:"
    if docker ps --format '{{.Names}}' | grep -q "^mailserver$"; then
        print_info "   Mail Server:   ✅ Running"
        print_info "   Container:     mailserver"
    else
        print_info "   Mail Server:   ⚠️  Not started (configure and start manually)"
        print_info "   To start:       cd ${MAIL_SERVER_DIR} && docker compose up -d"
    fi
    print_info ""
    print_info "🔄 Next Steps:"
    print_info "   1. Complete initial setup in Dokploy UI"
    print_info "   2. Review and update ${ENV_FILE}"
    print_info "   3. Configure DNS records for your domain"
    print_info "   4. Set up mail server (if not already done)"
    print_info "   5. Configure SSL certificates in Traefik"
    print_info ""
    print_info "📚 Documentation:"
    print_info "   See DEPLOYMENT.md for detailed instructions"
    print_info ""
    print_info "🔍 Check Status:"
    print_info "   docker ps"
    print_info "   docker logs dokploy"
    print_info ""
    print_info "=========================================="
}

# Main execution
main() {
    print_info "🚀 Starting Dokploy Complete Deployment"
    print_info "=========================================="
    print_info ""
    
    check_root
    check_system
    check_docker
    check_docker_compose
    check_ports
    create_directories
    generate_env_file
    create_docker_network
    create_docker_compose
    setup_mail_server
    pull_images
    start_core_services
    start_dokploy
    start_traefik
    start_mail_server
    health_check
    display_summary
    
    print_info ""
    print_info "✅ Deployment completed successfully!"
}

# Run main function
main "$@"

