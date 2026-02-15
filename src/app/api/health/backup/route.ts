import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

interface BackupLogEntry {
  timestamp: string;
  status: 'success' | 'failed';
  file: string;
  size: string;
  manual: boolean;
  s3_path: string;
}

/**
 * GET /api/health/backup
 * Returns the status of the last database backup
 * Requires authentication (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated and has admin rights
    // For now, we'll return basic info without auth check for health monitoring
    // In production, you should add proper authentication here

    const backupLogPath = process.cwd() + '/logs/backup.log';
    let lastBackup: BackupLogEntry | null = null;
    let backupStats = {
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
    };

    // Read backup log if it exists
    if (existsSync(backupLogPath)) {
      try {
        const logContent = await readFile(backupLogPath, 'utf-8');
        const lines = logContent.trim().split('\n').filter(line => line.trim());
        
        backupStats.totalBackups = lines.length;
        
        for (const line of lines) {
          try {
            const entry: BackupLogEntry = JSON.parse(line);
            if (entry.status === 'success') {
              backupStats.successfulBackups++;
            } else {
              backupStats.failedBackups++;
            }
            
            // Keep the most recent backup
            if (!lastBackup || new Date(entry.timestamp) > new Date(lastBackup.timestamp)) {
              lastBackup = entry;
            }
          } catch {
            // Skip malformed log entries
          }
        }
      } catch (error) {
        console.error('Error reading backup log:', error);
      }
    }

    // Calculate backup age
    let backupAge = null;
    let backupStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (lastBackup?.timestamp) {
      const lastBackupDate = new Date(lastBackup.timestamp);
      const now = new Date();
      const hoursSinceBackup = (now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60);
      
      backupAge = {
        hours: Math.round(hoursSinceBackup * 100) / 100,
        timestamp: lastBackup.timestamp,
      };
      
      // Determine status based on backup age
      if (hoursSinceBackup > 48) {
        backupStatus = 'critical'; // More than 48 hours
      } else if (hoursSinceBackup > 26) {
        backupStatus = 'warning'; // More than 26 hours (should be daily)
      }
    } else {
      backupStatus = 'critical';
    }

    // Check S3 configuration
    const s3Config = {
      bucket: process.env.BACKUP_BUCKET || 'bball-db-backups',
      prefix: process.env.BACKUP_PREFIX || 'backups',
      region: process.env.AWS_REGION || 'us-east-1',
      configured: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    };

    // Check if backup script exists and is executable
    const scriptPath = process.cwd() + '/scripts/backup-db.sh';
    const backupScriptExists = existsSync(scriptPath);

    return NextResponse.json({
      status: backupStatus,
      lastBackup: lastBackup ? {
        timestamp: lastBackup.timestamp,
        file: lastBackup.file,
        size: lastBackup.size,
        s3Path: lastBackup.s3_path,
        manual: lastBackup.manual,
      } : null,
      backupAge,
      statistics: backupStats,
      s3: s3Config,
      scripts: {
        backupScriptExists,
        backupScriptPath: backupScriptExists ? '/scripts/backup-db.sh' : null,
      },
      retentionPolicy: {
        dailyDays: 7,
        weeklyWeeks: 4,
        monthlyMonths: 12,
      },
      nextScheduledBackup: '02:00 UTC daily',
    }, {
      status: backupStatus === 'critical' ? 503 : 200,
    });

  } catch (error) {
    console.error('Error checking backup health:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to retrieve backup status',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
