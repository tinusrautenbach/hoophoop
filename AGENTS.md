# bball Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-01

## Active Technologies
- TypeScript 5.x + Next.js 15, Playwright (`@playwright/test`), Clerk (`@clerk/testing`), Drizzle ORM (003-multi-scorer-e2e)
- PostgreSQL 16 (for cleanup script via `postgres-js`) (003-multi-scorer-e2e)
- TypeScript 5.x (strict mode, no escape hatches) + Next.js 16 (App Router), Hasura GraphQL WebSocket, Vitest + @testing-library/react (078-fix-period-advance)
- PostgreSQL 16 via Hasura — `game_states` (versioned CAS), `timer_sync` (blind upsert) (078-fix-period-advance)
- TypeScript 5.x (strict mode) + Next.js 15 (App Router), Drizzle ORM, Hasura GraphQL, Zustand, Framer Motion (078-configurable-player-stats)
- PostgreSQL 16 via Drizzle ORM, Hasura GraphQL for real-time subscriptions (078-configurable-player-stats)
- TypeScript 5.x (strict mode, no escape hatches per constitution) + Next.js 15 (App Router), React 19, Framer Motion, Tailwind CSS (079-shot-ratio-display)
- N/A (client-side calculation from existing events array) (079-shot-ratio-display)

- TypeScript 5.x (strict mode, no escape hatches per constitution) + Next.js 15 (App Router), Drizzle ORM, Hasura GraphQL (WebSocket subscriptions), Clerk (auth), Zustand, Vitest, @testing-library/react (002-multi-scorer-testing)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (strict mode, no escape hatches per constitution): Follow standard conventions

## Recent Changes
- 079-shot-ratio-display: Added TypeScript 5.x (strict mode, no escape hatches per constitution) + Next.js 15 (App Router), React 19, Framer Motion, Tailwind CSS
- 078-configurable-player-stats: Added TypeScript 5.x (strict mode) + Next.js 15 (App Router), Drizzle ORM, Hasura GraphQL, Zustand, Framer Motion
- 078-fix-period-advance: Added TypeScript 5.x (strict mode, no escape hatches) + Next.js 16 (App Router), Hasura GraphQL WebSocket, Vitest + @testing-library/react


<!-- MANUAL ADDITIONS START -->

## Branch Management

After merging a feature branch to main, **always delete the old feature branch**:

```bash
# After merging PR to main:
git checkout main
git pull origin main
git branch -d <feature-branch>           # Delete local branch
git push origin --delete <feature-branch>  # Delete remote branch (if exists)
```

**Rationale**: Prevents stale branch accumulation, reduces confusion about which branches contain unmerged work.

<!-- MANUAL ADDITIONS END -->
