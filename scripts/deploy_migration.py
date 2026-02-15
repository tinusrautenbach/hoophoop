#!/usr/bin/env python3
"""
Database migration deployment script for Hoophoop Basketball App.
This script applies SQL migrations to the PostgreSQL database.
"""

import os
import sys
import re
import psycopg2
from psycopg2 import sql
from pathlib import Path
from dotenv import load_dotenv

def parse_database_url(database_url: str) -> dict:
    """Parse PostgreSQL connection string into components."""
    # postgresql://user:password@host:port/database
    pattern = r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)'
    match = re.match(pattern, database_url)
    
    if not match:
        raise ValueError(f"Invalid DATABASE_URL format: {database_url}")
    
    user, password, host, port, database = match.groups()
    return {
        'user': user,
        'password': password,
        'host': host,
        'port': int(port),
        'database': database
    }

def get_db_connection(env_file_path: str = '.env'):
    """Create database connection from environment variables."""
    # Load environment variables from .env file
    load_dotenv(env_file_path)
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not found in environment variables")
    
    conn_params = parse_database_url(database_url)
    
    try:
        conn = psycopg2.connect(**conn_params)
        conn.autocommit = False  # We'll manage transactions manually
        print(f"✓ Connected to database: {conn_params['database']} at {conn_params['host']}")
        return conn
    except psycopg2.Error as e:
        print(f"✗ Failed to connect to database: {e}")
        sys.exit(1)

def execute_migration(conn, migration_file: str):
    """Execute a single migration file."""
    migration_path = Path(migration_file)
    
    if not migration_path.exists():
        print(f"✗ Migration file not found: {migration_file}")
        return False
    
    migration_name = migration_path.stem
    
    # Check if migration has already been applied
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cur.execute("SELECT name FROM _migrations WHERE name = %s", (migration_name,))
        if cur.fetchone():
            print(f"⚠ Migration already applied: {migration_name}")
            return False
    
    # Read and execute migration
    sql_content = migration_path.read_text()
    
    print(f"\n🔄 Applying migration: {migration_name}")
    print(f"   File: {migration_file}")
    
    try:
        with conn.cursor() as cur:
            # Execute the SQL
            cur.execute(sql_content)
            
            # Record migration
            cur.execute(
                "INSERT INTO _migrations (name) VALUES (%s)",
                (migration_name,)
            )
            
            conn.commit()
            print(f"✓ Migration applied successfully: {migration_name}")
            return True
            
    except psycopg2.Error as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
        return False

def list_pending_migrations(conn, migrations_dir: str = 'drizzle/migrations'):
    """List all pending migrations."""
    migrations_path = Path(migrations_dir)
    
    if not migrations_path.exists():
        print(f"✗ Migrations directory not found: {migrations_dir}")
        return []
    
    # Get applied migrations
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("SELECT name FROM _migrations")
        applied = {row[0] for row in cur.fetchall()}
    
    # Find all migration files
    all_migrations = sorted(migrations_path.glob('*.sql'))
    pending = [m for m in all_migrations if m.stem not in applied]
    
    return pending

def main():
    """Main deployment script."""
    # Get project root
    script_dir = Path(__file__).parent.absolute()
    project_root = script_dir.parent
    env_file = project_root / '.env'
    
    print("=" * 60)
    print("Hoophoop Database Migration Deployer")
    print("=" * 60)
    
    # Check if specific migration file provided
    if len(sys.argv) > 1:
        migration_file = sys.argv[1]
        if not Path(migration_file).is_absolute():
            migration_file = project_root / migration_file
    else:
        # Default to the latest player_claim_requests migration
        migration_file = project_root / 'drizzle/migrations/0015_player_claim_requests.sql'
    
    # Connect to database
    print(f"\n📡 Connecting to database...")
    conn = get_db_connection(str(env_file))
    
    try:
        # If a specific file was provided, execute it
        if len(sys.argv) > 1:
            success = execute_migration(conn, str(migration_file))
            if success:
                print("\n" + "=" * 60)
                print("✓ Migration deployed successfully!")
                print("=" * 60)
            else:
                print("\n" + "=" * 60)
                print("⚠ Migration was already applied or failed")
                print("=" * 60)
        else:
            # List and apply pending migrations
            print("\n📋 Checking for pending migrations...")
            pending = list_pending_migrations(conn, str(project_root / 'drizzle/migrations'))
            
            if not pending:
                print("✓ All migrations are up to date!")
            else:
                print(f"\n📦 Found {len(pending)} pending migration(s):")
                for m in pending:
                    print(f"   - {m.stem}")
                
                # Apply specific migration
                print(f"\n🚀 Applying: {migration_file}")
                success = execute_migration(conn, str(migration_file))
                
                if success:
                    print("\n" + "=" * 60)
                    print("✓ Migration deployed successfully!")
                    print("=" * 60)
                
    except Exception as e:
        print(f"\n✗ Error: {e}")
        sys.exit(1)
    finally:
        conn.close()
        print("\n🔒 Database connection closed.")

if __name__ == '__main__':
    main()
