# Convex Migration Guide

This document describes the migration from Socket.io to Convex for real-time game state synchronization in HoopHoop.

## Overview

We are migrating from a custom Socket.io implementation to Convex's reactive database for real-time game state management. This provides:

- **Automatic scaling**: No need for Redis adapter or manual connection management
- **Type safety**: End-to-end TypeScript from database to UI
- **Optimistic updates**: Instant UI feedback with automatic rollback on failure
- **Offline support**: Mutations queue when offline and sync when reconnected
- **Simplified architecture**: No separate socket server needed

## Migration Status

### Completed

- [x] Convex schema definition (`convex/schema.ts`)
- [x] Backend queries and mutations (`convex/games.ts`)
- [x] ConvexClientProvider for Next.js integration
- [x] useConvexGame hook to replace useSocket
- [x] Package dependencies updated

### Next Steps (Future PRs)

- [ ] Update game scorer page (`src/app/game/[id]/scorer/page.tsx`)
- [ ] Update game spectator page (`src/app/game/[id]/page.tsx`)
- [ ] Update box score page (`src/app/game/[id]/box-score/page.tsx`)
- [ ] Update live games page (`src/app/live/page.tsx`)
- [ ] Update community page (`src/app/community/[slug]/page.tsx`)
- [ ] Remove Socket.io server code (`src/server/socket/`)
- [ ] Update tests for Convex
- [ ] Add Convex environment variables

## Architecture Changes

### Before (Socket.io)

```
Client ←WebSocket→ Socket.io Server ←Redis→ PostgreSQL
```

### After (Convex)

```
Client ←WebSocket→ Convex Cloud ←→ Convex Database
           ↓
     PostgreSQL (for non-real-time data)
```

## Socket.io → Convex Mapping

| Socket.io Pattern | Convex Equivalent |
|-------------------|-------------------|
| `socket.emit('update-game', data)` | `updateGameState({ gameId, updates })` mutation |
| `socket.on('game-updated', callback)` | `useQuery(api.games.getGameState, { gameId })` |
| `socket.on('event-added', callback)` | `useQuery(api.games.getGameEvents, { gameId })` |
| `socket.emit('timer-control', { action: 'start' })` | `controlTimer({ gameId, action: 'start' })` |
| `socket.on('clock-update', callback)` | Calculate from `timerState` in `useQuery` |
| `socket.join('game-123')` | Automatic via query arguments |
| `io.to('game-123').emit(...)` | All subscribers auto-update on mutation |
| `socket.on('connect')` | Handled by ConvexProvider |
| `socket.on('disconnect')` | Handled by ConvexProvider |

## New Files

### Backend

- `convex/schema.ts` - Database schema for game state, events, presence, timer
- `convex/games.ts` - Queries and mutations for game operations

### Frontend

- `src/components/ConvexClientProvider.tsx` - React provider for Convex + Clerk
- `src/hooks/use-convex-game.ts` - Hook replacing useSocket with Convex queries

## Schema

### gameStates

Stores the real-time state of active games.

```typescript
{
  gameId: Id<"games">,
  homeScore: number,
  guestScore: number,
  homeFouls: number,
  guestFouls: number,
  homeTimeouts: number,
  guestTimeouts: number,
  clockSeconds: number,
  isTimerRunning: boolean,
  timerStartedAt?: number,
  currentPeriod: number,
  possession?: "home" | "guest",
  status: "scheduled" | "live" | "final",
  updatedAt: number,
  updatedBy?: string,
}
```

### gameEvents

Stores game events with real-time sync.

```typescript
{
  gameId: Id<"games">,
  eventId?: string,  // Client-generated for deduplication
  type: EventType,
  period: number,
  clockAt: number,
  team?: "home" | "guest",
  player?: string,
  gameRosterId?: Id<"gameRosters">,
  value?: number,
  metadata?: any,
  description: string,
  createdAt: number,
  createdBy?: string,
}
```

### timerSync

Tracks timer state for cross-client synchronization.

```typescript
{
  gameId: Id<"games">,
  isRunning: boolean,
  startedAt?: number,
  initialClockSeconds: number,
  currentClockSeconds: number,
  updatedAt: number,
  updatedBy: string,
}
```

### gamePresence

Tracks active users in a game.

```typescript
{
  gameId: Id<"games">,
  userId: string,
  role: "scorer" | "spectator",
  lastSeenAt: number,
  clientId: string,
}
```

## Usage Example

### Before (Socket.io)

```typescript
const { socket } = useSocket(gameId);

useEffect(() => {
  socket?.on('game-updated', handleUpdate);
  socket?.emit('update-game', { gameId, updates });
}, [socket]);
```

### After (Convex)

```typescript
const { 
  gameState, 
  updateScore,
  updateGameStatus,
  startTimer,
  stopTimer,
  addEvent 
} = useConvexGame(gameId);

// Data auto-updates - no useEffect needed!
// Mutations automatically sync to all clients
await updateScore('home', 2);
await startTimer();
```

## Environment Variables

Add to `.env.local`:

```bash
NEXT_PUBLIC_CONVEX_URL=your_convex_deployment_url
CONVEX_DEPLOYMENT=your_deployment_name
```

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Initialize Convex:
   ```bash
   npx convex dev
   ```

3. Update environment variables with Convex deployment URL

4. Wrap app with ConvexClientProvider in `app/layout.tsx`

5. Start using `useConvexGame` hook in components

## Testing

Convex provides a local development environment that automatically syncs changes:

```bash
npx convex dev
```

This starts a local Convex backend that hot-reloads your functions.

## Performance Considerations

- **Queries are cached**: Repeated queries to the same data are free after first fetch
- **Selective subscriptions**: Only subscribed data triggers re-renders
- **Optimistic updates**: UI updates instantly before server confirms
- **Automatic batching**: Convex batches multiple mutations efficiently

## Migration Timeline

This is Phase 1 of the migration. Phase 2 will update the UI components to use the new hook.

## References

- [Convex Documentation](https://docs.convex.dev)
- [Convex React Client](https://docs.convex.dev/client/react)
- [Convex with Next.js](https://docs.convex.dev/client/react/nextjs)
- [Clerk + Convex Integration](https://docs.convex.dev/auth/clerk)
