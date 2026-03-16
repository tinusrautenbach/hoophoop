# Testing Guide

## Overview

This guide covers testing strategies for the Hasura GraphQL realtime implementation.

## Test Structure

```
src/
├── hooks/__tests__/          # Hook tests
│   └── use-hasura-game.test.ts
├── lib/hasura/               # Hasura client and utilities
│   └── __tests__/client.test.ts
├── app/game/[id]/__tests__/  # Component tests (future)
└── server/__tests__/         # Server tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/hooks/__tests__/use-hasura-game.test.ts

# Run in watch mode
npm test -- --watch

# Run E2E tests
npm run test:e2e
```

## Test Categories

### 1. Unit Tests - Hooks

Test the `useHasuraGame` hook:

```typescript
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHasuraGame } from "@/hooks/use-hasura-game";

describe("useHasuraGame", () => {
  it("should return game state", () => {
    const { result } = renderHook(() => useHasuraGame("game-123"));
    expect(result.current.gameState).toBeDefined();
  });
});
```

### 2. Hasura GraphQL Tests

Test Hasura queries and subscriptions:

```typescript
// src/lib/hasura/__tests__/client.test.ts
import { describe, it, expect } from "vitest";
import { createHasuraClient } from "@/lib/hasura/client";

describe("Hasura Client", () => {
  it("should create client with proper headers", () => {
    const client = createHasuraClient();
    expect(client).toBeDefined();
  });
});
```

### 3. Integration Tests

Test full user flows:

```typescript
// tests/integration/game-flow.test.ts
describe("Game Scoring Flow", () => {
  it("should allow scorer to update score and spectators to see it", async () => {
    // Scorer updates score via GraphQL mutation
    // Spectator receives update via Hasura GraphQL subscription
  });
});
```

### 4. E2E Tests

Run multi-scorer E2E tests with Playwright:

```bash
# Run all E2E tests
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Run with UI debugger
npm run test:e2e:ui
```

## Hasura Testing

### Mock Hasura Subscription

```typescript
vi.mock("@/lib/hasura/client", async () => {
  const actual = await vi.importActual("@/lib/hasura/client");
  return {
    ...actual,
    useHasuraSubscription: vi.fn(),
    useHasuraMutation: vi.fn(() => vi.fn()),
  };
});
```

### Mock Hasura Client

```typescript
const mockHasuraClient = {
  query: vi.fn(),
  mutate: vi.fn(),
  subscribe: vi.fn(),
};
```

## Testing Checklist

### Hasura Implementation

- [ ] GraphQL query tests
- [ ] GraphQL subscription tests
- [ ] Optimistic update tests
- [ ] Timer state tests
- [ ] Game state persistence tests
- [ ] Event log tests

## Key Technologies

| Technology | Purpose |
|------------|---------|
| Hasura GraphQL | Real-time subscriptions |
| graphql-ws | WebSocket client for subscriptions |
| Vitest | Unit testing framework |
| Playwright | E2E browser testing |
| @clerk/testing | Authentication testing |

## Debugging Tests

```bash
# Debug specific test
npm test -- --reporter=verbose src/hooks/__tests__/use-hasura-game.test.ts

# Debug with logs
DEBUG=hasura:* npm test
```

## CI/CD Integration

```yaml
# .github/workflows/ci.yml
- name: Run tests
  run: npm test
  env:
    HASURA_GRAPHQL_URL: http://localhost:8080/v1/graphql
    HASURA_ADMIN_SECRET: test-secret
```

## E2E Test Setup

### Prerequisites

- Local development stack running (Next.js + PostgreSQL + Hasura)
- Clerk test users configured

### Environment Variables

```bash
# .env.local
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
HASURA_GRAPHQL_URL=http://localhost:8080/v1/graphql
HASURA_ADMIN_SECRET=your-admin-secret
```

### Running E2E Tests

See [TESTING.md](./TESTING.md) for detailed E2E setup instructions.
