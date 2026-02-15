# Database Backup & Restore Documentation

This document describes the database backup and restore procedures for the Basketball Scoring App.

## Overview

The application uses an automated daily backup system that:
- Creates compressed PostgreSQL dumps at 2 AM UTC daily
- Uploads backups to AWS S3 with integrity verification
- Maintains a tiered retention policy (daily → weekly → monthly)
- Supports on-demand manual backups
- Provides restore capabilities to staging or production

## Architecture

### Backup Strategy

```
┌─────────────────┐     ┌──────────────┐     ┌───────────────┐
│  PostgreSQL DB  │────▶│   pg_dump    │────▶│  S3 Bucket    │
│  (Production)   │     │  (compressed)│     │ (bball-db-    │
└─────────────────┘     └──────────────┘     │   backups)    │
                                             └───────────────┘
                                                    │
                       ┌────────────────────────────┼────────────────────────────┐
                       │                            │                            │
                       ▼                            ▼                            ▼
              ┌────────────────┐          ┌────────────────┐          ┌────────────────┐
              │  Daily (7 days)│          │ Weekly (4 wks) │          │Monthly (12 mos)│
              │  20250215/     │          │  Sunday only   │          │1st Sunday/mo  │
              │  *.sql.gz      │          │  *.sql.gz      │          │  *.sql.gz      │
              └────────────────┘          └────────────────┘          └────────────────┘
```

### Retention Policy

| Backup Type | Retention Period | Description |
|-------------|------------------|-------------|
| **Daily**   | 7 days          | All backups from last 7 days |
| **Weekly**  | 4 weeks         | Only Sunday backups after 7 days |
| **Monthly** | 12 months       | First Sunday of each month after 4 weeks |

**Example Timeline:**
- Day 1-7: All daily backups kept
- Day 8-35: Only Sunday backups kept (weekly)
- Day 36+: Only first Sunday of each month kept (monthly)

## Setup

### Prerequisites

1. **AWS Account** with S3 access
2. **PostgreSQL client tools** (`pg_dump`, `psql`)
3. **AWS CLI** configured with appropriate permissions

### AWS S3 Configuration

1. Create S3 bucket:
```bash
aws s3 mb s3://bball-db-backups --region us-east-1
```

2. Enable versioning (recommended):
```bash
aws s3api put-bucket-versioning \
  --bucket bball-db-backups \
  --versioning-configuration Status=Enabled
```

3. Configure lifecycle policy for cost optimization:
```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket bball-db-backups \
  --lifecycle-configuration file://s3-lifecycle-policy.json
```

### Environment Variables

Add these to your `.env` file:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/bball

# AWS S3 Backup
BACKUP_BUCKET=bball-db-backups
BACKUP_PREFIX=backups
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Optional: Override retention periods
RETENTION_DAYS=7
RETENTION_WEEKS=4
RETENTION_MONTHS=12
```

### IAM Permissions

Create an IAM policy with minimal required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetObjectVersion"
      ],
      "Resource": [
        "arn:aws:s3:::bball-db-backups",
        "arn:aws:s3:::bball-db-backups/*"
      ]
    }
  ]
}
```

## Usage

### Automated Daily Backups

#### Option 1: Host-Level Cron (Recommended for Docker)

For Docker deployments, the recommended approach is to run cron on the **host** system and trigger backups inside the container:

**Quick Setup:**
```bash
# Run as root or with sudo
sudo ./scripts/setup-backup-cron.sh [container_name]
```

**Manual Setup:**
```bash
# Edit system crontab
sudo crontab -e

# Add line for 2 AM UTC daily (adjust container name as needed)
0 2 * * * docker exec bball-app-1 /app/scripts/backup-db.sh >> /var/log/bball-backup.log 2>&1
```

**Verify setup:**
```bash
# Check if cron job is scheduled
sudo crontab -l | grep backup-db

# Test the backup manually first
docker exec bball-app-1 /app/scripts/backup-db.sh --manual

# View logs
tail -f /var/log/bball-backup.log
```

#### Option 2: Native Installation (Non-Docker)

If running without Docker:

```bash
# Edit crontab
crontab -e

# Add line for 2 AM UTC daily
0 2 * * * /path/to/project/scripts/backup-db.sh >> /path/to/project/logs/cron-backup.log 2>&1
```

#### Option 3: Systemd Timer (Alternative)

For systems using systemd, create a timer service:

**1. Create backup service:**
```ini
# /etc/systemd/system/bball-backup.service
[Unit]
Description=Basketball App Database Backup
After=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/docker exec bball-app-1 /app/scripts/backup-db.sh
StandardOutput=append:/var/log/bball-backup.log
StandardError=append:/var/log/bball-backup.log
```

**2. Create timer:**
```ini
# /etc/systemd/system/bball-backup.timer
[Unit]
Description=Run Basketball App Database Backup daily

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

**3. Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable bball-backup.timer
sudo systemctl start bball-backup.timer

# Check status
sudo systemctl list-timers --all
```

### Manual Backups

Create an on-demand backup:
```bash
./scripts/backup-db.sh --manual
```

This will:
- Create a backup with timestamp
- Upload to S3
- Skip retention policy cleanup
- Log to backup.log

### Listing Available Backups

View all available backups:
```bash
./scripts/restore-db.sh --list
```

Output format:
```
20250215/bball-backup-20250215-020000.sql.gz
20250214/bball-backup-20250214-020000.sql.gz
20250213/bball-backup-20250213-020000.sql.gz
...
```

### Restoring Backups

#### Restore Latest Backup (Recommended for Testing)

```bash
# Restore to staging (default)
./scripts/restore-db.sh --latest

# Restore to production (DANGEROUS - requires confirmation)
RESTORE_ENV=production ./scripts/restore-db.sh --latest
```

