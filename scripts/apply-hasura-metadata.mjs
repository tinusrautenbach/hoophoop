#!/usr/bin/env node
/**
 * Apply Hasura Metadata
 * 
 * This script applies Hasura metadata automatically on startup.
 * It uses the Hasura Metadata API to track tables and apply permissions.
 */

const HASURA_URL = process.env.NEXT_PUBLIC_HASURA_URL?.replace('/v1/graphql', '') || 'http://localhost:8080';
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'myadminsecretkey';

const METADATA_API = `${HASURA_URL}/v1/metadata`;

// Table definitions for Hasura
const TABLES = [
  {
    table: { schema: 'public', name: 'game_states' },
    configuration: {
      custom_name: 'gameStates',
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

async function waitForHasura(maxAttempts = 30) {
  console.log('[Hasura] Waiting for Hasura to be ready...');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${HASURA_URL}/healthz`, {
        method: 'GET'
      });
      
      if (response.ok) {
        console.log('[Hasura] Hasura is ready!');
        return true;
      }
    } catch (err) {
      // Hasura not ready yet, wait and retry
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    process.stdout.write('.');
  }
  
  throw new Error('Hasura failed to become ready within timeout');
}

async function applyMetadata() {
  console.log('[Hasura] Applying metadata...');
  
  for (const tableConfig of TABLES) {
    try {
      // Track the table
      const response = await fetch(METADATA_API, {
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
      
      if (!response.ok) {
        const error = await response.text();
        // Table might already be tracked, that's OK
        if (error.includes('already tracked') || error.includes('already exists')) {
          console.log(`[Hasura] Table ${tableConfig.table.name} already tracked`);
        } else {
          console.error(`[Hasura] Error tracking ${tableConfig.table.name}:`, error);
        }
      } else {
        console.log(`[Hasura] Tracked table: ${tableConfig.table.name}`);
      }
    } catch (err) {
      console.error(`[Hasura] Failed to track ${tableConfig.table.name}:`, err.message);
    }
  }
  
  // Set permissions for anonymous role
  await setPermissions();
  
  console.log('[Hasura] Metadata application complete!');
}

async function setPermissions() {
  console.log('[Hasura] Setting permissions...');
  
  const permissions = [
    {
      table: { schema: 'public', name: 'game_states' },
      role: 'anonymous',
      permission: {
        columns: ['game_id', 'home_score', 'guest_score', 'home_fouls', 'guest_fouls', 
                  'home_timeouts', 'guest_timeouts', 'clock_seconds', 'is_timer_running',
                  'current_period', 'possession', 'status', 'updated_at', 'updated_by'],
        filter: {},
        allow_aggregations: true
      }
    },
    {
      table: { schema: 'public', name: 'hasura_game_events' },
      role: 'anonymous',
      permission: {
        columns: ['id', 'game_id', 'event_id', 'type', 'period', 'clock_at', 'team', 
                  'player', 'value', 'metadata', 'description', 'created_at', 'created_by'],
        filter: {},
        allow_aggregations: true
      }
    },
    {
      table: { schema: 'public', name: 'timer_sync' },
      role: 'anonymous',
      permission: {
        columns: ['game_id', 'is_running', 'started_at', 'initial_clock_seconds', 
                  'current_clock_seconds', 'updated_at', 'updated_by'],
        filter: {},
        allow_aggregations: true
      }
    }
  ];
  
  for (const perm of permissions) {
    try {
      // Set select permissions
      const response = await fetch(METADATA_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
          type: 'pg_create_select_permission',
          args: {
            table: perm.table,
            role: perm.role,
            permission: perm.permission
          }
        })
      });
      
      if (response.ok) {
        console.log(`[Hasura] Set select permissions for ${perm.table.name}`);
      } else {
        const error = await response.text();
        if (!error.includes('already exists')) {
          console.error(`[Hasura] Error setting permissions for ${perm.table.name}:`, error);
        }
      }
      
      // Set insert permissions
      const insertResponse = await fetch(METADATA_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
          type: 'pg_create_insert_permission',
          args: {
            table: perm.table,
            role: perm.role,
            permission: {
              check: {},
              columns: perm.permission.columns
            }
          }
        })
      });
      
      if (insertResponse.ok) {
        console.log(`[Hasura] Set insert permissions for ${perm.table.name}`);
      }
      
      // Set update permissions
      const updateResponse = await fetch(METADATA_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET
        },
        body: JSON.stringify({
          type: 'pg_create_update_permission',
          args: {
            table: perm.table,
            role: perm.role,
            permission: {
              columns: perm.permission.columns,
              filter: {},
              check: {}
            }
          }
        })
      });
      
      if (updateResponse.ok) {
        console.log(`[Hasura] Set update permissions for ${perm.table.name}`);
      }
      
    } catch (err) {
      console.error(`[Hasura] Failed to set permissions for ${perm.table.name}:`, err.message);
    }
  }
}

async function main() {
  try {
    await waitForHasura();
    await applyMetadata();
    process.exit(0);
  } catch (err) {
    console.error('[Hasura] Metadata application failed:', err);
    process.exit(1);
  }
}

main();
