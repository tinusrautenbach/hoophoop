# Hasura Metadata Export

## Last Exported
**Branch**: 021-hasura-metadata-multiscorer-ui  
**Date**: 2026-03-05  
**Exported By**: T005 task

## Current Metadata State

### Tables Tracked (27 total)
Core game tables (4):
- `game_states`
- `hasura_game_events`
- `timer_sync`
- `game_scorers`

Game management (4):
- `games`
- `game_events`
- `game_rosters`
- `game_scorer_invites`

Team & player (4):
- `teams`
- `athletes`
- `team_memberships`
- `player_history`

Community (3):
- `communities`
- `community_members`
- `community_invites`

Tournament (6):
- `tournaments`
- `tournament_pools`
- `tournament_teams`
- `tournament_games`
- `tournament_standings`
- `tournament_awards`

Season (2):
- `seasons`
- `team_seasons`

User & activity (3):
- `users`
- `player_invitations`
- `player_claim_requests`
- `user_activity_logs`

### Relationships Configured

**Games table**:
- `community` → communities
- `homeTeam` → teams
- `guestTeam` → teams
- `season` → seasons
- `gameEvents` → game_events (array)
- `gameRosters` → game_rosters (array)
- `gameStates` → game_states (array)
- `timerSync` → timer_sync (array)
- `gameScorers` → game_scorers (array)
- `scorerInvites` → game_scorer_invites (array)

**Athletes table**:
- `community` → communities
- `teamMemberships` → team_memberships (array)
- `gameRosters` → game_rosters (array)
- `claimRequests` → player_claim_requests (array)

**Teams table**:
- `community` → communities
- `teamMemberships` → team_memberships (array)
- `teamSeasons` → team_seasons (array)
- `homeGames` → games (array)
- `guestGames` → games (array)

### Permissions Summary

**Anonymous role**:
- Can SELECT public games (visibility = 'public_general')
- Can SELECT game states, events, timer for public games
- Can SELECT active/world-available athletes
- Can SELECT all teams
- Can SELECT game_scorers (for presence)

**User role**:
- Full CRUD on all tables (with row-level filters where applicable)

### Public Games View

The `games` table already implements public games filtering via permissions:
- Anonymous users can only see games where `visibility = 'public_general'`
- This provides the public games listing functionality without needing a separate view

## How to Export Metadata

### Using Hasura CLI

```bash
# Navigate to hasura directory
cd hasura

# Export metadata
hasura metadata export

# Or apply metadata to a fresh instance
hasura metadata apply
```

### Manual Export via Console

1. Open Hasura Console (http://localhost:8080/console)
2. Go to Settings → Metadata Actions → Export Metadata
3. Save the JSON file

### Verifying Metadata Consistency

```bash
# Check if metadata is consistent
hasura metadata inconsistency list

# Reload metadata if needed
hasura metadata reload
```

## Database Migrations

If you make schema changes, create a migration:

```bash
# Create migration from changes
hasura migrate create <name> --from-server

# Apply migrations
hasura migrate apply
```

## Environment Variables

Ensure these are set:

```bash
HASURA_GRAPHQL_ENDPOINT=http://localhost:8080
HASURA_GRAPHQL_ADMIN_SECRET=myadminsecretkey
```

## Next Steps for Production

1. Run `hasura metadata apply` on production Hasura instance
2. Verify all tables are tracked in console
3. Test GraphQL queries in console
4. Verify WebSocket subscriptions work
5. Check permissions are correctly enforced