#### Restore Specific Backup

```bash
# Restore specific backup file
./scripts/restore-db.sh 20250215/bball-backup-20250215-020000.sql.gz
```

#### Restore Process

The restore script will:
1. Download the backup from S3
2. Decompress if needed (`.gz` files)
3. Create the target database if it doesn't exist
4. Restore the data using `psql`
5. Validate critical tables have data
6. Clean up temporary files

### Health Check API

Check backup status via API:

```bash
GET /api/health/backup
```

Response:
```json
{
  "status": "success",
  "lastBackup": "2025-02-15T02:00:00Z",
  "backupSize": "15.2 MB",
  "s3Path": "s3://bball-db-backups/backups/20250215/bball-backup-20250215-020000.sql.gz",
  "retentionPolicy": {
    "dailyDays": 7,
    "weeklyWeeks": 4,
    "monthlyMonths": 12
  }
}
```

## Monitoring & Alerts

### Backup Logs

Backup operations are logged to `logs/backup.log`:

```json
{
  "timestamp": "2025-02-15T02:05:32Z",
  "status": "success",
  "file": "bball-backup-20250215-020000.sql.gz",
  "size": "15.2 MB",
  "manual": false,
  "s3_path": "s3://bball-db-backups/backups/20250215/bball-backup-20250215-020000.sql.gz"
}
```

### Failure Notifications

Set up alerts for backup failures:

1. **AWS CloudWatch Alarms** (if using AWS resources)
2. **Email notifications** via cron:
```bash
0 2 * * * /path/to/project/scripts/backup-db.sh 2>&1 | tee -a /path/to/project/logs/cron-backup.log | grep -i "error\|failed" && echo "Backup failed!" | mail -s "Backup Alert" admin@example.com
```

3. **Slack notifications**:
```bash
# Add to backup script or cron
if ! ./scripts/backup-db.sh; then
  curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"Database backup failed!"}' \
    $SLACK_WEBHOOK_URL
fi
```

### Size Monitoring

Track backup growth:

```bash
# Monthly backup size report
aws s3 ls s3://bball-db-backups/backups/ --recursive --human-readable --summarize
```

## Disaster Recovery

### Recovery Time Objective (RTO)
- **Target**: < 30 minutes
- **Process**: Download backup → Restore database → Verify data

### Recovery Point Objective (RPO)
- **Target**: < 24 hours (daily backups)
- **Worst case**: Maximum 1 day of data loss

### Disaster Recovery Runbook

1. **Assess the situation**
   - Determine extent of data loss/corruption
   - Identify last good backup date

2. **Prepare restore environment**
   ```bash
   # Ensure staging environment is ready (for testing)
   # Or prepare production database for restore
   ```

3. **Execute restore**
   ```bash
   # Test restore first on staging
   RESTORE_ENV=staging ./scripts/restore-db.sh 20250215/bball-backup-20250215-020000.sql.gz
   
   # Verify data integrity
   # If successful, restore to production
   RESTORE_ENV=production ./scripts/restore-db.sh 20250215/bball-backup-20250215-020000.sql.gz
   ```

4. **Verify restoration**
   - Check critical tables have expected row counts
   - Verify application can connect and function
   - Run smoke tests

5. **Post-incident**
   - Document what caused the disaster
   - Update procedures if needed
   - Consider taking a fresh backup post-recovery

## Security Considerations

1. **Encryption at Rest**
   - S3 bucket should have default encryption enabled
   - Backups are compressed but not encrypted by default
   - Consider adding GPG encryption for sensitive data

2. **Access Control**
   - Use IAM roles with minimal permissions
   - Rotate AWS credentials regularly
   - Never commit credentials to version control

3. **Network Security**
   - Restrict S3 bucket access to specific IP ranges if possible
   - Use VPC endpoints for S3 access from AWS infrastructure

4. **Data Privacy**
   - Backups contain user data - ensure GDPR/privacy compliance
   - Consider data anonymization for non-production restores

## Troubleshooting

### Common Issues

1. **"pg_dump: command not found"**
   - Install PostgreSQL client: `apt-get install postgresql-client` (Ubuntu) or `brew install postgresql` (Mac)

2. **"AWS credentials not found"**
   - Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set
   - Check AWS CLI is configured: `aws configure list`

3. **"Connection refused" during restore**
   - Verify DATABASE_URL is correct
   - Ensure database server is accessible
   - Check firewall rules

4. **"Permission denied" on S3**
   - Verify IAM policy has correct permissions
   - Check bucket policy doesn't deny access

5. **Large backup files**
   - Consider using `--format=custom` with pg_dump for better compression
   - Enable S3 Transfer Acceleration for faster uploads
   - Use multipart upload for files > 100MB (AWS CLI does this automatically)

### Debug Mode

Run scripts with verbose output:
```bash
bash -x ./scripts/backup-db.sh
bash -x ./scripts/restore-db.sh --latest
```

## Maintenance

### Monthly Tasks
- [ ] Review backup logs for any failures
- [ ] Test restore process on staging environment
- [ ] Verify retention policy is working (old backups deleted)
- [ ] Check backup sizes for unusual growth
- [ ] Review AWS S3 costs

### Quarterly Tasks
- [ ] Full disaster recovery drill
- [ ] Update AWS credentials if needed
- [ ] Review and update IAM policies
- [ ] Test backup encryption (if implemented)

## Contact & Support

For issues with the backup system:
1. Check logs in `logs/backup.log`
2. Review this documentation
3. Contact the DevOps team

## Changelog

- **2025-02-15**: Initial backup system implementation
- Tiered retention policy (daily/weekly/monthly)
- Automated daily backups at 2 AM UTC
- S3 storage with integrity verification
- Health check API endpoint
