# Quickstart: Shot Ratio Display in Game Log

**Branch**: `079-shot-ratio-display` | **Date**: 2026-03-16

## Overview

This feature adds shot ratio (made/attempts) display to game log events for score and miss events. **The implementation already exists** — this quickstart covers adding tests and verifying edge cases.

---

## Implementation Summary

### What's Already Implemented

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| `getShotRatio()` function | `src/components/scorer/game-log.tsx` | 61-89 | ✅ Complete |
| Ratio display | `src/components/scorer/game-log.tsx` | 152-157 | ✅ Complete |

### What's Missing

| Item | File | Status |
|------|------|--------|
| Unit tests for `getShotRatio` | `src/components/scorer/__tests__/game-log.test.ts` | ❌ To create |
| E2E tests for display | `tests/e2e/shot-ratio.spec.ts` | ❌ To create |
| Secondary sort key for chronology | `game-log.tsx` | ⚠️ Minor fix |

---

## Quick Implementation Guide

### Step 1: Fix Chronology Secondary Sort (Optional)

Current code doesn't handle same-timestamp events deterministically. Add `id` as secondary sort:

```typescript
// Before (line 68-69)
const chronological = [...allEvents].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
);

// After
const chronological = [...allEvents].sort(
    (a, b) => (a.timestamp.getTime() - b.timestamp.getTime()) || a.id.localeCompare(b.id)
);
```

### Step 2: Create Unit Tests

Create `src/components/scorer/__tests__/game-log.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GameEvent } from '../game-log';
import { getShotRatio } from '../game-log';

// Helper to create test events
function createEvent(overrides: Partial<GameEvent>): GameEvent {
    return {
        id: Math.random().toString(36).slice(2),
        type: 'score',
        team: 'home',
        timestamp: new Date(),
        ...overrides,
    };
}

describe('getShotRatio', () => {
    it('returns null for non-score/miss events', () => {
        const event = createEvent({ type: 'foul', player: 'Player A' });
        expect(getShotRatio(event, [event])).toBeNull();
    });

    it('returns null for events without player', () => {
        const event = createEvent({ type: 'score', value: 2, player: undefined });
        expect(getShotRatio(event, [event])).toBeNull();
    });

    it('returns (1/1) for first made shot', () => {
        const event = createEvent({ type: 'score', player: 'Player A', value: 2 });
        expect(getShotRatio(event, [event])).toBe('(1/1)');
    });

    it('returns (0/1) for first missed shot', () => {
        const event = createEvent({ type: 'miss', player: 'Player A', value: 2 });
        expect(getShotRatio(event, [event])).toBe('(0/1)');
    });

    it('calculates cumulative ratio correctly', () => {
        const events: GameEvent[] = [
            createEvent({ type: 'score', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:00:00') }),
            createEvent({ type: 'miss', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:01:00') }),
            createEvent({ type: 'score', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:02:00') }),
            createEvent({ type: 'miss', player: 'Player A', value: 2, timestamp: new Date('2024-01-01T10:03:00') }),
        ];
        expect(getShotRatio(events[0], events)).toBe('(1/1)');
        expect(getShotRatio(events[1], events)).toBe('(1/2)');
        expect(getShotRatio(events[2], events)).toBe('(2/3)');
        expect(getShotRatio(events[3], events)).toBe('(2/4)');
    });

    it('separates ratios by shot type', () => {
        const events: GameEvent[] = [
            createEvent({ type: 'score', player: 'Player A', value: 1 }),
            createEvent({ type: 'score', player: 'Player A', value: 2 }),
            createEvent({ type: 'miss', player: 'Player A', value: 2 }),
        ];
        expect(getShotRatio(events[0], events)).toBe('(1/1)'); // 1PT: 1/1
        expect(getShotRatio(events[1], events)).toBe('(1/1)'); // 2PT: 1/1
        expect(getShotRatio(events[2], events)).toBe('(1/2)'); // 2PT: 1/2
    });

    it('separates ratios by player', () => {
        const events: GameEvent[] = [
            createEvent({ type: 'score', player: 'Player A', value: 2 }),
            createEvent({ type: 'score', player: 'Player B', value: 2 }),
            createEvent({ type: 'miss', player: 'Player A', value: 2 }),
        ];
        expect(getShotRatio(events[0], events)).toBe('(1/1)'); // Player A: 1/1
        expect(getShotRatio(events[1], events)).toBe('(1/1)'); // Player B: 1/1
        expect(getShotRatio(events[2], events)).toBe('(1/2)'); // Player A: 1/2
    });
});
```

### Step 3: Create E2E Tests

Create `tests/e2e/shot-ratio.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Shot Ratio Display', () => {
    test('displays ratio on score events', async ({ page }) => {
        // Setup: Create game with score events
        // Assert: Ratio displays for each score event
    });

    test('displays ratio on miss events', async ({ page }) => {
        // Setup: Create game with miss events
        // Assert: Ratio displays with made/attempts
    });

    test('updates ratio when events are added', async ({ page }) => {
        // Setup: Create game with initial events
        // Action: Add new event
        // Assert: All ratios update
    });

    test('updates ratio when events are deleted', async ({ page }) => {
        // Setup: Create game with events
        // Action: Delete an event
        // Assert: All ratios update
    });
});
```

---

## Verification Checklist

- [ ] Unit tests pass: `npm test -- game-log.test.ts`
- [ ] E2E tests pass: `npm run test:e2e -- shot-ratio`
- [ ] TypeScript clean: `npx tsc --noEmit`
- [ ] Manual check: View game log with score/miss events, verify ratio displays

---

## File Locations

| File | Purpose |
|------|---------|
| `src/components/scorer/game-log.tsx` | Implementation (exists) |
| `src/components/scorer/__tests__/game-log.test.ts` | Unit tests (create) |
| `tests/e2e/shot-ratio.spec.ts` | E2E tests (create) |
| `specs/079-shot-ratio-display/spec.md` | Specification |
| `specs/079-shot-ratio-display/plan.md` | Implementation plan |
| `specs/079-shot-ratio-display/research.md` | Research findings |