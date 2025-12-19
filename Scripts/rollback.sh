#!/bin/bash

# Dokploy Rollback Script
# This script helps rollback to a previous version of Dokploy

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOKPLOY_DIR="/etc/dokploy"
DOCKER_COMPOSE_FILE="${DOKPLOY_DIR}/docker-compose.yml"
BACKUP_DIR="${DOKPLOY_DIR}/backups"

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

list_backups() {
    print_info "Available backups:"
    if [ -d "${BACKUP_DIR}" ]; then
        ls -lh "${BACKUP_DIR}" | grep -E "\.(sql|tar\.gz)$" || print_warn "No backups found"
    else
        print_warn "Backup directory does not exist"
    fi
}

backup_current() {
    print_info "Creating backup of current deployment..."
    mkdir -p "${BACKUP_DIR}"
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    
    # Backup database
    if docker ps --format '{{.Names}}' | grep -q "^dokploy-postgres$"; then
        docker exec dokploy-postgres pg_dump -U dokploy dokploy > "${BACKUP_DIR}/${BACKUP_NAME}.sql"
        print_info "Database backed up to ${BACKUP_DIR}/${BACKUP_NAME}.sql"
    else
        print_warn "PostgreSQL container not running, skipping database backup"
    fi
    
    # Backup volumes
    docker run --rm -v dokploy_postgres_data:/data -v "${BACKUP_DIR}":/backup alpine tar czf /backup/${BACKUP_NAME}-postgres.tar.gz /data 2>/dev/null || print_warn "Could not backup postgres volume"
    
    print_info "Backup created: ${BACKUP_NAME}"
}

rollback_database() {
    local backup_file=$1
    if [ ! -f "${backup_file}" ]; then
        print_error "Backup file not found: ${backup_file}"
        return 1
    fi
    
    print_info "Rolling back database from ${backup_file}..."
    if docker ps --format '{{.Names}}' | grep -q "^dokploy-postgres$"; then
        cat "${backup_file}" | docker exec -i dokploy-postgres psql -U dokploy -d dokploy
        print_info "Database rollback complete"
    else
        print_error "PostgreSQL container is not running"
        return 1
    fi
}

rollback_image() {
    local version=$1
    print_info "Rolling back to Docker image version: ${version}"
    
    if [ -f "${DOCKER_COMPOSE_FILE}" ]; then
        cd "${DOKPLOY_DIR}"
        # Update image version in docker-compose.yml
        sed -i "s|dokploy/dokploy:.*|dokploy/dokploy:${version}|g" "${DOCKER_COMPOSE_FILE}"
        docker-compose pull dokploy || docker compose pull dokploy
        docker-compose up -d dokploy || docker compose up -d dokploy
        print_info "Image rollback complete"
    else
        print_error "Docker Compose file not found"
        return 1
    fi
}

main() {
    if [ "$1" == "--list" ] || [ "$1" == "-l" ]; then
        list_backups
        exit 0
    fi
    
    if [ "$1" == "--backup" ] || [ "$1" == "-b" ]; then
        check_root
        backup_current
        exit 0
    fi
    
    if [ "$1" == "--db" ] && [ -n "$2" ]; then
        check_root
        rollback_database "$2"
        exit 0
    fi
    
    if [ "$1" == "--image" ] && [ -n "$2" ]; then
        check_root
        backup_current
        rollback_image "$2"
        exit 0
    fi
    
    # Show usage
    echo "Dokploy Rollback Script"
    echo ""
    echo "Usage:"
    echo "  $0 --list, -l                    List available backups"
    echo "  $0 --backup, -b                  Create backup of current deployment"
    echo "  $0 --db <backup_file>            Rollback database from backup file"
    echo "  $0 --image <version>             Rollback to specific Docker image version"
    echo ""
    echo "Examples:"
    echo "  $0 --backup"
    echo "  $0 --db /etc/dokploy/backups/backup-20250127-120000.sql"
    echo "  $0 --image v0.26.1"
    exit 1
}

main "$@"

