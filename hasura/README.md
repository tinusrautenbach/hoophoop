# Hasura GraphQL Engine Setup

This directory contains the Hasura GraphQL Engine configuration for real-time game state synchronization.

## Overview

Hasura provides GraphQL subscriptions that enable real-time updates across all connected clients during live basketball games. This is used for:

- **Game State Sync**: Real-time score, fouls, timeouts, and clock updates
- **Game Events**: Live play-by-play event streaming
- **Timer Synchronization**: Distributed game clock management

## Architecture

### Tables

Three dedicated tables are used for Hasura real-time sync:

1. **game_states**: Current game state (score, fouls, timeouts, period, possession)
2. **hasura_game_events**: Game events for play-by-play (separate from `game_events` for optimization)
3. **timer_sync**: Timer state for distributed clock synchronization

These tables sync bidirectionally with the main `games` table via database triggers.

### Metadata

Hasura metadata is stored in `/hasura/metadata/` and defines:
- Database connection configuration
- Table relationships
- Permissions (anonymous and user roles)
- Custom GraphQL field names (camelCase)

## Configuration

### Environment Variables

Add these to your `.env.local` or `.env` file:

```bash
# Hasura GraphQL Endpoint (used by frontend)
NEXT_PUBLIC_HASURA_URL=http://localhost:8080/v1/graphql

# Hasura Admin Secret (for CLI and console access)
HASURA_ADMIN_SECRET=myadminsecretkey
```

### Docker Compose

Hasura is included in both `docker-compose.yml` (development) and `docker-compose.prod.yml` (production).

## Setup Instructions

### 1. Start the Services

```bash
docker-compose up -d
```

### 2. Apply Database Migrations

The Hasura sync tables are created by migration `0016_add_hasura_sync_tables.sql`:

```bash
npx drizzle-kit migrate
```

### 3. Apply Hasura Metadata

After the tables exist in the database, apply the Hasura metadata:

```bash
cd hasura
hasura metadata apply
```

Or manually through the console:
1. Open http://localhost:8080/console
2. Go to Data → Manage → Import metadata
3. Select the metadata files from `/hasura/metadata/`

### 4. Track Tables (if not auto-tracked)

1. Go to http://localhost:8080/console
2. Data → Manage → Track tables
3. Track: `game_states`, `hasura_game_events`, `timer_sync`

### 5. Permissions

Permissions are already configured in the metadata files for two roles:
- **`anonymous`**: `SELECT` only — unauthenticated spectators can read live game state
- **`user`**: Full `SELECT` / `INSERT` / `UPDATE` / `DELETE` — Clerk-authenticated scorers can mutate game state

This is enforced at the Hasura layer via the `HASURA_GRAPHQL_JWT_SECRET` env var (see docker-compose files)
and the `HASURA_GRAPHQL_UNAUTHORIZED_ROLE=anonymous` fallback for unauthenticated WebSocket connections.
## Usage

### Frontend Integration

The `useHasuraGame` hook in `/src/hooks/use-hasura-game.ts` provides:

```typescript
const {
  gameState,        // Current game state
  gameEvents,       // List of game events
  currentClock,     // Current clock time
  isConnected,      // WebSocket connection status
  updateScore,      // Update team score
  updateFouls,      // Update team fouls
  updateTimeouts,   // Update team timeouts
  startTimer,       // Start game clock
  stopTimer,        // Stop game clock
  addEvent,         // Add game event
  removeEvent,      // Remove game event
} = useHasuraGame(gameId);
```

### GraphQL Queries

The hook uses these GraphQL operations:

**Subscription - Game State:**
```graphql
subscription GetGameState($gameId: uuid!) {
  gameStates(where: { gameId: { _eq: $gameId } }) {
    gameId
    homeScore
    guestScore
    homeFouls
    guestFouls
    clockSeconds
    isTimerRunning
    currentPeriod
    possession
    status
  }
}
```

**Mutation - Update Game State:**
```graphql
mutation UpdateGameState($gameId: uuid!, $homeScore: Int, ...) {
  insert_gameStates_one(
    object: { gameId: $gameId, homeScore: $homeScore, ... }
    on_conflict: { constraint: gameStates_pkey, update_columns: [...] }
  ) {
    gameId
  }
}
```

## CLI Commands

Install Hasura CLI:
```bash
curl -L https://github.com/hasura/graphql-engine/raw/stable/cli/get.sh | bash
```

Apply metadata:
```bash
hasura metadata apply
```

Export metadata:
```bash
hasura metadata export
```

Reload metadata:
```bash
hasura metadata reload
```

## Troubleshooting

### Tables Not Visible in Console

1. Ensure database migrations have been applied
2. Check Data → Manage → Track tables
3. Verify the tables exist: `\dt game_states hasura_game_events timer_sync`

### Subscriptions Not Working

1. Check browser console for WebSocket errors
2. Verify `NEXT_PUBLIC_HASURA_URL` is set correctly
3. Check Hasura console: Events → Subscriptions

### Permission Denied Errors

1. Review permissions in the metadata YAML files
2. Ensure Row Level Security (RLS) policies are correct
3. Check the `HASURA_GRAPHQL_UNAUTHORIZED_ROLE` env var

## Security

Authentication is implemented via Clerk JWT. The setup is:

1. **`docker-compose.yml`** and **`docker-compose.prod.yml`** set `HASURA_GRAPHQL_JWT_SECRET` pointing to the
   Clerk JWKS endpoint (`{"type":"RS256","jwk_url":"..."}`).
2. **`HASURA_GRAPHQL_UNAUTHORIZED_ROLE: anonymous`** — unauthenticated WebSocket connections receive the
   read-only `anonymous` role, enabling spectating without login.
3. **`HasuraProvider.tsx`** — calls `registerTokenGetter()` with Clerk's `getToken` on mount. The Hasura
   WebSocket client and HTTP client both send `Authorization: Bearer <token>` automatically.
4. **`HASURA_ADMIN_SECRET`** is server-side only — never set `NEXT_PUBLIC_HASURA_ADMIN_SECRET`.

### Role Permissions Summary

| Table | anonymous | user |
|---|---|---|
| `game_states` | SELECT | SELECT, INSERT, UPDATE, DELETE |
| `hasura_game_events` | SELECT | SELECT, INSERT, UPDATE, DELETE |
| `timer_sync` | SELECT | SELECT, INSERT, UPDATE, DELETE |
## Resources

- [Hasura Documentation](https://hasura.io/docs/latest/index/)
- [GraphQL Subscriptions](https://hasura.io/docs/latest/subscriptions/overview/)
- [Row Level Security](https://hasura.io/docs/latest/auth/authorization/permissions/row-level-security/)
