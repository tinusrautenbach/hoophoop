#!/bin/bash

# Database Restore Script for Basketball Scoring App
# This script restores a database backup from S3 to the database
# Usage: ./scripts/restore-db.sh [--list | --latest | <backup-file>]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_BUCKET="${BACKUP_BUCKET:-bball-db-backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-backups}"
RESTORE_ENV="${RESTORE_ENV:-staging}"

# Load environment variables if .env exists
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
    export $(grep -v '^#' "${PROJECT_ROOT}/.env" | xargs)
fi

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Extract database connection info from DATABASE_URL
parse_database_url() {
    # Parse postgresql://user:password@host:port/dbname
    if [[ "$DATABASE_URL" =~ ^postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)$ ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
    else
        error_exit "Unable to parse DATABASE_URL"
    fi
}

# List available backups
list_backups() {
    log "Available backups in s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/"
    
    aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/" | while read -r line; do
        local date_folder=$(echo "$line" | awk '{print $2}' | sed 's|/||')
        if [[ -n "$date_folder" ]]; then
            aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${date_folder}/" | awk -v date="$date_folder" '{print date "/" $4}'
        fi
    done | sort -r | head -20
}

# Get the latest backup
get_latest_backup() {
    log "Finding latest backup..."
    
    local latest_backup
    latest_backup=$(aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/" | awk '{print $2}' | sed 's|/||' | sort -r | head -1)
    
    if [[ -z "$latest_backup" ]]; then
        error_exit "No backups found in S3"
    fi
    
    local latest_file
    latest_file=$(aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${latest_backup}/" | sort -k1,2 -r | head -1 | awk '{print $4}')
    
    if [[ -z "$latest_file" ]]; then
        error_exit "No backup files found in latest backup folder"
    fi
    
    echo "${latest_backup}/${latest_file}"
}

# Download backup from S3
download_backup() {
    local s3_path="$1"
    local local_path="$2"
    
    log "Downloading backup from S3: s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${s3_path}"
    
    if ! aws s3 cp "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${s3_path}" "$local_path"; then
        error_exit "Failed to download backup from S3"
    fi
    
    log "Backup downloaded to: $local_path"
}

# Restore database from backup
restore_database() {
    local backup_file="$1"
    
    log "Restoring database from backup..."
    
    parse_database_url
    
    # Check if backup file is compressed
    local decompressed_file="$backup_file"
    if [[ "$backup_file" == *.gz ]]; then
        log "Decompressing backup file..."
        decompressed_file="${backup_file%.gz}"
        gunzip -c "$backup_file" > "$decompressed_file"
    fi
    
    # Create target database if it doesn't exist
    log "Creating target database if it doesn't exist..."
    PGPASSWORD="$DB_PASS" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d postgres \
        -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" 2>/dev/null | grep -q 1 || \
        PGPASSWORD="$DB_PASS" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d postgres \
            -c "CREATE DATABASE $DB_NAME" 2>/dev/null
    
    # Restore the backup
    log "Restoring data to database $DB_NAME..."
    if ! PGPASSWORD="$DB_PASS" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$decompressed_file" 2>&1 | grep -v "^SET$\|^COMMENT$"; then
        
        # Don't fail on non-critical warnings
        log "Restore completed (some warnings may have been ignored)"
    fi
    
    # Clean up decompressed file if it was compressed
    if [[ "$backup_file" == *.gz && -f "$decompressed_file" ]]; then
        rm -f "$decompressed_file"
    fi
    
    log "Database restore completed successfully!"
}

# Validate restored data
validate_restore() {
    log "Validating restored data..."
    
    parse_database_url
    
    # Check if critical tables exist and have data
    local tables=("games" "teams" "athletes" "users" "communities")
    
    for table in "${tables[@]}"; do
        local count
        count=$(PGPASSWORD="$DB_PASS" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -t \
            -c "SELECT COUNT(*) FROM $table" 2>/dev/null | xargs)
        
        if [[ -n "$count" && "$count" =~ ^[0-9]+$ ]]; then
            log "  ✓ Table '$table': $count rows"
        else
            log "  ⚠ Table '$table': unable to get count (may be empty or doesn't exist)"
        fi
    done
}

# Cleanup temporary files
cleanup() {
    if [[ -n "${TEMP_BACKUP:-}" && -f "$TEMP_BACKUP" ]]; then
        rm -f "$TEMP_BACKUP"
        log "Cleaned up temporary files"
    fi
}

# Show usage
show_usage() {
    cat << EOF
Database Restore Script

Usage:
  $0 --list                    List available backups
  $0 --latest                  Restore the most recent backup
  $0 <s3-path>                 Restore specific backup (e.g., 20250215/bball-backup-20250215-020000.sql.gz)

Environment Variables:
  DATABASE_URL        PostgreSQL connection string (required)
  BACKUP_BUCKET       S3 bucket name (default: bball-db-backups)
  BACKUP_PREFIX       S3 prefix path (default: backups)
  AWS_ACCESS_KEY_ID   AWS credentials (required)
  AWS_SECRET_ACCESS_KEY AWS credentials (required)
  AWS_REGION          AWS region (default: us-east-1)
  RESTORE_ENV         Target environment: staging|production (default: staging)

Examples:
  # List all available backups
  $0 --list

  # Restore the latest backup to staging
  $0 --latest

  # Restore a specific backup
  $0 20250215/bball-backup-20250215-020000.sql.gz

WARNING: Restoring to production will OVERWRITE existing data!
EOF
}

# Main execution
main() {
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Check arguments
    if [[ $# -eq 0 ]]; then
        show_usage
        exit 1
    fi
    
    local command="$1"
    
    case "$command" in
        --list|-l)
            list_backups
            exit 0
            ;;
        --latest)
            log "Restoring latest backup..."
            backup_path=$(get_latest_backup)
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            backup_path="$command"
            ;;
    esac
    
    # Validate environment
    if [[ -z "${DATABASE_URL:-}" ]]; then
        error_exit "DATABASE_URL environment variable is required"
    fi
    
    if [[ -z "${AWS_ACCESS_KEY_ID:-}" || -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
        error_exit "AWS credentials are required (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)"
    fi
    
    # Confirm for production restores
    if [[ "$RESTORE_ENV" == "production" ]]; then
        log "⚠️  WARNING: You are about to restore to PRODUCTION!"
        log "This will OVERWRITE all existing data!"
        read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm
        if [[ "$confirm" != "yes" ]]; then
            log "Restore cancelled by user"
            exit 1
        fi
    fi
    
    # Download backup
    TEMP_BACKUP="/tmp/restore-$(date +%s).sql.gz"
    download_backup "$backup_path" "$TEMP_BACKUP"
    
    # Restore database
    restore_database "$TEMP_BACKUP"
    
    # Validate
    validate_restore
    
    log "Restore process completed successfully!"
    log "Backup file: $backup_path"
    log "Target environment: $RESTORE_ENV"
}

# Run main function
main "$@"
