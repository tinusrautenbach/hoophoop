#!/bin/bash

# Setup Cron Job for Database Backups
# This script configures the host system to run database backups via Docker
# Usage: sudo ./scripts/setup-backup-cron.sh [container_name]

set -e

CONTAINER_NAME="${1:-bball-app-1}"
CRON_SCHEDULE="0 2 * * *"  # 2 AM UTC daily
SCRIPT_PATH="/app/scripts/backup-db.sh"
LOG_PATH="/var/log/bball-backup.log"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)"
   exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    exit 1
fi

# Check if container exists and is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Error: Container '${CONTAINER_NAME}' is not running"
    echo "Available containers:"
    docker ps --format '{{.Names}}'
    exit 1
fi

echo "Setting up cron job for database backup..."
echo "Container: ${CONTAINER_NAME}"
echo "Schedule: ${CRON_SCHEDULE} (2 AM UTC daily)"
echo "Log file: ${LOG_PATH}"

# Create cron job entry
CRON_JOB="${CRON_SCHEDULE} docker exec ${CONTAINER_NAME} ${SCRIPT_PATH} >> ${LOG_PATH} 2>&1"

# Add to crontab
echo "${CRON_JOB}" | crontab -

echo ""
echo "Cron job installed successfully!"
echo ""
echo "Current crontab:"
crontab -l
echo ""
echo "To verify the backup script works manually, run:"
echo "  docker exec ${CONTAINER_NAME} ${SCRIPT_PATH} --manual"
echo ""
echo "To view backup logs:"
echo "  tail -f ${LOG_PATH}"
echo ""
echo "To remove the cron job:"
echo "  sudo crontab -r"
