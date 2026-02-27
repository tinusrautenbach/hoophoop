import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HASURA_URL = process.env.HASURA_INTERNAL_URL || process.env.NEXT_PUBLIC_HASURA_URL?.replace('/v1/graphql', '') || 'http://hasura:8080';
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
                'current_period', 'possession', 'status', 'updated_at', 'updated_by'], {
                userSelectColumns: ['game_id', 'home_score', 'guest_score', 'home_fouls', 'guest_fouls',
                    'home_timeouts', 'guest_timeouts', 'clock_seconds', 'is_timer_running',
                    'current_period', 'possession', 'status', 'updated_at', 'updated_by'],
                userInsertColumns: ['game_id', 'home_score', 'guest_score', 'home_fouls', 'guest_fouls',
                    'home_timeouts', 'guest_timeouts', 'clock_seconds', 'is_timer_running',
                    'current_period', 'possession', 'status', 'updated_at', 'updated_by'],
                userUpdateColumns: ['home_score', 'guest_score', 'home_fouls', 'guest_fouls',
                    'home_timeouts', 'guest_timeouts', 'clock_seconds', 'is_timer_running',
                    'current_period', 'possession', 'status', 'updated_at', 'updated_by'],
                userDelete: true
            });
            
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
                'player', 'value', 'metadata', 'description', 'created_at', 'created_by'], {
                userSelectColumns: ['id', 'game_id', 'event_id', 'type', 'period', 'clock_at', 'team',
                    'player', 'value', 'metadata', 'description', 'created_at', 'created_by'],
                userInsertColumns: ['id', 'game_id', 'event_id', 'type', 'period', 'clock_at', 'team',
                    'player', 'value', 'metadata', 'description', 'created_at', 'created_by'],
                userUpdateColumns: ['type', 'period', 'clock_at', 'team', 'player', 'value',
                    'metadata', 'description', 'created_at', 'created_by'],
                userDelete: true
            });
            
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
                'current_clock_seconds', 'updated_at', 'updated_by'], {
                userSelectColumns: ['game_id', 'is_running', 'started_at', 'initial_clock_seconds',
                    'current_clock_seconds', 'updated_at', 'updated_by'],
                userInsertColumns: ['game_id', 'is_running', 'started_at', 'initial_clock_seconds',
                    'current_clock_seconds', 'updated_at', 'updated_by'],
                userUpdateColumns: ['is_running', 'started_at', 'initial_clock_seconds',
                    'current_clock_seconds', 'updated_at', 'updated_by'],
                userDelete: true
            });

            // Track game_scorers — user role only (anonymous gets read-only SELECT)
            await trackSingleTable('game_scorers', null, null, {},
                ['id', 'game_id', 'user_id', 'role', 'joined_at', 'last_active_at'], {
                    userSelectColumns: ['id', 'game_id', 'user_id', 'role', 'joined_at', 'last_active_at'],
                    userInsertColumns: ['id', 'game_id', 'user_id', 'role', 'joined_at', 'last_active_at'],
                    userUpdateColumns: ['role', 'last_active_at'],
                    userDelete: true
                });
            console.log('[Hasura] All tables tracked successfully!');
            
            // Reload metadata so tables appear in GraphQL schema
            await reloadHasuraMetadata();
            return;
            
        } catch (err) {
            console.error(`[Hasura] Attempt ${attempt + 1} failed:`, err.message);
            if (attempt < 2) {
                console.log('[Hasura] Waiting 5s before retry...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    
    // Even if tracking had errors, try to reload metadata
    // (tables might have been tracked in previous attempts)
    await reloadHasuraMetadata();
    
    console.error('[Hasura] Failed to track tables after all attempts');
}

async function setPermission(type, tableName, role, permission) {
    const response = await fetchWithRetry(`${HASURA_URL}/v1/metadata`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({ type, args: { table: { schema: 'public', name: tableName }, role, permission } })
    });
    const text = await response.text();
    if (!response.ok && !text.includes('already exists') && !text.includes('already-exists')) {
        console.error(`[Hasura] ✗ ${type} for ${tableName}/${role}:`, text.substring(0, 200));
    } else {
        console.log(`[Hasura] ✓ ${type} for ${tableName}/${role}`);
    }
}

// options:
//   anonSelectColumns  - columns for anonymous SELECT (omit to skip)
//   userSelectColumns  - columns for user SELECT (omit to skip)
//   userInsertColumns  - columns for user INSERT (omit to skip)
//   userUpdateColumns  - columns for user UPDATE (omit to skip)
//   userDelete         - boolean, set user DELETE permission (omit to skip)
async function trackSingleTable(tableName, customName, rootFields, columnConfig, anonSelectColumns, opts = {}) {
    console.log(`[Hasura] Tracking table: ${tableName}...`);

    try {
        // Build track args — omit null/empty config for tables with no remapping
        const configuration = {};
        if (customName) configuration.custom_name = customName;
        if (rootFields) configuration.custom_root_fields = rootFields;
        if (columnConfig && Object.keys(columnConfig).length > 0) configuration.column_config = columnConfig;

        const trackResponse = await fetchWithRetry(`${HASURA_URL}/v1/metadata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET },
            body: JSON.stringify({
                type: 'pg_track_table',
                args: { table: { schema: 'public', name: tableName }, configuration }
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

        await new Promise(resolve => setTimeout(resolve, 500));

        // anonymous SELECT
        if (anonSelectColumns && anonSelectColumns.length > 0) {
            await setPermission('pg_create_select_permission', tableName, 'anonymous', {
                columns: anonSelectColumns, filter: {}, allow_aggregations: false
            });
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // user SELECT
        if (opts.userSelectColumns) {
            await setPermission('pg_create_select_permission', tableName, 'user', {
                columns: opts.userSelectColumns, filter: {}, allow_aggregations: true
            });
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // user INSERT
        if (opts.userInsertColumns) {
            await setPermission('pg_create_insert_permission', tableName, 'user', {
                check: {}, columns: opts.userInsertColumns
            });
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // user UPDATE
        if (opts.userUpdateColumns) {
            await setPermission('pg_create_update_permission', tableName, 'user', {
                columns: opts.userUpdateColumns, filter: {}, check: {}
            });
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // user DELETE
        if (opts.userDelete) {
            await setPermission('pg_create_delete_permission', tableName, 'user', { filter: {} });
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log(`[Hasura] ✓ ${tableName} setup complete`);

    } catch (err) {
        console.error(`[Hasura] ✗ Failed to track ${tableName}:`, err.message);
        throw err;
    }
}

async function reloadHasuraMetadata() {
    console.log('[Hasura] Reloading metadata to apply changes...');
    
    try {
        const response = await fetchWithRetry(`${HASURA_URL}/v1/metadata`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
            },
            body: JSON.stringify({
                type: 'reload_metadata',
                args: {
                    reload_sources: true
                }
            })
        });
        
        if (response.ok) {
            console.log('[Hasura] ✓ Metadata reloaded successfully');
        } else {
            const error = await response.text();
            console.error('[Hasura] ✗ Failed to reload metadata:', error.substring(0, 200));
        }
    } catch (err) {
        console.error('[Hasura] ✗ Error reloading metadata:', err.message);
    }
}

runForceMigrate().catch((err) => {
    console.error('[ForceMigrate] Failed:', err);
    // Don't exit with error - let the app try to start anyway
    console.log('[ForceMigrate] Continuing despite errors...');
    process.exit(0);
});
