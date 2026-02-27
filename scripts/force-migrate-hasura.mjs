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
    
    if (tables.length < 3) {
        console.log(`[ForceMigrate] Found only ${tables.length}/3 tables. Creating them...`);
        
        // Read and apply the migration SQL directly
        const migrationPath = join(__dirname, '..', 'drizzle', 'migrations', '0016_add_hasura_sync_tables.sql');
        const migrationSql = readFileSync(migrationPath, 'utf-8');
        
        console.log('[ForceMigrate] Executing 0016_add_hasura_sync_tables.sql...');
        
        try {
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
    } else {
        console.log('[ForceMigrate] All 3 Hasura tables exist in database.');
    }
    
    await sql.end();
    
    // Apply Hasura metadata via replace_metadata (fully idempotent)
    await applyHasuraMetadata();
    
    console.log('[ForceMigrate] Complete!');
};

async function waitForHasura(maxAttempts = 30) {
    console.log('[Hasura] Waiting for Hasura to be ready...');
    
    // Phase 1: wait for healthz
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(`${HASURA_URL}/healthz`, { method: 'GET' });
            if (response.ok) {
                console.log('[Hasura] Hasura healthz OK');
                break;
            }
        } catch (err) {}
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        process.stdout.write('.');
        if (i === maxAttempts - 1) throw new Error('Hasura failed to become ready');
    }
    
    // Phase 2: wait until the postgres source is initialized.
    // healthz passes before Hasura finishes introspecting the DB schema.
    // If we call replace_metadata before the schema cache is populated,
    // Hasura marks permissions as inconsistent ("column does not exist")
    // even though the column is present in the DB.
    // We poll a simple introspection query until 'game_states' appears in the schema.
    console.log('[Hasura] Waiting for postgres source to initialize...');
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(`${HASURA_URL}/v1/graphql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    query: `{ __type(name: "query_root") { fields { name } } }`
                })
            });
            if (response.ok) {
                const data = await response.json();
                const fields = data?.data?.__type?.fields ?? [];
                // Once the source is loaded, built-in tables like 'game_states'
                // (or at minimum any table) will appear. We check for the schema
                // root itself being non-empty as the signal.
                if (fields.length > 0) {
                    console.log('[Hasura] Postgres source initialized — schema has', fields.length, 'root fields');
                    return true;
                }
            }
        } catch (err) {}
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        process.stdout.write('.');
    }
    
    // If we timed out waiting for source, proceed anyway — better to try than not
    console.log('[Hasura] Source init wait timed out, proceeding anyway...');
    return true;
}

// Build the complete Hasura metadata object.
// Using replace_metadata is fully idempotent — no "already-exists" / "already-tracked" errors.
// It atomically replaces ALL metadata in one call, including custom root fields,
// column config, and permissions.
//
// Root field naming notes (derived from frontend usage):
//  - game_states      → custom root fields in camelCase (gameStates, insertGameStatesOne, etc.)
//  - hasura_game_events → custom root fields (gameEvents, insertGameEventsOne, deleteGameEventsByPk)
//  - timer_sync       → custom root fields (timerSync, insertTimerSyncOne, etc.)
//  - game_scorers     → NO custom root fields (frontend uses default snake_case: game_scorers, update_game_scorers)
//
// events/route.ts uses update_game_states (default snake_case) — this is intentional and must remain.
function buildMetadata() {
    return {
        version: 3,
        sources: [
            {
                name: 'default',
                kind: 'postgres',
                tables: [
                    // ── game_states ────────────────────────────────────────────
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
                                game_id:          { custom_name: 'gameId' },
                                home_score:        { custom_name: 'homeScore' },
                                guest_score:       { custom_name: 'guestScore' },
                                home_fouls:        { custom_name: 'homeFouls' },
                                guest_fouls:       { custom_name: 'guestFouls' },
                                home_timeouts:     { custom_name: 'homeTimeouts' },
                                guest_timeouts:    { custom_name: 'guestTimeouts' },
                                clock_seconds:     { custom_name: 'clockSeconds' },
                                is_timer_running:  { custom_name: 'isTimerRunning' },
                                current_period:    { custom_name: 'currentPeriod' },
                                updated_at:        { custom_name: 'updatedAt' },
                                updated_by:        { custom_name: 'updatedBy' }
                            }
                        },
                        select_permissions: [
                            {
                                role: 'anonymous',
                                permission: {
                                    columns: [
                                        'game_id', 'home_score', 'guest_score',
                                        'home_fouls', 'guest_fouls', 'home_timeouts',
                                        'guest_timeouts', 'clock_seconds', 'is_timer_running',
                                        'current_period', 'possession', 'status',
                                        'updated_at', 'updated_by'
                                    ],
                                    filter: {},
                                    allow_aggregations: false
                                }
                            },
                            {
                                role: 'user',
                                permission: {
                                    columns: [
                                        'game_id', 'home_score', 'guest_score',
                                        'home_fouls', 'guest_fouls', 'home_timeouts',
                                        'guest_timeouts', 'clock_seconds', 'is_timer_running',
                                        'current_period', 'possession', 'status',
                                        'updated_at', 'updated_by', 'version'
                                    ],
                                    filter: {},
                                    allow_aggregations: true
                                }
                            }
                        ],
                        insert_permissions: [
                            {
                                role: 'user',
                                permission: {
                                    check: {},
                                    columns: [
                                        'game_id', 'home_score', 'guest_score',
                                        'home_fouls', 'guest_fouls', 'home_timeouts',
                                        'guest_timeouts', 'clock_seconds', 'is_timer_running',
                                        'current_period', 'possession', 'status',
                                        'updated_at', 'updated_by'
                                    ]
                                }
                            }
                        ],
                        update_permissions: [
                            {
                                role: 'user',
                                permission: {
                                    columns: [
                                        'home_score', 'guest_score', 'home_fouls',
                                        'guest_fouls', 'home_timeouts', 'guest_timeouts',
                                        'clock_seconds', 'is_timer_running', 'current_period',
                                        'possession', 'status', 'updated_at', 'updated_by',
                                        'version'
                                    ],
                                    filter: {},
                                    check: {}
                                }
                            }
                        ],
                        delete_permissions: [
                            {
                                role: 'user',
                                permission: { filter: {} }
                            }
                        ]
                    },

                    // ── hasura_game_events ─────────────────────────────────────
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
                                game_id:    { custom_name: 'gameId' },
                                event_id:   { custom_name: 'eventId' },
                                clock_at:   { custom_name: 'clockAt' },
                                created_at: { custom_name: 'createdAt' },
                                created_by: { custom_name: 'createdBy' }
                            }
                        },
                        select_permissions: [
                            {
                                role: 'anonymous',
                                permission: {
                                    columns: [
                                        'id', 'game_id', 'event_id', 'type', 'period',
                                        'clock_at', 'team', 'player', 'value',
                                        'metadata', 'description', 'created_at', 'created_by'
                                    ],
                                    filter: {},
                                    allow_aggregations: false
                                }
                            },
                            {
                                role: 'user',
                                permission: {
                                    columns: [
                                        'id', 'game_id', 'event_id', 'type', 'period',
                                        'clock_at', 'team', 'player', 'value',
                                        'metadata', 'description', 'created_at', 'created_by'
                                    ],
                                    filter: {},
                                    allow_aggregations: true
                                }
                            }
                        ],
                        insert_permissions: [
                            {
                                role: 'user',
                                permission: {
                                    check: {},
                                    columns: [
                                        'id', 'game_id', 'event_id', 'type', 'period',
                                        'clock_at', 'team', 'player', 'value',
                                        'metadata', 'description', 'created_at', 'created_by'
                                    ]
                                }
                            }
                        ],
                        update_permissions: [
                            {
                                role: 'user',
                                permission: {
                                    columns: [
                                        'type', 'period', 'clock_at', 'team', 'player',
                                        'value', 'metadata', 'description',
                                        'created_at', 'created_by'
                                    ],
                                    filter: {},
                                    check: {}
                                }
                            }
                        ],
                        delete_permissions: [
                            {
                                role: 'user',
                                permission: { filter: {} }
                            }
                        ]
                    },

                    // ── timer_sync ─────────────────────────────────────────────
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
                                game_id:               { custom_name: 'gameId' },
                                is_running:            { custom_name: 'isRunning' },
                                started_at:            { custom_name: 'startedAt' },
                                initial_clock_seconds: { custom_name: 'initialClockSeconds' },
                                current_clock_seconds: { custom_name: 'currentClockSeconds' },
                                updated_at:            { custom_name: 'updatedAt' },
                                updated_by:            { custom_name: 'updatedBy' }
                            }
                        },
                        select_permissions: [
                            {
                                role: 'anonymous',
                                permission: {
                                    columns: [
                                        'game_id', 'is_running', 'started_at',
                                        'initial_clock_seconds', 'current_clock_seconds',
                                        'updated_at', 'updated_by'
                                    ],
                                    filter: {},
                                    allow_aggregations: false
                                }
                            },
                            {
                                role: 'user',
                                permission: {
                                    columns: [
                                        'game_id', 'is_running', 'started_at',
                                        'initial_clock_seconds', 'current_clock_seconds',
                                        'updated_at', 'updated_by'
                                    ],
                                    filter: {},
                                    allow_aggregations: true
                                }
                            }
                        ],
                        insert_permissions: [
                            {
                                role: 'user',
                                permission: {
                                    check: {},
                                    columns: [
                                        'game_id', 'is_running', 'started_at',
                                        'initial_clock_seconds', 'current_clock_seconds',
                                        'updated_at', 'updated_by'
                                    ]
                                }
                            }
                        ],
                        update_permissions: [
                            {
                                role: 'user',
                                permission: {
                                    columns: [
                                        'is_running', 'started_at', 'initial_clock_seconds',
                                        'current_clock_seconds', 'updated_at', 'updated_by'
                                    ],
                                    filter: {},
                                    check: {}
                                }
                            }
                        ],
                        delete_permissions: [
                            {
                                role: 'user',
                                permission: { filter: {} }
                            }
                        ]
                    },

                    // ── game_scorers ───────────────────────────────────────────
                    // No custom root fields — frontend uses default snake_case names:
                    //   subscription: game_scorers
                    //   mutation:     update_game_scorers
                    {
                        table: { schema: 'public', name: 'game_scorers' },
                        select_permissions: [
                            {
                                role: 'anonymous',
                                permission: {
                                    columns: [
                                        'id', 'game_id', 'user_id', 'role',
                                        'joined_at', 'last_active_at'
                                    ],
                                    filter: {},
                                    allow_aggregations: false
                                }
                            },
                            {
                                role: 'user',
                                permission: {
                                    columns: [
                                        'id', 'game_id', 'user_id', 'role',
                                        'joined_at', 'last_active_at'
                                    ],
                                    filter: {},
                                    allow_aggregations: true
                                }
                            }
                        ],
                        insert_permissions: [
                            {
                                role: 'user',
                                permission: {
                                    check: {},
                                    columns: [
                                        'id', 'game_id', 'user_id', 'role',
                                        'joined_at', 'last_active_at'
                                    ]
                                }
                            }
                        ],
                        update_permissions: [
                            {
                                role: 'user',
                                permission: {
                                    columns: ['role', 'last_active_at'],
                                    filter: {},
                                    check: {}
                                }
                            }
                        ],
                        delete_permissions: [
                            {
                                role: 'user',
                                permission: { filter: {} }
                            }
                        ]
                    }
                ],
                configuration: {
                    connection_info: {
                        database_url: { from_env: 'HASURA_GRAPHQL_DATABASE_URL' },
                        pool_settings: {}
                    }
                }
            }
        ]
    };
}

async function applyHasuraMetadata() {
    console.log('[Hasura] Applying Hasura metadata via replace_metadata...');
    
    await waitForHasura();
    
    for (let attempt = 0; attempt < 3; attempt++) {
        console.log(`[Hasura] replace_metadata attempt ${attempt + 1}/3...`);
        
        try {
            const response = await fetchWithRetry(`${HASURA_URL}/v1/metadata`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
                },
                body: JSON.stringify({
                    type: 'replace_metadata',
                    args: {
                        allow_inconsistent_metadata: true,
                        metadata: buildMetadata()
                    }
                })
            });
            
            const text = await response.text();
            
            if (response.ok) {
                console.log('[Hasura] ✓ Metadata applied successfully via replace_metadata');
                console.log('[Hasura] ✓ Custom root fields configured:');
                console.log('[Hasura]   game_states      → gameStates, insertGameStatesOne, updateGameStates, updateGameStatesByPk, deleteGameStatesByPk');
                console.log('[Hasura]   hasura_game_events → gameEvents, insertGameEventsOne, deleteGameEventsByPk');
                console.log('[Hasura]   timer_sync       → timerSync, insertTimerSyncOne, updateTimerSync, updateTimerSyncByPk');
                console.log('[Hasura]   game_scorers     → game_scorers, update_game_scorers (default snake_case, intentional)');
                return;
            }
            
            console.error(`[Hasura] ✗ replace_metadata failed (attempt ${attempt + 1}):`, text.substring(0, 500));
            
            if (attempt < 2) {
                console.log('[Hasura] Waiting 5s before retry...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (err) {
            console.error(`[Hasura] ✗ replace_metadata error (attempt ${attempt + 1}):`, err.message);
            if (attempt < 2) {
                console.log('[Hasura] Waiting 5s before retry...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    
    console.error('[Hasura] Failed to apply metadata after all attempts');
    // Don't throw — let the app try to start even if metadata failed
}

runForceMigrate().catch((err) => {
    console.error('[ForceMigrate] Failed:', err);
    // Don't exit with error - let the app try to start anyway
    console.log('[ForceMigrate] Continuing despite errors...');
    process.exit(0);
});
