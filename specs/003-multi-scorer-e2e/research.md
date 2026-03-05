# Research: End-to-End Multi-Scorer Browser Testing

**Feature**: 003-multi-scorer-e2e  
**Date**: 2026-03-02

## Research Questions & Findings

### R1: How to handle Clerk authentication for multiple Playwright contexts?

**Decision**: Use `@clerk/testing` to generate authentication tokens dynamically and inject them directly into isolated Playwright contexts using `browser.newContext()` and `addCookies()`.

**Rationale**: The official Clerk documentation explicitly recommends this pattern for fast, UI-bypass E2E testing. Using `test.use({ storageState: ... })` is restricted to single-user scenarios, making it unsuited for our multi-scorer test. UI automation (typing email/password) is slow and prone to CAPTCHA/bot blocks.

**Implementation Pattern**:
```typescript
import { test, chromium } from '@playwright/test';
import { clerkSetup } from '@clerk/testing';

test('two scorers update simultaneously', async () => {
  const { createUser, getToken } = await clerkSetup();

  // Provision users
  const userA = await createUser({ email: 'scorer_a@example.com' });
  const tokenA = await getToken(userA.id);
  
  // Set up Context A
  const browser = await chromium.launch();
  const contextA = await browser.newContext();
  await contextA.addCookies([{ name: '__session', value: tokenA, domain: 'localhost', path: '/' }]);
  const pageA = await contextA.newPage();
  
  // Repeat for Context B...
});
```

---

### R2: How to ensure clean test data environments?

**Decision**: Prefix all game names generated during E2E tests with `[E2E-TEST]` and run a Drizzle script before tests (`globalSetup` in Playwright config) to hard-delete any matching games.

**Rationale**: Existing DELETE endpoints use soft-deletes (updating `deletedAt`), but for test isolation, hard-deletes are preferred. The DB schema uses `onDelete: 'cascade'` for all related tables (`gameEvents`, `gameRosters`, `gameStates`), so deleting a game from the `games` table automatically cleans up the entire tree.

**Implementation Pattern**:
```typescript
// scripts/cleanup-e2e.ts
import { db } from '../src/db';
import { games } from '../src/db/schema';
import { like } from 'drizzle-orm';

export async function cleanupE2EGames() {
  await db.delete(games).where(like(games.name, '%[E2E-TEST]%'));
}
```

---

### R3: How to test the Viewer vs Scorer role enforcement?

**Decision**: Provision a game owned by User A (Scorer), invite User B as a Viewer via API, and then authenticate Context B as the Viewer. The test will assert that the scoring UI elements are hidden and that explicit API calls from the Viewer's context are rejected.

**Rationale**: This accurately simulates real-world access control boundaries across both the UI layer (conditional rendering) and the API layer (server-side authorization checks).

**Alternatives Considered**:
- Mocking the `canManageGame` function: Rejected. E2E tests must validate the full stack, including the actual database state and RLS/API boundary.

---

### R4: Where should E2E tests live in the repository?

**Decision**: Create a new `/tests/e2e/` directory alongside the existing `/tests/integration/` directory.

**Rationale**: Playwright tests use a different runner (Playwright Test vs Vitest) and have different runtime requirements. Separating them ensures `npm run test` (Vitest) remains fast, while `npm run test:e2e` can be run explicitly when a local server is available.
