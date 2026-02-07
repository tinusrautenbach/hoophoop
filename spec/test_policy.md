# LLM Test Enforcement Policy

## 1. Core Principle
**"No Backend Code Without Tests."**

As an LLM assistant, I am strictly bound by this policy. Every time I generate, modify, or refactor a backend service or API route, I **MUST** create or update the corresponding unit test file.

## 2. Test Scope
Tests must cover:
1.  **Game Logic**:
    *   Scoring events (incrementing points correctly).
    *   State transitions (Scheduled -> Live -> Final).
    *   Clock operations (Start, Stop, Edit).
    *   Undo functionality (reverting state).
2.  **API Endpoints**:
    *   `POST /api/games` (Creation validation).
    *   `POST /api/games/:id/action` (Event processing).
3.  **Socket.io Handlers**:
    *   Room joining/leaving.
    *   Event broadcasting integrity (does the message match the schema?).

## 3. Technology Stack
*   **Framework**: **Vitest** (Native support for Vite/Next.js, fast execution).
*   **Mocks**: `vi.mock()` for database calls (Drizzle) and Socket.io.
*   **Assertions**: `expect()` style.

## 4. Workflow for LLM
When the User asks for a backend feature (e.g., "Add fouling logic"):

1.  **Plan**: Identify the logic file (e.g., `services/game.ts`).
2.  **Write Tests First** (or immediately along with code): Create `services/game.test.ts`.
3.  **Implement**: Write the actual logic.
4.  **Verify**: Run `npm test` to confirm passing.

## 5. Mandatory File Structure
For every service file, a sibling test file must exist:
```
src/
  services/
    __tests__/
      game.test.ts
    game.ts
    player.ts
  app/
    api/
      games/
        route.ts
        route.test.ts
```

## 6. Example Test Template
```typescript
import { describe, it, expect } from 'vitest';
import { calculateScore } from '../game';

describe('Game Service', () => {
  it('should correctly add 3 points to home team', () => {
    const initialState = { home: 10, guest: 10 };
    const newState = calculateScore(initialState, 'home', 3);
    expect(newState.home).toBe(13);
  });
});
```
