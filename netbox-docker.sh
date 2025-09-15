#!/bin/bash

# NetBox Docker Management Script
# This script provides common operations for managing NetBox Docker containers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Function to print colored output
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if .env file exists
check_env_file() {
    if [ ! -f ".env" ]; then
        print_message "$YELLOW" "Warning: .env file not found. Creating from .env.example..."
        cp .env.example .env
        print_message "$GREEN" "Created .env file. Please update it with your configuration."
        print_message "$YELLOW" "Especially make sure to generate a new SECRET_KEY for production!"
        echo ""
    fi
}

# Function to generate secret key
generate_secret_key() {
    if command -v python3 &> /dev/null; then
        python3 -c "import secrets; print(secrets.token_urlsafe(50))"
    elif command -v openssl &> /dev/null; then
        openssl rand -base64 50 | tr -d '\n'
    else
        print_message "$RED" "Error: Neither python3 nor openssl found. Cannot generate secret key."
        exit 1
    fi
}

# Main menu
case "$1" in
    start)
        print_message "$GREEN" "Starting NetBox containers..."
        check_env_file
        docker-compose up -d
        print_message "$GREEN" "NetBox is starting up. Access it at http://localhost:8000"
        print_message "$YELLOW" "Note: Initial startup may take 1-2 minutes for database migrations."
        ;;
    
    stop)
        print_message "$YELLOW" "Stopping NetBox containers..."
        docker-compose stop
        print_message "$GREEN" "NetBox containers stopped."
        ;;
    
    down)
        print_message "$YELLOW" "Stopping and removing NetBox containers..."
        docker-compose down
        print_message "$GREEN" "NetBox containers removed."
        ;;
    
    restart)
        print_message "$YELLOW" "Restarting NetBox containers..."
        docker-compose restart
        print_message "$GREEN" "NetBox containers restarted."
        ;;
    
    logs)
        service=${2:-}
        if [ -z "$service" ]; then
            docker-compose logs -f --tail=100
        else
            docker-compose logs -f --tail=100 "$service"
        fi
        ;;
    
    status)
        print_message "$GREEN" "NetBox Container Status:"
        docker-compose ps
        echo ""
        print_message "$GREEN" "Container Health:"
        docker ps --filter "name=netbox" --format "table {{.Names}}\t{{.Status}}"
        ;;
    
    shell)
        print_message "$GREEN" "Opening shell in NetBox container..."
        docker-compose exec netbox /bin/bash
        ;;
    
    dbshell)
        print_message "$GREEN" "Opening PostgreSQL shell..."
        docker-compose exec netbox-postgres psql -U netbox
        ;;
    
    generate-key)
        print_message "$GREEN" "Generating new SECRET_KEY:"
        generate_secret_key
        ;;
    
    migrate)
        print_message "$GREEN" "Running database migrations..."
        docker-compose exec netbox /opt/netbox/netbox/manage.py migrate
        print_message "$GREEN" "Migrations completed."
        ;;
    
    createsuperuser)
        print_message "$GREEN" "Creating NetBox superuser..."
        docker-compose exec netbox /opt/netbox/netbox/manage.py createsuperuser
        ;;
    
    backup)
        backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$backup_dir"
        print_message "$GREEN" "Creating backup in $backup_dir..."
        
        # Backup database
        docker-compose exec -T netbox-postgres pg_dump -U netbox netbox > "$backup_dir/netbox_db.sql"
        
        # Backup media files
        docker cp netbox:/opt/netbox/netbox/media "$backup_dir/media" 2>/dev/null || true
        
        # Backup configuration
        cp .env "$backup_dir/.env" 2>/dev/null || true
        
        print_message "$GREEN" "Backup completed in $backup_dir"
        ;;
    
    test)
        print_message "$GREEN" "Testing NetBox installation..."
        
        # Check if containers are running
        if docker-compose ps | grep -q "Up"; then
            print_message "$GREEN" "✓ Containers are running"
        else
            print_message "$RED" "✗ Some containers are not running"
        fi
        
        # Test NetBox API
        if curl -s -f http://localhost:8000/api/ > /dev/null 2>&1; then
            print_message "$GREEN" "✓ NetBox API is responding"
        else
            print_message "$RED" "✗ NetBox API is not responding"
        fi
        
        # Test database connection
        if docker-compose exec -T netbox-postgres pg_isready -U netbox > /dev/null 2>&1; then
            print_message "$GREEN" "✓ PostgreSQL is ready"
        else
            print_message "$RED" "✗ PostgreSQL is not ready"
        fi
        
        # Test Redis
        if docker-compose exec -T netbox-redis redis-cli ping > /dev/null 2>&1; then
            print_message "$GREEN" "✓ Redis is responding"
        else
            print_message "$RED" "✗ Redis is not responding"
        fi
        ;;
    
    *)
        print_message "$GREEN" "NetBox Docker Management Script"
        echo ""
        echo "Usage: $0 {command} [options]"
        echo ""
        echo "Commands:"
        echo "  start              - Start all NetBox containers"
        echo "  stop               - Stop all NetBox containers"
        echo "  down               - Stop and remove all containers"
        echo "  restart            - Restart all containers"
        echo "  logs [service]     - View container logs (optionally for specific service)"
        echo "  status             - Show container status"
        echo "  shell              - Open bash shell in NetBox container"
        echo "  dbshell            - Open PostgreSQL shell"
        echo "  generate-key       - Generate a new SECRET_KEY"
        echo "  migrate            - Run database migrations"
        echo "  createsuperuser    - Create a NetBox superuser"
        echo "  backup             - Create backup of database and media files"
        echo "  test               - Test NetBox installation"
        echo ""
        echo "Examples:"
        echo "  $0 start           - Start NetBox"
        echo "  $0 logs netbox     - View NetBox container logs"
        echo "  $0 backup          - Create a backup"
        exit 1
        ;;
esac