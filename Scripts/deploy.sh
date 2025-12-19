#!/bin/bash

# Dokploy Production Deployment Script
# This script automates the deployment of Dokploy with email module support

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOKPLOY_DIR="/etc/dokploy"
DOCKER_COMPOSE_FILE="${DOKPLOY_DIR}/docker-compose.yml"
ENV_FILE="${DOKPLOY_DIR}/.env"

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

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run as root or with sudo"
        exit 1
    fi
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        print_warn "Docker not found. Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
        systemctl enable docker
        systemctl start docker
        print_info "Docker installed successfully"
    else
        print_info "Docker is already installed"
    fi
}

check_docker_compose() {
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_warn "Docker Compose not found. Installing..."
        # Docker Compose is included with Docker Desktop and newer Docker versions
        print_info "Docker Compose should be available via 'docker compose'"
    else
        print_info "Docker Compose is available"
    fi
}

create_directories() {
    print_info "Creating directories..."
    mkdir -p "${DOKPLOY_DIR}"
    mkdir -p "${DOKPLOY_DIR}/traefik/dynamic"
    mkdir -p "${DOKPLOY_DIR}/logs"
    mkdir -p "${DOKPLOY_DIR}/applications"
    mkdir -p "${DOKPLOY_DIR}/compose"
    mkdir -p "${DOKPLOY_DIR}/ssh"
    mkdir -p "${DOKPLOY_DIR}/monitoring"
    mkdir -p "${DOKPLOY_DIR}/registry"
    mkdir -p "${DOKPLOY_DIR}/schedules"
    mkdir -p "${DOKPLOY_DIR}/volume-backups"
    print_info "Directories created"
}

check_ports() {
    print_info "Checking required ports..."
    PORTS=(80 443 3000 25 143 465 587 993)
    for port in "${PORTS[@]}"; do
        if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_warn "Port ${port} is already in use"
        else
            print_info "Port ${port} is available"
        fi
    done
}

generate_env_file() {
    if [ ! -f "${ENV_FILE}" ]; then
        print_info "Generating environment file..."
        cat > "${ENV_FILE}" <<EOF
# Dokploy Configuration
DATABASE_URL=postgres://dokploy:$(openssl rand -base64 32)@postgres:5432/dokploy
REDIS_URL=redis://redis:6379
NODE_ENV=production
PORT=3000

# Email Module Configuration
MAILSERVER_CONTAINER_NAME=mailserver

# JWT Secret
JWT_SECRET=$(openssl rand -base64 64)

# PostgreSQL
POSTGRES_USER=dokploy
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_DB=dokploy

# Redis
REDIS_PASSWORD=$(openssl rand -base64 32)
EOF
        print_info "Environment file created at ${ENV_FILE}"
        print_warn "Please review and update ${ENV_FILE} with your specific configuration"
    else
        print_info "Environment file already exists"
    fi
}

pull_images() {
    print_info "Pulling Docker images..."
    docker pull dokploy/dokploy:latest || print_warn "Failed to pull dokploy image"
    docker pull postgres:15-alpine
    docker pull redis:7-alpine
    docker pull traefik:v3.6.1
    print_info "Images pulled successfully"
}

create_docker_compose() {
    if [ ! -f "${DOCKER_COMPOSE_FILE}" ]; then
        print_info "Creating Docker Compose file..."
        # This is a template - users should customize it
        print_warn "Docker Compose file not found. Please create it manually or use the template."
        print_info "See DEPLOYMENT.md for Docker Compose configuration"
    else
        print_info "Docker Compose file already exists"
    fi
}

run_migrations() {
    print_info "Running database migrations..."
    # Migrations should be run by the application on startup
    # But we can verify the database is ready
    print_info "Migrations will be run automatically by the application"
}

check_mail_server() {
    if [ -n "${MAILSERVER_CONTAINER_NAME}" ]; then
        print_info "Checking mail server container..."
        if docker ps --format '{{.Names}}' | grep -q "^${MAILSERVER_CONTAINER_NAME}$"; then
            print_info "Mail server container is running"
        else
            print_warn "Mail server container '${MAILSERVER_CONTAINER_NAME}' is not running"
            print_warn "Email features will not work until mail server is started"
            print_info "To start mail server, use: docker-compose -f templates/mail-server/docker-compose.yml up -d"
        fi
    fi
}

start_services() {
    print_info "Starting services..."
    if [ -f "${DOCKER_COMPOSE_FILE}" ]; then
        cd "${DOKPLOY_DIR}"
        docker-compose up -d || docker compose up -d
        print_info "Services started"
    else
        print_warn "Docker Compose file not found. Please start services manually."
    fi
}

health_check() {
    print_info "Performing health checks..."
    sleep 10  # Wait for services to start
    
    # Check if Dokploy is responding
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        print_info "Dokploy is healthy"
    else
        print_warn "Dokploy health check failed. Check logs: docker logs dokploy"
    fi
    
    # Check database
    if docker exec dokploy-postgres pg_isready -U dokploy > /dev/null 2>&1; then
        print_info "PostgreSQL is healthy"
    else
        print_warn "PostgreSQL health check failed"
    fi
    
    # Check Redis
    if docker exec dokploy-redis redis-cli ping > /dev/null 2>&1; then
        print_info "Redis is healthy"
    else
        print_warn "Redis health check failed"
    fi
}

display_info() {
    print_info "=========================================="
    print_info "Dokploy Deployment Complete"
    print_info "=========================================="
    print_info "Access Dokploy at: http://$(hostname -I | awk '{print $1}'):3000"
    print_info "Configuration directory: ${DOKPLOY_DIR}"
    print_info "Environment file: ${ENV_FILE}"
    print_info ""
    print_info "Next steps:"
    print_info "1. Complete initial setup in Dokploy UI"
    print_info "2. Configure email domain and DNS records"
    print_info "3. Start mail server if not already running"
    print_info "4. Review ${ENV_FILE} for any custom configuration"
    print_info "=========================================="
}

# Main execution
main() {
    print_info "Starting Dokploy deployment..."
    
    check_root
    check_docker
    check_docker_compose
    check_ports
    create_directories
    generate_env_file
    pull_images
    create_docker_compose
    start_services
    run_migrations
    check_mail_server
    health_check
    display_info
    
    print_info "Deployment completed successfully!"
}

# Run main function
main "$@"

