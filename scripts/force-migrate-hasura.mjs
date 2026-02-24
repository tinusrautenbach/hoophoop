import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HASURA_URL = process.env.NEXT_PUBLIC_HASURA_URL?.replace('/v1/graphql', '') || 'http://hasura:8080';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'myadminsecretkey';

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
    
    const tables = [
        {
            table: { schema: 'public', name: 'game_states' },
            configuration: {
                custom_name: 'gameStates',
                custom_root_fields: {
                    select: 'gameStates',
                    select_by_pk: 'gameStatesByPk',
                    select_aggregate: 'gameStatesAggregate',
                    insert: 'insertGameStates',
                    insert_one: 'insertGameStatesOne',
                    update: 'updateGameStates',
                    update_by_pk: 'updateGameStatesByPk',
                    delete: 'deleteGameStates',
                    delete_by_pk: 'deleteGameStatesByPk'
                },
                column_config: {
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
                }
            }
        },
        {
            table: { schema: 'public', name: 'hasura_game_events' },
            configuration: {
                custom_name: 'gameEvents',
                custom_root_fields: {
                    select: 'gameEvents',
                    select_by_pk: 'gameEventsByPk',
                    select_aggregate: 'gameEventsAggregate',
                    insert: 'insertGameEvents',
                    insert_one: 'insertGameEventsOne',
                    update: 'updateGameEvents',
                    update_by_pk: 'updateGameEventsByPk',
                    delete: 'deleteGameEvents',
                    delete_by_pk: 'deleteGameEventsByPk'
                },
                column_config: {
                    game_id: { custom_name: 'gameId' },
                    event_id: { custom_name: 'eventId' },
                    clock_at: { custom_name: 'clockAt' },
                    created_at: { custom_name: 'createdAt' },
                    created_by: { custom_name: 'createdBy' }
                }
            }
        },
        {
            table: { schema: 'public', name: 'timer_sync' },
            configuration: {
                custom_name: 'timerSync',
                custom_root_fields: {
                    select: 'timerSync',
                    select_by_pk: 'timerSyncByPk',
                    select_aggregate: 'timerSyncAggregate',
                    insert: 'insertTimerSync',
                    insert_one: 'insertTimerSyncOne',
                    update: 'updateTimerSync',
                    update_by_pk: 'updateTimerSyncByPk',
                    delete: 'deleteTimerSync',
                    delete_by_pk: 'deleteTimerSyncByPk'
                },
                column_config: {
                    game_id: { custom_name: 'gameId' },
                    is_running: { custom_name: 'isRunning' },
                    started_at: { custom_name: 'startedAt' },
                    initial_clock_seconds: { custom_name: 'initialClockSeconds' },
                    current_clock_seconds: { custom_name: 'currentClockSeconds' },
                    updated_at: { custom_name: 'updatedAt' },
                    updated_by: { custom_name: 'updatedBy' }
                }
            }
        }
    ];

    // Track each table
    for (const tableConfig of tables) {
        try {
            console.log(`[Hasura] Tracking table: ${tableConfig.table.name}...`);
            
            const response = await fetch(`${HASURA_URL}/v1/metadata`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    type: 'pg_track_table',
                    args: tableConfig
                })
            });
            
            const result = await response.text();
            
            if (response.ok) {
                console.log(`[Hasura] ✓ Successfully tracked ${tableConfig.table.name}`);
            } else if (result.includes('already tracked') || result.includes('already exists')) {
                console.log(`[Hasura] ✓ ${tableConfig.table.name} already tracked`);
            } else {
                console.error(`[Hasura] ✗ Error tracking ${tableConfig.table.name}:`, result.substring(0, 200));
            }
        } catch (err) {
            console.error(`[Hasura] ✗ Failed to track ${tableConfig.table.name}:`, err.message);
        }
    }
    
    // Set permissions
    await setPermissions();
    
    console.log('[Hasura] Table tracking complete!');
}

async function setPermissions() {
    console.log('[Hasura] Setting permissions...');
    
    const permissions = [
        {
            table: { schema: 'public', name: 'game_states' },
            columns: ['game_id', 'home_score', 'guest_score', 'home_fouls', 'guest_fouls', 
                      'home_timeouts', 'guest_timeouts', 'clock_seconds', 'is_timer_running',
                      'current_period', 'possession', 'status', 'updated_at', 'updated_by']
        },
        {
            table: { schema: 'public', name: 'hasura_game_events' },
            columns: ['id', 'game_id', 'event_id', 'type', 'period', 'clock_at', 'team', 
                      'player', 'value', 'metadata', 'description', 'created_at', 'created_by']
        },
        {
            table: { schema: 'public', name: 'timer_sync' },
            columns: ['game_id', 'is_running', 'started_at', 'initial_clock_seconds', 
                      'current_clock_seconds', 'updated_at', 'updated_by']
        }
    ];
    
    for (const perm of permissions) {
        try {
            // Select permissions
            const selectResponse = await fetch(`${HASURA_URL}/v1/metadata`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    type: 'pg_create_select_permission',
                    args: {
                        table: perm.table,
                        role: 'anonymous',
                        permission: {
                            columns: perm.columns,
                            filter: {},
                            allow_aggregations: true
                        }
                    }
                })
            });
            
            if (selectResponse.ok || (await selectResponse.text()).includes('already exists')) {
                console.log(`[Hasura] ✓ Select permissions for ${perm.table.name}`);
            }
            
            // Insert permissions
            const insertResponse = await fetch(`${HASURA_URL}/v1/metadata`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    type: 'pg_create_insert_permission',
                    args: {
                        table: perm.table,
                        role: 'anonymous',
                        permission: {
                            check: {},
                            columns: perm.columns
                        }
                    }
                })
            });
            
            if (insertResponse.ok || (await insertResponse.text()).includes('already exists')) {
                console.log(`[Hasura] ✓ Insert permissions for ${perm.table.name}`);
            }
            
            // Update permissions
            const updateResponse = await fetch(`${HASURA_URL}/v1/metadata`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    type: 'pg_create_update_permission',
                    args: {
                        table: perm.table,
                        role: 'anonymous',
                        permission: {
                            columns: perm.columns,
                            filter: {},
                            check: {}
                        }
                    }
                })
            });
            
            if (updateResponse.ok || (await updateResponse.text()).includes('already exists')) {
                console.log(`[Hasura] ✓ Update permissions for ${perm.table.name}`);
            }
            
        } catch (err) {
            console.error(`[Hasura] ✗ Permissions error for ${perm.table.name}:`, err.message);
        }
    }
}

runForceMigrate().catch((err) => {
    console.error('[ForceMigrate] Failed:', err);
    // Don't exit with error - let the app try to start anyway
    console.log('[ForceMigrate] Continuing despite errors...');
    process.exit(0);
});
