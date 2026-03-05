# Data Model: End-to-End Multi-Scorer Browser Testing

**Feature**: 003-multi-scorer-e2e  
**Date**: 2026-03-02

## Existing Entities (E2E Test Boundaries)

This feature does not modify the application's core data model, but it heavily exercises the cascade delete relationships and permission structures during setup/teardown.

### Cascade Delete Hierarchy (For Pre-Run Sweep)

When the `cleanup-e2e.ts` script deletes a row from `games` where `name LIKE '%[E2E-TEST]%'`, PostgreSQL automatically deletes the following dependent records via `ON DELETE CASCADE` constraints defined in `src/db/schema.ts`:

1. `games` (Root entity)
   ↳ `tournamentGames`
   ↳ `gameRosters`
   ↳ `gameEvents`
   ↳ `gameScorers` (Contains role assignments tested in US2)
   ↳ `gameScorerInvites`
   ↳ `gameStates` (Hasura real-time sync table)
   ↳ `hasuraGameEvents`
   ↳ `timerSync`

**Constraint Check**: By hard-deleting the root `games` record, the test suite guarantees a clean environment without needing to manually clear 8 separate tables.

### Test User Lifecycle (Clerk)

For the purpose of E2E tests, user data lives in Clerk rather than the local Postgres database (until they interact and are synced).

1. **Provisioning**: `@clerk/testing` calls the Clerk backend to create a transient user.
2. **Session Injection**: Test runner injects `__session` cookie containing the JWT.
3. **Application Auth**: Next.js `auth()` middleware validates the token locally without calling Clerk UI.
4. **Teardown**: `@clerk/testing` should ideally clean up test users, or they can be ignored as they don't persist in the application's primary Postgres DB.

### Role Authorization Matrix (Tested in US2)

| Role (`gameScorers.role`) | UI Elements Visible | API POST `/events` | API DELETE `/events` |
|---------------------------|---------------------|--------------------|----------------------|
| `owner` | All controls | 200 OK | 200 OK |
| `co_scorer` | All controls | 200 OK | 200 OK |
| `viewer` | Scoreboard only (No buttons) | 403 Forbidden | 403 Forbidden |

The E2E test suite asserts that the `viewer` row behaves exactly as specified above, proving the UI logic and API logic are aligned.
