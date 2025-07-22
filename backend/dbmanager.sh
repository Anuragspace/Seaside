#!/bin/bash

# Database Manager Script
# This script provides easy access to database management commands

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Colors

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please create it with DATABASE_URL and other required variables."
    exit 1
fi

# Build the dbmanager tool if it doesn't exist or is older than source
if [ ! -f "dbmanager" ] || [ "cmd/dbmanager/main.go" -nt "dbmanager" ]; then
    print_status "Building database manager..."
    go build -o dbmanager ./cmd/dbmanager/main.go
fi

# Function to show usage
show_usage() {
    echo "Database Manager - OAuth2 Authentication System"
    echo ""
    echo "Usage: ./dbmanager.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  migrate              Run database migrations"
    echo "  seed                 Apply seed data (development only)"
    echo "  backup [options]     Create database backup"
    echo "  restore <file>       Restore from backup file"
    echo "  health               Check database health"
    echo "  detailed-health      Get detailed health report"
    echo "  cleanup [max-age]    Cleanup expired data and old backups"
    echo "  status               Show migration status"
    echo "  list-backups         List available backups"
    echo "  help                 Show this help message"
    echo ""
    echo "Backup Options:"
    echo "  --no-compress        Create uncompressed backup"
    echo "  --no-validate        Skip backup validation"
    echo ""
    echo "Examples:"
    echo "  ./dbmanager.sh migrate"
    echo "  ./dbmanager.sh backup"
    echo "  ./dbmanager.sh backup --no-compress --no-validate"
    echo "  ./dbmanager.sh restore backups/backup_20240121_143022.sql.gz"
    echo "  ./dbmanager.sh cleanup 168h  # cleanup older than 7 days"
    echo "  ./dbmanager.sh list-backups"
    echo "  ./dbmanager.sh detailed-health"
    echo ""
}

# Check if command is provided
if [ $# -eq 0 ]; then
    show_usage
    exit 1
fi

COMMAND=$1

case $COMMAND in
    "migrate")
        print_status "Running database migrations..."
        ./dbmanager -command=migrate
        print_status "Migrations completed successfully"
        ;;
    
    "seed")
        print_status "Applying seed data..."
        ./dbmanager -command=seed
        print_status "Seed data applied successfully"
        ;;
    
    "backup")
        BACKUP_ARGS="-command=backup"
        
        # Parse backup options
        shift
        while [[ $# -gt 0 ]]; do
            case $1 in
                --no-compress)
                    BACKUP_ARGS="$BACKUP_ARGS -compress=false"
                    shift
                    ;;
                --no-validate)
                    BACKUP_ARGS="$BACKUP_ARGS -validate=false"
                    shift
                    ;;
                *)
                    print_error "Unknown backup option: $1"
                    exit 1
                    ;;
            esac
        done
        
        print_status "Creating database backup..."
        ./dbmanager $BACKUP_ARGS
        print_status "Backup completed successfully"
        ;;
    
    "restore")
        if [ $# -lt 2 ]; then
            print_error "Backup file is required for restore command"
            echo "Usage: ./dbmanager.sh restore <backup-file>"
            exit 1
        fi
        BACKUP_FILE=$2
        print_warning "This will restore the database from: $BACKUP_FILE"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Restoring database..."
            ./dbmanager -command=restore -backup-file="$BACKUP_FILE"
            print_status "Database restored successfully"
        else
            print_status "Restore cancelled"
        fi
        ;;
    
    "health")
        print_status "Checking database health..."
        ./dbmanager -command=health
        ;;
    
    "detailed-health")
        print_status "Getting detailed health report..."
        ./dbmanager -command=detailed-health
        ;;
    
    "list-backups")
        print_status "Listing available backups..."
        ./dbmanager -command=list-backups
        ;;
    
    "cleanup")
        MAX_AGE="168h" # Default 7 days
        if [ $# -ge 2 ]; then
            MAX_AGE=$2
        fi
        print_status "Cleaning up expired data and backups older than $MAX_AGE..."
        ./dbmanager -command=cleanup -max-age="$MAX_AGE"
        print_status "Cleanup completed successfully"
        ;;
    
    "status")
        print_status "Checking migration status..."
        ./dbmanager -command=status
        ;;
    
    "help"|"-h"|"--help")
        show_usage
        ;;
    
    *)
        print_error "Unknown command: $COMMAND"
        echo ""
        show_usage
        exit 1
        ;;
esac
