# Quickstart: End-to-End Multi-Scorer Browser Testing

**Feature**: 003-multi-scorer-e2e  
**Date**: 2026-03-02

## Prerequisites

- Node.js 18+
- Local development server running (`bun run dev`)
- Local PostgreSQL and Hasura running (typically via Docker/Colima)
- Clerk Secret Key available in `.env.local` (required by `@clerk/testing`)

## Installation & Setup

```bash
# Switch to feature branch
git checkout 003-multi-scorer-e2e

# Install Playwright and Clerk testing tools
npm install -D @playwright/test @clerk/testing

# Install Playwright browsers (if not already installed)
npx playwright install chromium
```

## Running the E2E Suite

The test suite assumes your Next.js application is running locally on port 3000.

```bash
# Start the local application in one terminal
bun run dev

# In a new terminal, run the pre-test cleanup (removes old [E2E-TEST] data)
# (This will be integrated into the Playwright globalSetup, but can be run manually)
npx tsx scripts/cleanup-e2e.ts

# Run the full Playwright suite (headless)
npx playwright test

# Run tests with UI visible (headed mode - great for debugging)
npx playwright test --headed

# Run only the concurrent scoring test
npx playwright test tests/e2e/multi-scorer.spec.ts

# Run only the role enforcement test
npx playwright test tests/e2e/roles.spec.ts
```

## Writing Tests: Key Patterns

### 1. Authenticating a Context

Always use the auth helper to inject Clerk tokens, avoiding the UI login flow:

```typescript
import { test, chromium } from '@playwright/test';
import { clerkSetup } from '@clerk/testing';

test('auth example', async () => {
  const { createUser, getToken } = await clerkSetup();
  const user = await createUser({ email: 'test@example.com' });
  const token = await getToken(user.id);
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  // Inject token
  await context.addCookies([{ name: '__session', value: token, domain: 'localhost', path: '/' }]);
  
  const page = await context.newPage();
  await page.goto('http://localhost:3000/game/123');
});
```

### 2. Waiting for WebSocket Sync

Because Hasura subscriptions are asynchronous, do not assert immediately after clicking a button. Use Playwright's auto-retrying assertions or wait for specific network/UI states.

```typescript
// BAD: Assumes instant sync
await pageA.click('button:has-text("+2 Home")');
expect(await pageB.locator('.home-score').innerText()).toBe('2');

// GOOD: Playwright will retry this assertion until it passes or times out
await pageA.click('button:has-text("+2 Home")');
await expect(pageB.locator('.home-score')).toHaveText('2', { timeout: 5000 });
```

## Implementation Order

1. Update `package.json` with dependencies and new `test:e2e` scripts.
2. Create `playwright.config.ts` and set up the `[E2E-TEST]` prefix cleanup script.
3. Build the `tests/e2e/helpers/auth.ts` utility to abstract the Clerk token injection.
4. Implement `multi-scorer.spec.ts` (User Story 1 & 3).
5. Implement `roles.spec.ts` (User Story 2).
6. Update `TESTING.md` to document the new E2E workflow for the team.
