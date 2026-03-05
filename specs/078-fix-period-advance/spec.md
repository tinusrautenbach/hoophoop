# Feature Specification: Fix Period Advance — Conflict & Timer Reset

**Feature Branch**: `078-fix-period-advance`  
**Created**: 2026-03-02  
**Status**: Draft  
**Input**: User description: "when i click start next period, i get scoring conflict notification and the timer does not reset. write tests to make sure period proceed works as expected"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Period Advances Without Conflict (Priority: P1)

A scorer clicks "Start Next Period" and the game advances to the next period cleanly. No scoring conflict notification appears. The timer resets to the full period duration and is stopped (not running). All other scorers watching the game immediately see the new period and reset timer.

**Why this priority**: This is the core bug. Every period boundary is broken — the conflict banner appears and the clock stays at whatever value it was when the period ended. Scorers cannot trust the app to manage period transitions reliably.

**Independent Test**: In a single-scorer session, click "Start Next Period" at the end of period 1. Verify the period counter increments to 2, the conflict banner does not appear, and the timer shows the full period duration (e.g. 10:00) and is not running.

**Acceptance Scenarios**:

1. **Given** a game is in period 1 with the timer stopped, **When** the scorer clicks "Start Next Period", **Then** the period increments to 2, the timer resets to the configured period duration, and no conflict notification is displayed
2. **Given** a game is in period 1 with the timer running, **When** the scorer clicks "Start Next Period", **Then** the timer stops, the period increments to 2, the timer resets to the configured period duration, and no conflict notification is displayed
3. **Given** two scorers are connected, **When** scorer A clicks "Start Next Period", **Then** scorer B immediately sees the updated period number and the reset timer without any conflict notification on either screen
4. **Given** a game is in period 1, **When** the scorer clicks "Start Next Period", **Then** team fouls are reset to 0 for both teams as part of the same operation

---

### User Story 2 — Period Advance Is Tested (Priority: P1)

Automated tests cover the period advance behaviour: correct period increment, timer reset to full duration, foul reset, no conflict triggered, and correct behaviour when the timer is running at the time of advance.

**Why this priority**: The bug was undetected because there were no tests for this path. Tests must be written to prevent regression and confirm the fix is correct.

**Independent Test**: Run the test suite — all period-advance tests pass with clear assertions on period number, clock value, timer state, and absence of conflict signal.

**Acceptance Scenarios**:

1. **Given** the test suite, **When** period-advance tests run, **Then** they assert period number increments, clock resets to period duration, fouls reset to 0, and conflict flag remains false
2. **Given** a timer is running when period advance is triggered, **When** the test runs, **Then** it asserts the timer is stopped before the clock is reset
3. **Given** the period advance operation, **When** a concurrent state change has already incremented the version, **Then** the test asserts the advance retries and completes without raising a conflict

---

### Edge Cases

- What happens when the game is already at the final period — does the "Start Next Period" button disappear or become disabled?
- What happens if two scorers click "Start Next Period" simultaneously — only one advance should apply, not two?
- What happens if period advance is clicked while a mutation is already in-flight (e.g. a score update)?
- What happens if the configured period duration is non-standard (e.g. 8 minutes instead of 10)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Advancing to the next period MUST be a single atomic operation that updates period number, clock value, and team fouls together — not as separate sequential mutations
- **FR-002**: The period advance operation MUST participate in version-based conflict detection the same way score and foul updates do — stale writes MUST be retried, not silently conflict-flagged
- **FR-003**: The timer MUST be stopped before the clock value is written for the new period, ensuring the displayed clock is always correct after period advance
- **FR-004**: After period advance, the clock display MUST show the full period duration (e.g. 10:00) and the timer MUST be in a stopped state
- **FR-005**: The conflict notification MUST NOT appear as a result of a valid, uncontested period advance by a single scorer
- **FR-006**: All tests covering the period advance path MUST be automated and included in the existing test suite

### Key Entities

- **Game State**: period number, clock seconds, home/away fouls, version counter — all must update atomically on period advance
- **Timer Sync**: separate record tracking whether the clock is running and its current value — must be updated to stopped + reset clock on period advance
- **Conflict Signal**: UI flag that shows the conflict banner — must not be raised by period advance in the absence of a true concurrent edit conflict

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Clicking "Start Next Period" in a single-scorer session never produces a conflict notification
- **SC-002**: After clicking "Start Next Period", the displayed clock always shows the full period duration within 1 second
- **SC-003**: All automated period-advance tests pass with zero failures
- **SC-004**: In a two-scorer concurrent session, simultaneous "Start Next Period" clicks result in exactly one period increment (not two)
- **SC-005**: The fix introduces no regression in score, foul, or timeout conflict detection (existing conflict-detection tests still pass)
