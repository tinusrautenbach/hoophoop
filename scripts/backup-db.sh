#!/bin/bash

# Database Backup Script for Basketball Scoring App
# This script performs daily backups of the PostgreSQL database to S3
# Usage: ./scripts/backup-db.sh [--manual]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_BUCKET="${BACKUP_BUCKET:-bball-db-backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"
RETENTION_DAYS=7
RETENTION_WEEKS=4
RETENTION_MONTHS=12

# Check if running in manual mode
MANUAL_MODE=false
if [[ "${1:-}" == "--manual" ]]; then
    MANUAL_MODE=true
fi

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

# Validate required environment variables
validate_env() {
    local required_vars=("DATABASE_URL" "AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error_exit "Required environment variable $var is not set"
        fi
    done
}

# Create backup filename
BACKUP_DATE=$(date +%Y%m%d)
BACKUP_TIME=$(date +%H%M%S)
BACKUP_FILE="bball-backup-${BACKUP_DATE}-${BACKUP_TIME}.sql"
BACKUP_PATH="/tmp/${BACKUP_FILE}"
COMPRESSED_BACKUP="${BACKUP_PATH}.gz"

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

# Create database dump
create_backup() {
    log "Creating database backup..."
    
    parse_database_url
    
    # Create the dump with compression
    PGPASSWORD="$DB_PASS" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --verbose \
        --format=plain \
        --no-owner \
        --no-acl \
        2>/dev/null | gzip > "$COMPRESSED_BACKUP"
    
    if [[ $? -ne 0 ]]; then
        error_exit "Failed to create database backup"
    fi
    
    local size
    size=$(du -h "$COMPRESSED_BACKUP" | cut -f1)
    log "Backup created: $COMPRESSED_BACKUP (size: $size)"
}

# Calculate MD5 checksum for verification
calculate_checksum() {
    local file="$1"
    md5sum "$file" | cut -d' ' -f1
}

# Upload backup to S3 with retry logic
upload_to_s3() {
    log "Uploading backup to S3..."
    
    local max_retries=3
    local retry_delay=5
    local attempt=1
    
    while [[ $attempt -le $max_retries ]]; do
        log "Upload attempt $attempt of $max_retries..."
        
        # Upload with checksum
        local checksum
        checksum=$(calculate_checksum "$COMPRESSED_BACKUP")
        
        if aws s3 cp "$COMPRESSED_BACKUP" "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${BACKUP_DATE}/${BACKUP_FILE}.gz" \
            --metadata md5checksum="$checksum" \
            --storage-class STANDARD_IA; then
            
            log "Backup uploaded successfully to s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${BACKUP_DATE}/${BACKUP_FILE}.gz"
            
            # Verify upload by checking if file exists and has correct size
            local remote_size
            remote_size=$(aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${BACKUP_DATE}/${BACKUP_FILE}.gz" | awk '{print $3}')
            local local_size
            local_size=$(stat -f%z "$COMPRESSED_BACKUP" 2>/dev/null || stat -c%s "$COMPRESSED_BACKUP")
            
            if [[ "$remote_size" == "$local_size" ]]; then
                log "Upload verified: checksum and size match"
                return 0
            else
                log "WARNING: Size mismatch - remote: $remote_size, local: $local_size"
                return 1
            fi
        fi
        
        log "Upload failed, retrying in ${retry_delay}s..."
        sleep $retry_delay
        ((attempt++))
        retry_delay=$((retry_delay * 2))
    done
    
    error_exit "Failed to upload backup after $max_retries attempts"
}

# Apply retention policy - delete old backups
apply_retention_policy() {
    log "Applying retention policy..."
    
    local current_date=$(date +%s)
    local deleted_count=0
    
    # List all backups
    log "Checking backups for retention policy..."
    
    # Delete daily backups older than 7 days
    local cutoff_daily=$((current_date - (RETENTION_DAYS * 86400)))
    log "Deleting daily backups older than $RETENTION_DAYS days..."
    
    aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/" | while read -r line; do
        local date_folder=$(echo "$line" | awk '{print $2}' | sed 's|/||')
        if [[ -n "$date_folder" && "$date_folder" =~ ^[0-9]{8}$ ]]; then
            local folder_date=$(date -d "${date_folder:0:4}-${date_folder:4:2}-${date_folder:6:2}" +%s 2>/dev/null || date -j -f "%Y%m%d" "$date_folder" +%s)
            local age_days=$(( (current_date - folder_date) / 86400 ))
            
            # Determine if this is a weekly backup (Sunday = 0)
            local day_of_week=$(date -d "${date_folder:0:4}-${date_folder:4:2}-${date_folder:6:2}" +%u 2>/dev/null || date -j -f "%Y%m%d" "$date_folder" +%u)
            local is_weekly_backup=false
            if [[ "$day_of_week" == "7" ]] || [[ "$day_of_week" == "0" ]]; then
                is_weekly_backup=true
            fi
            
            if [[ $age_days -gt $RETENTION_DAYS ]]; then
                # Keep only weekly backups after 7 days
                if [[ "$is_weekly_backup" == "true" && $age_days -le $((RETENTION_DAYS + (RETENTION_WEEKS * 7))) ]]; then
                    log "Keeping weekly backup: $date_folder (age: ${age_days} days)"
                elif [[ "$is_weekly_backup" == "true" && $age_days -le $((RETENTION_DAYS + (RETENTION_WEEKS * 7) + (RETENTION_MONTHS * 30))) ]]; then
                    # Check if this is a monthly backup (first Sunday of the month)
                    local day_of_month=$(date -d "${date_folder:0:4}-${date_folder:4:2}-${date_folder:6:2}" +%d 2>/dev/null || date -j -f "%Y%m%d" "$date_folder" +%d)
                    if [[ "$day_of_month" -le "7" ]]; then
                        log "Keeping monthly backup: $date_folder (age: ${age_days} days)"
                    else
                        log "Deleting old weekly backup: $date_folder (age: ${age_days} days)"
                        aws s3 rm "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${date_folder}/" --recursive
                        ((deleted_count++))
                    fi
                else
                    log "Deleting old daily backup: $date_folder (age: ${age_days} days)"
                    aws s3 rm "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${date_folder}/" --recursive
                    ((deleted_count++))
                fi
            fi
        fi
    done
    
    log "Retention policy applied: deleted $deleted_count old backup(s)"
}

# Log backup operation to file
log_backup_operation() {
    local status="$1"
    local size="$2"
    local log_file="${PROJECT_ROOT}/logs/backup.log"
    
    # Create logs directory if it doesn't exist
    mkdir -p "$(dirname "$log_file")"
    
    echo "{
  \"timestamp\": \"$(date -Iseconds)\",
  \"status\": \"$status\",
  \"file\": \"${BACKUP_FILE}.gz\",
  \"size\": \"$size\",
  \"manual\": $MANUAL_MODE,
  \"s3_path\": \"s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${BACKUP_DATE}/${BACKUP_FILE}.gz\"
}" >> "$log_file"
}

# Cleanup temporary files
cleanup() {
    log "Cleaning up temporary files..."
    if [[ -f "$COMPRESSED_BACKUP" ]]; then
        rm -f "$COMPRESSED_BACKUP"
    fi
    if [[ -f "$BACKUP_PATH" ]]; then
        rm -f "$BACKUP_PATH"
    fi
}

# Main execution
main() {
    log "Starting database backup process..."
    log "Mode: $([[ $MANUAL_MODE == true ]] && echo "Manual" || echo "Scheduled")"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Validate environment
    validate_env
    
    # Create backup
    create_backup
    
    # Get backup size
    local backup_size
    backup_size=$(du -h "$COMPRESSED_BACKUP" | cut -f1)
    
    # Upload to S3
    if upload_to_s3; then
        # Apply retention policy (only for scheduled backups)
        if [[ $MANUAL_MODE == false ]]; then
            apply_retention_policy
        fi
        
        # Log successful operation
        log_backup_operation "success" "$backup_size"
        log "Backup completed successfully!"
    else
        log_backup_operation "failed" "$backup_size"
        error_exit "Backup upload failed"
    fi
}

# Run main function
main
