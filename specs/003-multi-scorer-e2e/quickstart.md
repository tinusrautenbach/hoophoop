# Quickstart: End-to-End Multi-Scorer Browser Testing

**Feature**: 003-multi-scorer-e2e  
**Date**: 2026-03-02
**Status**: Ready

## Prerequisites

- Node.js 18+
- Local development server running (`bun run dev` or `npm run dev`)
- Local PostgreSQL and Hasura running (typically via Docker/Colima)

## Installation & Setup

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
```

## Running the E2E Suite

The test suite uses mock authentication (no Clerk required for tests).

```bash
# Start the local application
npm run dev

# In a new terminal, run the E2E tests
npm run test:e2e

# Run with UI visible (headed mode - great for debugging)
npx playwright test --headed

# Run only specific test files
npx playwright test tests/e2e/multi-scorer.spec.ts
npx playwright test tests/e2e/roles.spec.ts

# Run stress test (10 consecutive runs)
npm run test:e2e:stress
```

## Test Overview

### multi-scorer.spec.ts
Tests concurrent scoring by multiple users:
- T009: Simultaneous score updates converge on both pages
- T010: Foul recorded by owner propagates to scorer page  
- T011: Event deletion by owner propagates to scorer page

### roles.spec.ts
Tests role-based access control:
- T013: Viewer can observe game but cannot add scorers
- T014: Viewer API POST returns 403 while owner succeeds

## How It Works

The tests use mock authentication that bypasses Clerk:
1. Mock users are defined in `tests/e2e/helpers/auth.ts`
2. Browser contexts set `x-test-auth` and `x-test-user-id` headers
3. The app's `auth()` function in `src/lib/auth-server.ts` recognizes these headers and returns mock user data
4. No Clerk interaction required - tests run completely independently

## Troubleshooting

### Tests Fail with "Game not found"
Run the cleanup script:
```bash
npx tsx scripts/cleanup-e2e.ts
```

### Timeout Errors
Ensure your dev server is running on http://localhost:3000

## Test Results

### T031: 10-Pass Stress Test
Run: `npm run test:e2e:stress`
Expected: 100% pass rate across 10 consecutive runs

### T032: Quickstart Validation
Run: `npm run test:e2e:setup`
Validates all prerequisites are met
