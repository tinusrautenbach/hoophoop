# Testing Guide for Convex Migration

## Overview

This guide covers testing strategies for the Convex migration from Socket.io.

## Test Structure

```
src/
├── hooks/__tests__/          # Hook tests
│   └── use-convex-game.test.ts
├── lib/test/                 # Test utilities
│   └── convex-test-utils.ts
├── app/game/[id]/__tests__/  # Component tests (future)
└── server/__tests__/         # Server tests (now using Convex)
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/hooks/__tests__/use-convex-game.test.ts

# Run in watch mode
npm test -- --watch
```

## Test Categories

### 1. Unit Tests - Hooks

Test the `useConvexGame` hook:

```typescript
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useConvexGame } from "@/hooks/use-convex-game";

describe("useConvexGame", () => {
  it("should return game state", () => {
    const { result } = renderHook(() => useConvexGame("game-123"));
    expect(result.current.gameState).toBeDefined();
  });
});
```

### 2. Convex Function Tests

Test Convex queries and mutations using the Convex testing framework:

```typescript
// convex/games.test.ts
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const test = convexTest(schema);

describe("games", () => {
  it("should create and retrieve game state", async () => {
    const gameId = await test.mutation(api.games.updateGameState, {
      gameId: "test-game",
      updates: { homeScore: 10 },
    });

    const state = await test.query(api.games.getGameState, {
      gameId: "test-game",
    });

    expect(state?.homeScore).toBe(10);
  });
});
```

### 3. Integration Tests

Test full user flows:

```typescript
// tests/integration/game-flow.test.ts
describe("Game Scoring Flow", () => {
  it("should allow scorer to update score and spectators to see it", async () => {
    // Scorer updates score
    // Spectator receives update via Convex subscription
  });
});
```

## Mocking Convex

### Mock useQuery

```typescript
vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(() => vi.fn()),
  };
});
```

### Mock Convex Client

```typescript
const mockClient = {
  query: vi.fn(),
  mutation: vi.fn(),
  subscription: vi.fn(),
};
```

## Testing Checklist

### Before Migration (Socket.io)

- [ ] Socket connection tests
- [ ] Event broadcast tests
- [ ] Room management tests
- [ ] Timer synchronization tests

### After Migration (Convex)

- [ ] Query subscription tests
- [ ] Mutation tests
- [ ] Optimistic update tests
- [ ] Timer state tests
- [ ] Game state persistence tests
- [ ] Event log tests

## Key Differences

| Socket.io | Convex |
|-----------|--------|
| `socket.emit()` | `useMutation()` |
| `socket.on()` | `useQuery()` (reactive) |
| Manual room management | Automatic via query args |
| Server-side timer intervals | Client-side timer calculation |
| Mock socket server | Mock Convex client |

## Debugging Tests

```bash
# Debug specific test
npm test -- --reporter=verbose src/hooks/__tests__/use-convex-game.test.ts

# Debug with logs
DEBUG=convex:* npm test
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test
  env:
    CONVEX_DEPLOYMENT: test-deployment
```

## Future Test Additions

1. E2E tests with Playwright
2. Load tests for concurrent users
3. Offline/online sync tests
4. Performance benchmarks
