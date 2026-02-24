#!/usr/bin/env node
/**
 * Force apply Hasura sync tables migration
 * 
 * This script bypasses Drizzle's migration tracking and directly
 * applies the 0016 migration if the tables don't exist.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const runForceMigrate = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not defined');
    }

    const connectionString = process.env.DATABASE_URL;
    const sql = postgres(connectionString, { max: 1 });

    console.log('[ForceMigrate] Checking if Hasura tables exist...');
    
    // Check if tables exist
    const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('game_states', 'hasura_game_events', 'timer_sync')
    `;
    
    if (tables.length === 3) {
        console.log('[ForceMigrate] All 3 Hasura tables already exist, skipping...');
        await sql.end();
        return;
    }
    
    console.log(`[ForceMigrate] Found only ${tables.length}/3 tables. Applying migration...`);
    
    // Read and apply the migration SQL directly
    const migrationPath = join(__dirname, '..', 'drizzle', 'migrations', '0016_add_hasura_sync_tables.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');
    
    console.log('[ForceMigrate] Executing 0016_add_hasura_sync_tables.sql...');
    
    try {
        // Execute the SQL directly
        await sql.unsafe(migrationSql);
        console.log('[ForceMigrate] Migration applied successfully!');
    } catch (err) {
        // Ignore "already exists" errors, fail on others
        if (err.message && (err.message.includes('already exists') || err.message.includes('duplicate'))) {
            console.log('[ForceMigrate] Some objects already exist (OK)');
        } else {
            console.error('[ForceMigrate] Error:', err.message);
            throw err;
        }
    }
    
    // Verify tables were created
    const verifyTables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('game_states', 'hasura_game_events', 'timer_sync')
    `;
    
    console.log(`[ForceMigrate] Now found ${verifyTables.length}/3 tables: ${verifyTables.map(t => t.table_name).join(', ') || 'none'}`);
    
    if (verifyTables.length < 3) {
        console.error('[ForceMigrate] ERROR: Tables still missing after migration!');
        throw new Error('Migration failed to create tables');
    }
    
    await sql.end();
    console.log('[ForceMigrate] Complete!');
};

runForceMigrate().catch((err) => {
    console.error('[ForceMigrate] Failed:', err);
    process.exit(1);
});
