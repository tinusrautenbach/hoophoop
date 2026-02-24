# Hasura Real-time Setup Guide

This guide covers setting up Hasura GraphQL Engine as a self-hosted alternative to Convex for real-time game state synchronization.

## Architecture

```
┌─────────────────┐     GraphQL      ┌──────────────────┐
│   Next.js App   │ ◄──────────────► │  Hasura GraphQL  │
│                 │   WebSocket      │     Engine       │
└─────────────────┘                  └────────┬─────────┘
       │                                      │
       │              ┌───────────────────────┘
       │              │ SQL
       │              ▼
       │       ┌──────────────┐
       └──────►│  PostgreSQL  │
               └──────────────┘
```

## Quick Start

### 1. Start Hasura and PostgreSQL

```bash
docker-compose -f docker-compose.hasura.yml up -d
```

### 2. Access Hasura Console

Open http://localhost:8080/console

Admin Secret: `myadminsecretkey`

### 3. Connect Your Database

If you already have a PostgreSQL database:
1. Go to "Data" tab in Hasura Console
2. Click "Connect Database"
3. Enter your database URL

### 4. Track Tables

1. Go to "Data" → "Manage" → "Track All"
2. Hasura will introspect your schema

## Configuration

### Environment Variables

Add to your `.env.local`:

```bash
# Hasura GraphQL Endpoint
NEXT_PUBLIC_HASURA_URL=http://localhost:8080/v1/graphql

# For production (with SSL)
# NEXT_PUBLIC_HASURA_URL=https://your-hasura-instance.com/v1/graphql

# Hasura Admin Secret (server-side only)
HASURA_ADMIN_SECRET=myadminsecretkey

# JWT Secret (for authentication)
HASURA_JWT_SECRET=your-clerk-jwks-url
```

### Authentication Setup

Hasura supports JWT-based authentication. With Clerk:

1. Get your JWKS URL from Clerk Dashboard
2. Update `docker-compose.hasura.yml`:
   ```yaml
   HASURA_GRAPHQL_JWT_SECRET: '{"type":"RS256","jwk_url":"https://clerk.your-domain.com/.well-known/jwks.json"}'
   ```

3. Configure permissions in Hasura Console based on `x-hasura-user-id` claim

## Real-time Subscriptions

### Example: Subscribe to Game State

```graphql
subscription GetGameState($gameId: uuid!) {
  games_by_pk(id: $gameId) {
    id
    homeScore
    guestScore
    clockSeconds
    isTimerRunning
    homeFouls
    guestFouls
    status
  }
}
```

### Example: Subscribe to Game Events

```graphql
subscription GetGameEvents($gameId: uuid!, $limit: Int = 50) {
  gameEvents(
    where: { gameId: { _eq: $gameId } }
    order_by: { createdAt: desc }
    limit: $limit
  ) {
    id
    type
    team
    player
    value
    description
    createdAt
  }
}
```

### Example: Subscribe to Timer State

```graphql
subscription GetTimerState($gameId: uuid!) {
  timerSync_by_pk(gameId: $gameId) {
    gameId
    isRunning
    startedAt
    currentClockSeconds
  }
}
```

## Mutations

### Update Game State

```graphql
mutation UpdateGameState($gameId: uuid!, $updates: games_set_input!) {
  update_games_by_pk(pk_columns: { id: $gameId }, _set: $updates) {
    id
    homeScore
    guestScore
  }
}
```

### Add Game Event

```graphql
mutation AddGameEvent($event: gameEvents_insert_input!) {
  insert_gameEvents_one(object: $event) {
    id
    type
    description
  }
}
```

### Control Timer

```graphql
mutation ControlTimer($gameId: uuid!, $isRunning: Boolean!, $clockSeconds: Int) {
  update_timerSync_by_pk(
    pk_columns: { gameId: $gameId }
    _set: { isRunning: $isRunning, currentClockSeconds: $clockSeconds }
  ) {
    gameId
    isRunning
    currentClockSeconds
  }
}
```

## Permissions

Set up row-level security in Hasura Console:

### Games Table

**Select**: Allow if `visibility = 'public_general'` OR `ownerId = x-hasura-user-id`

**Update**: Allow if `ownerId = x-hasura-user-id`

### Game Events Table

**Select**: Allow if game is public or user is owner

**Insert**: Allow if user is authenticated

## Event Triggers (Optional)

Set up webhooks for server-side logic:

1. Go to "Events" tab in Hasura Console
2. Create event trigger on `gameEvents` table
3. Configure webhook URL (e.g., `/api/webhooks/game-event`)

## Production Deployment

### Option 1: Self-hosted with Docker

```bash
# Update environment variables for production
docker-compose -f docker-compose.hasura.yml -f docker-compose.prod.yml up -d
```

### Option 2: Hasura Cloud (Managed)

1. Sign up at https://hasura.io/cloud
2. Create a new project
3. Connect your PostgreSQL database
4. Deploy your metadata:
   ```bash
   hasura metadata apply --endpoint https://your-project.hasura.app --admin-secret your-admin-secret
   ```

### Option 3: Kubernetes

See [Hasura Kubernetes Deployment](https://hasura.io/docs/latest/deployment/deployment-guides/kubernetes/)

## Monitoring

- Check Hasura Console "Monitoring" tab
- Set up Prometheus/Grafana for metrics
- Enable query logging for debugging

## Migration from Socket.io

1. Replace `useSocket` with `useHasuraGame`
2. Replace socket events with GraphQL subscriptions
3. Replace socket emits with GraphQL mutations
4. Remove Socket.io server code

See `REALTIME_MIGRATION.md` for detailed migration guide.

## Resources

- [Hasura Documentation](https://hasura.io/docs/latest/index/)
- [GraphQL Subscriptions](https://hasura.io/docs/latest/subscriptions/overview/)
- [Authorization](https://hasura.io/docs/latest/auth/overview/)
- [Event Triggers](https://hasura.io/docs/latest/event-triggers/overview/)
