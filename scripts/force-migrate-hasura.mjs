import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HASURA_URL = process.env.NEXT_PUBLIC_HASURA_URL?.replace('/v1/graphql', '') || 'http://hasura:8080';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'myadminsecretkey';

// Helper function for fetch with retries
async function fetchWithRetry(url, options, maxRetries = 5) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (err) {
            lastError = err;
            const delay = Math.min(1000 * Math.pow(2, i), 10000);
            console.log(`[Hasura] Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

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
        console.log('[ForceMigrate] All 3 Hasura tables exist in database.');
        await sql.end();
        
        // Now ensure they're tracked in Hasura
        await trackTablesInHasura();
        return;
    }
    
    console.log(`[ForceMigrate] Found only ${tables.length}/3 tables. Creating them...`);
    
    // Read and apply the migration SQL directly
    const migrationPath = join(__dirname, '..', 'drizzle', 'migrations', '0016_add_hasura_sync_tables.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');
    
    console.log('[ForceMigrate] Executing 0016_add_hasura_sync_tables.sql...');
    
    try {
        // Execute the SQL directly
        await sql.unsafe(migrationSql);
        console.log('[ForceMigrate] Tables created successfully!');
    } catch (err) {
        // Ignore "already exists" errors, fail on others
        if (err.message && (err.message.includes('already exists') || err.message.includes('duplicate'))) {
            console.log('[ForceMigrate] Some objects already exist (OK)');
        } else {
            console.error('[ForceMigrate] Error:', err.message);
            throw err;
        }
    }
    
    await sql.end();
    
    // Track tables in Hasura
    await trackTablesInHasura();
    
    console.log('[ForceMigrate] Complete!');
};

async function waitForHasura(maxAttempts = 30) {
    console.log('[Hasura] Waiting for Hasura to be ready...');
    
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(`${HASURA_URL}/healthz`, { method: 'GET' });
            if (response.ok) {
                console.log('[Hasura] Hasura is ready!');
                // Add a small delay after healthz passes to ensure Hasura is fully initialized
                await new Promise(resolve => setTimeout(resolve, 2000));
                return true;
            }
        } catch (err) {}
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        process.stdout.write('.');
    }
    
    throw new Error('Hasura failed to become ready');
}

async function trackTablesInHasura() {
    console.log('[Hasura] Tracking tables in Hasura...');
    
    await waitForHasura();
    
    // Retry the entire tracking process up to 3 times
    for (let attempt = 0; attempt < 3; attempt++) {
        console.log(`[Hasura] Tracking attempt ${attempt + 1}/3...`);
        
        try {
            // First track game_states
            await trackSingleTable('game_states', 'gameStates', {
                select: 'gameStates',
                select_by_pk: 'gameStatesByPk',
                select_aggregate: 'gameStatesAggregate',
                insert: 'insertGameStates',
                insert_one: 'insertGameStatesOne',
                update: 'updateGameStates',
                update_by_pk: 'updateGameStatesByPk',
                delete: 'deleteGameStates',
                delete_by_pk: 'deleteGameStatesByPk'
            }, {
                game_id: { custom_name: 'gameId' },
                home_score: { custom_name: 'homeScore' },
                guest_score: { custom_name: 'guestScore' },
                home_fouls: { custom_name: 'homeFouls' },
                guest_fouls: { custom_name: 'guestFouls' },
                home_timeouts: { custom_name: 'homeTimeouts' },
                guest_timeouts: { custom_name: 'guestTimeouts' },
                clock_seconds: { custom_name: 'clockSeconds' },
                is_timer_running: { custom_name: 'isTimerRunning' },
                current_period: { custom_name: 'currentPeriod' },
                updated_at: { custom_name: 'updatedAt' },
                updated_by: { custom_name: 'updatedBy' }
            }, ['game_id', 'home_score', 'guest_score', 'home_fouls', 'guest_fouls', 
                'home_timeouts', 'guest_timeouts', 'clock_seconds', 'is_timer_running',
                'current_period', 'possession', 'status', 'updated_at', 'updated_by']);
            
            // Then track hasura_game_events
            await trackSingleTable('hasura_game_events', 'gameEvents', {
                select: 'gameEvents',
                select_by_pk: 'gameEventsByPk',
                select_aggregate: 'gameEventsAggregate',
                insert: 'insertGameEvents',
                insert_one: 'insertGameEventsOne',
                update: 'updateGameEvents',
                update_by_pk: 'updateGameEventsByPk',
                delete: 'deleteGameEvents',
                delete_by_pk: 'deleteGameEventsByPk'
            }, {
                game_id: { custom_name: 'gameId' },
                event_id: { custom_name: 'eventId' },
                clock_at: { custom_name: 'clockAt' },
                created_at: { custom_name: 'createdAt' },
                created_by: { custom_name: 'createdBy' }
            }, ['id', 'game_id', 'event_id', 'type', 'period', 'clock_at', 'team', 
                'player', 'value', 'metadata', 'description', 'created_at', 'created_by']);
            
            // Finally track timer_sync
            await trackSingleTable('timer_sync', 'timerSync', {
                select: 'timerSync',
                select_by_pk: 'timerSyncByPk',
                select_aggregate: 'timerSyncAggregate',
                insert: 'insertTimerSync',
                insert_one: 'insertTimerSyncOne',
                update: 'updateTimerSync',
                update_by_pk: 'updateTimerSyncByPk',
                delete: 'deleteTimerSync',
                delete_by_pk: 'deleteTimerSyncByPk'
            }, {
                game_id: { custom_name: 'gameId' },
                is_running: { custom_name: 'isRunning' },
                started_at: { custom_name: 'startedAt' },
                initial_clock_seconds: { custom_name: 'initialClockSeconds' },
                current_clock_seconds: { custom_name: 'currentClockSeconds' },
                updated_at: { custom_name: 'updatedAt' },
                updated_by: { custom_name: 'updatedBy' }
            }, ['game_id', 'is_running', 'started_at', 'initial_clock_seconds', 
                'current_clock_seconds', 'updated_at', 'updated_by']);
            
            console.log('[Hasura] All tables tracked successfully!');
            return;
            
        } catch (err) {
            console.error(`[Hasura] Attempt ${attempt + 1} failed:`, err.message);
            if (attempt < 2) {
                console.log('[Hasura] Waiting 5s before retry...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    
    console.error('[Hasura] Failed to track tables after all attempts');
}

async function trackSingleTable(tableName, customName, rootFields, columnConfig, columns) {
    console.log(`[Hasura] Tracking table: ${tableName}...`);
    
    try {
        // Track the table with retries
        const trackResponse = await fetchWithRetry(`${HASURA_URL}/v1/metadata`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                type: 'pg_track_table',
                args: {
                    table: { schema: 'public', name: tableName },
                    configuration: {
                        custom_name: customName,
                        custom_root_fields: rootFields,
                        column_config: columnConfig
                    }
                }
            })
        });
        
        const trackResult = await trackResponse.text();
        
        if (trackResponse.ok) {
            console.log(`[Hasura] ✓ Successfully tracked ${tableName}`);
        } else if (trackResult.includes('already tracked') || trackResult.includes('already exists')) {
            console.log(`[Hasura] ✓ ${tableName} already tracked`);
        } else {
            console.error(`[Hasura] ✗ Error tracking ${tableName}:`, trackResult.substring(0, 200));
            throw new Error(`Failed to track ${tableName}`);
        }
        
        // Small delay between tracking and permissions
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Set select permissions
        console.log(`[Hasura] Setting select permissions for ${tableName}...`);
        const selectResponse = await fetchWithRetry(`${HASURA_URL}/v1/metadata`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                type: 'pg_create_select_permission',
                args: {
                    table: { schema: 'public', name: tableName },
                    role: 'anonymous',
                    permission: {
                        columns: columns,
                        filter: {},
                        allow_aggregations: true
                    }
                }
            })
        });
        
        if (selectResponse.ok || (await selectResponse.text()).includes('already exists')) {
            console.log(`[Hasura] ✓ Select permissions for ${tableName}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Set insert permissions
        console.log(`[Hasura] Setting insert permissions for ${tableName}...`);
        const insertResponse = await fetchWithRetry(`${HASURA_URL}/v1/metadata`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                type: 'pg_create_insert_permission',
                args: {
                    table: { schema: 'public', name: tableName },
                    role: 'anonymous',
                    permission: {
                        check: {},
                        columns: columns
                    }
                }
            })
        });
        
        if (insertResponse.ok || (await insertResponse.text()).includes('already exists')) {
            console.log(`[Hasura] ✓ Insert permissions for ${tableName}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Set update permissions
        console.log(`[Hasura] Setting update permissions for ${tableName}...`);
        const updateResponse = await fetchWithRetry(`${HASURA_URL}/v1/metadata`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                type: 'pg_create_update_permission',
                args: {
                    table: { schema: 'public', name: tableName },
                    role: 'anonymous',
                    permission: {
                        columns: columns,
                        filter: {},
                        check: {}
                    }
                }
            })
        });
        
        if (updateResponse.ok || (await updateResponse.text()).includes('already exists')) {
            console.log(`[Hasura] ✓ Update permissions for ${tableName}`);
        }
        
        console.log(`[Hasura] ✓ ${tableName} setup complete`);
        
    } catch (err) {
        console.error(`[Hasura] ✗ Failed to track ${tableName}:`, err.message);
        throw err;
    }
}

runForceMigrate().catch((err) => {
    console.error('[ForceMigrate] Failed:', err);
    // Don't exit with error - let the app try to start anyway
    console.log('[ForceMigrate] Continuing despite errors...');
    process.exit(0);
});
