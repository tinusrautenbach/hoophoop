# Feature Specification: Multi-Scorer Concurrent Testing & Fixes

**Feature Branch**: `002-multi-scorer-testing`  
**Created**: March 1, 2026  
**Status**: Draft  
**Input**: User description: "Full multi-threaded test for multi scorers and confirmation that frontend is correctly updating across multiple scorers. This test needs to make sure that the typescript in the UX is also correctly handling multiple updates for the scorers."

## Clarifications

### Session 2026-03-01

- Q: Is scope limited to writing tests, or should production bugs revealed by tests also be fixed in this branch? → A: Test + fix — write tests and fix any production bugs they reveal in the same branch.
- Q: How should event amendment (PATCH) handle score recalculation, and should there be a safety net beyond per-event recalc? → A: Reverse old value and apply new value on each amendment. Additionally, perform a full recalculation from all events at specific trigger points (period change, halftime, game finalization, timeout, scorer reconnection). A manual force-recalc/refresh button must be added to the scorer top menu.
- Q: Should new tests extend existing concurrent test files, replace them, or live in separate new files? → A: Extend existing files — add new test cases to the existing concurrent test files, continuing their patterns, helpers, and numbering scheme (T093+).
- Q: When a full recalculation finds a discrepancy between cached totals and true event sums, how should it be handled? → A: Correct + log + notify — recalculate and update totals, log the discrepancy with details (old vs new values, trigger type, game ID) for diagnostics, and show the active scorer a brief toast notification that a correction occurred.
- Q: Should the test suite verify role-based access control (viewer cannot score, co_scorer cannot manage other scorers) under concurrent conditions? → A: Yes — include role enforcement tests verifying viewers cannot mutate game state and co_scorers can score but cannot manage other scorers, even during concurrent activity bursts.
## User Scenarios & Testing *(mandatory)*

### User Story 1 - Concurrent Score Updates Produce Correct Totals (Priority: P1)

Two or more scorers are actively scoring the same live game simultaneously. Each scorer records points for different teams or players at overlapping moments. The system must ensure that every score update is applied exactly once and that the running totals displayed to all connected scorers converge to the same correct values within a short window.

**Why this priority**: This is the core promise of multi-scorer support. If concurrent scoring produces incorrect totals, the entire feature is unreliable and game results cannot be trusted.

**Independent Test**: Can be fully tested by simulating two scorer sessions posting score events within milliseconds of each other and verifying that the final displayed totals equal the sum of all individual events.

**Acceptance Scenarios**:

1. **Given** a live game with two active scorers and a score of 0-0, **When** Scorer A records +2 for home and Scorer B records +3 for guest within the same second, **Then** both scorers see a final score of 2-3 within 2 seconds
2. **Given** a live game with three active scorers, **When** all three record score events for the same team within 500ms of each other, **Then** the displayed total equals the sum of all three point values and no event is lost or duplicated
3. **Given** a live game where Scorer A's update succeeds first and Scorer B's initial attempt is rejected due to a version conflict, **When** the system retries Scorer B's update, **Then** Scorer B's update is applied correctly without overwriting Scorer A's change

---

### User Story 2 - Frontend State Consistency Across Scorer Sessions (Priority: P1)

Each scorer's user interface must reflect the latest game state at all times, including changes made by other scorers. When one scorer adds, deletes, or amends an event, all other connected scorer interfaces must update to show the corrected totals, event lists, and player statistics without requiring a manual refresh.

**Why this priority**: Equal to P1 because even if the backend handles concurrency correctly, stale or inconsistent frontend state renders the system unusable for live scoring.

**Independent Test**: Can be tested by rendering the scorer interface in multiple simulated sessions, pushing state updates from one, and asserting that all others reflect the change.

**Acceptance Scenarios**:

1. **Given** two scorer sessions connected to the same game, **When** Scorer A records a 2-point score, **Then** Scorer B's displayed score updates to reflect the new total without any user action
2. **Given** two scorer sessions where Scorer A deletes a previously recorded event, **When** the deletion completes, **Then** Scorer B's displayed score decreases by the deleted event's point value and the event disappears from Scorer B's game log
3. **Given** a scorer session that temporarily loses its real-time connection, **When** the connection is re-established, **Then** the scorer's display catches up to the current game state including all changes made by other scorers during the disconnection

---

### User Story 3 - Conflict Detection and User Feedback (Priority: P2)

When two scorers' updates conflict (both attempt to modify the same game state version), the system must handle the conflict transparently. The winning update applies immediately, and the conflicting scorer's update retries automatically. If automatic retry fails, the scorer is informed so they can take corrective action.

**Why this priority**: Conflicts are an expected edge case under heavy concurrent use. Users need visibility into conflicts to maintain trust in the scoring data, but the automatic retry mechanism handles most cases silently.

**Independent Test**: Can be tested by forcing a version mismatch in the update mechanism and verifying that the retry succeeds or the conflict indicator appears.

**Acceptance Scenarios**:

1. **Given** two scorers submitting updates at the exact same moment targeting the same game state version, **When** the first update succeeds, **Then** the second scorer's update automatically retries with the updated version and succeeds without user intervention
2. **Given** a scorer whose update fails twice due to rapid successive conflicts, **When** the retry limit is reached, **Then** the scorer sees a visible conflict indicator that disappears once the state synchronises
3. **Given** a conflict indicator is displayed to a scorer, **When** the game state subscription delivers the latest state, **Then** the conflict indicator clears within 5 seconds

---

### User Story 4 - Timer Synchronisation Under Concurrent Control (Priority: P2)

When multiple scorers have the ability to start and stop the game clock, the timer state must remain consistent. Simultaneous start/stop commands must not corrupt the clock value or leave the timer in an ambiguous state.

**Why this priority**: Timer accuracy is important for game integrity but conflicts on timer operations are less frequent than score conflicts in practice.

**Independent Test**: Can be tested by simulating two scorers issuing start and stop commands concurrently and verifying the resulting timer state is deterministic.

**Acceptance Scenarios**:

1. **Given** a stopped game clock at 5:00, **When** Scorer A starts the timer and Scorer B also starts the timer within 100ms, **Then** the timer runs with a single consistent start time and does not double-count elapsed time
2. **Given** a running game clock, **When** Scorer A stops the timer and Scorer B simultaneously records a score event, **Then** the timer stops at the correct time and the score event is recorded with the accurate clock value

---

### User Story 5 - Foul and Stat Tracking Under Concurrent Updates (Priority: P3)

When multiple scorers record fouls, rebounds, assists, steals, blocks, or other statistics concurrently, the player and team stat totals must remain accurate. Deletion of any stat event must correctly decrement the associated totals.

**Why this priority**: Stat accuracy matters for box scores and player records, but stat events are lower frequency than scoring events and less likely to conflict.

**Independent Test**: Can be tested by simulating concurrent foul recordings for the same and different players, then verifying individual and team foul counts match the event count.

**Acceptance Scenarios**:

1. **Given** two scorers recording fouls for different players on the same team simultaneously, **When** both events are processed, **Then** the team foul count increments by 2 and each player's individual foul count increments by 1
2. **Given** a scorer deletes a foul event while another scorer records a new foul, **When** both operations complete, **Then** the team foul count reflects the net change (no change if one added and one removed)

---

### User Story 6 - Score Integrity via Full Recalculation at Key Moments (Priority: P1)

The system must periodically verify score integrity by performing a full recalculation of all game totals from the complete set of game events at defined trigger points. This acts as a safety net to catch any drift between incrementally maintained totals and the true sum of events. A scorer must also be able to manually trigger a full recalculation at any time via a button in the scorer interface.

**Why this priority**: Elevated to P1 because score accuracy is the foundation of the product. Incremental updates (reverse-old/apply-new on amendment, subtract on delete) can accumulate drift from edge cases, network issues, or bugs. Periodic full recalculation is the safety net that guarantees correctness.

**Independent Test**: Can be tested by introducing intentional drift between cached totals and event sums, then triggering a recalculation event and verifying totals are corrected.

**Acceptance Scenarios**:

1. **Given** a game where the cached score has drifted from the true event sum due to a simulated bug, **When** the period changes to the next period, **Then** the system performs a full recalculation and the displayed score matches the arithmetic sum of all score events
2. **Given** a live game in progress, **When** a scorer presses the force-recalculate button in the top menu, **Then** the system recalculates all totals (score, fouls, player stats) from the full event history and updates all connected scorers' displays
3. **Given** a game transitioning to halftime or final status, **When** the status change is processed, **Then** a full recalculation runs automatically before the new status is confirmed
4. **Given** a scorer who reconnects after a temporary disconnection, **When** the reconnection completes, **Then** the system performs a full recalculation to ensure the scorer's state matches the source of truth
5. **Given** a game where a full recalculation detects a discrepancy between cached totals and true event sums, **When** the recalculation corrects the values, **Then** the discrepancy is logged with old values, new values, trigger type, and game ID, and the active scorer sees a brief toast notification that a score correction occurred
---

### Edge Cases

- What happens when a scorer's session disconnects mid-update — does the partial state corrupt the game?
- How does the system behave when three or more scorers all submit conflicting updates within a single retry window?
- What happens when one scorer deletes an event that another scorer is simultaneously editing?
- How does the system handle a scorer joining a game mid-play and receiving a large backlog of events?
- What happens if the real-time connection delivers events out of order?
- What happens when a scorer records an event and immediately deletes it before other scorers receive the creation?
- What happens if a full recalculation at a trigger point finds a discrepancy — the system corrects the totals, logs the discrepancy (old vs new values, trigger type, game ID), and shows the scorer a brief toast notification
- What happens if a scorer presses the force-recalculate button during a rapid sequence of concurrent updates?
- What happens if a viewer submits a score mutation during a concurrent burst of updates from legitimate scorers?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The test suite MUST verify that concurrent score updates from multiple scorers produce mathematically correct totals equal to the sum of all individual score events. Any production bugs discovered MUST be fixed in this branch.
- **FR-002**: The test suite MUST verify that the frontend state management correctly applies incoming real-time updates from other scorers without requiring manual refresh or user action
- **FR-003**: The test suite MUST verify that version-based conflict detection correctly identifies when two scorers attempt to update the same game state version simultaneously
- **FR-004**: The test suite MUST verify that automatic retry after a conflict applies the update using the latest version without data loss
- **FR-005**: The test suite MUST verify that the conflict indicator is displayed to the user when automatic retry is exhausted and clears when state synchronises
- **FR-006**: The test suite MUST verify that event deletion by one scorer correctly decrements score and stat totals displayed to all connected scorers
- **FR-007**: The test suite MUST verify that concurrent timer start/stop operations from multiple scorers produce a deterministic and accurate clock state
- **FR-008**: The test suite MUST simulate at least 3 concurrent scorer sessions to cover multi-party conflict scenarios beyond simple two-party races
- **FR-009**: The test suite MUST verify that the frontend correctly handles rapid successive state updates (e.g., 10+ updates within 1 second) without dropping, duplicating, or misordering events
- **FR-010**: The test suite MUST verify that frontend type contracts (input and output data shapes) are correctly enforced when processing concurrent subscription payloads
- **FR-011**: The test suite MUST cover both simple scoring mode (team-level) and advanced scoring mode (player-level stats) under concurrent conditions
- **FR-012**: The test suite MUST verify that the active scorer presence list updates correctly when scorers join, leave, or become inactive
- **FR-013**: Any production code bugs revealed by the test suite (including missing score recalculation on event amendment) MUST be fixed within this branch, with corresponding regression tests
- **FR-014**: Event amendment (PATCH) MUST recalculate affected totals by reversing the old event values and applying the new values in a single operation
- **FR-015**: The system MUST perform a full recalculation of all game totals from the complete event history at the following trigger points: period/quarter change, halftime, game finalization (status → final), timeout, and scorer reconnection after disconnect
- **FR-016**: The scorer interface MUST include a force-recalculate button in the top menu that triggers a full recalculation of all game totals from events on demand
- **FR-017**: Full recalculation MUST update scores, fouls, and all player statistics (points, fouls, rebounds, assists, steals, blocks) and propagate corrected values to all connected scorers
- **FR-018**: The test suite MUST verify that full recalculation at each trigger point corrects intentionally introduced drift between cached totals and true event sums
- **FR-019**: When a full recalculation detects a discrepancy between cached totals and the true event sum, the system MUST log the discrepancy with diagnostic details (old values, new values, trigger type, game ID) and display a brief toast notification to the active scorer indicating a correction occurred
- **FR-020**: The test suite MUST verify that viewers cannot mutate game state (score, fouls, timer, events) even during concurrent activity from other scorers
- **FR-021**: The test suite MUST verify that co_scorers can record events but cannot invite, remove, or change the role of other scorers

### Key Entities

- **Scorer Session**: A single authenticated user's connection to a live game, including their real-time subscription and local state
- **Game State Version**: A monotonically increasing counter used to detect and resolve concurrent write conflicts (compare-and-swap)
- **Score Event**: An individual scoring action (type, team, player, point value, timestamp, creating scorer) that contributes to running totals
- **Conflict**: A condition where two scorers attempt to modify game state based on the same version, causing one update to be rejected
- **Presence**: A heartbeat mechanism tracking which scorers are actively connected and interacting with the game
- **Recalculation Trigger**: A defined moment (period change, halftime, game finalization, timeout, scorer reconnection, or manual button press) at which the system recomputes all game totals from the full event history rather than relying on incremental updates

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of concurrent score update scenarios (2-scorer and 3+ scorer) produce final totals that exactly match the arithmetic sum of all recorded events, with zero data loss
- **SC-002**: All frontend state updates from other scorers are reflected in every connected scorer's display within 2 seconds of the originating action under normal conditions
- **SC-003**: Automatic conflict retry succeeds in at least 95% of single-conflict scenarios without requiring user intervention
- **SC-004**: The test suite achieves full coverage of the concurrent update paths: score, foul, timeout, timer start/stop, event deletion, event amendment (with reverse-old/apply-new recalc), and full recalculation at trigger points
- **SC-005**: Rapid-fire updates (10+ per second from multiple scorers) are processed without any dropped, duplicated, or misordered events in the frontend display
- **SC-006**: The test suite runs to completion in under 60 seconds to remain practical for continuous integration
- **SC-007**: Full recalculation at every defined trigger point corrects 100% of intentionally introduced score drift, with zero residual discrepancy
- **SC-008**: 100% of viewer mutation attempts are rejected regardless of concurrent activity level, with zero state changes applied

## Assumptions

- The existing version-based conflict detection (compare-and-swap) mechanism is the intended concurrency model and the tests should validate its correctness rather than replace it
- "Multi-threaded" in the user's description refers to concurrent/parallel test execution simulating multiple scorer sessions, not OS-level threading
- The test suite will use the project's existing test framework and mocking patterns (Vitest, Testing Library, mocked Hasura client) to simulate concurrent scenarios
- Frontend state management refers to the real-time subscription hook and its integration with scorer UI components
- "TypeScript in the UX" refers to verifying type safety and correct data handling in the frontend scorer components and hooks, not a separate TypeScript-specific test layer
- Tests should cover both the hook layer (unit/integration) and component rendering (confirming displayed values match expected state)
- New tests MUST be added to the existing concurrent test files (`src/hooks/__tests__/use-hasura-game.concurrent.test.ts` and `tests/load/concurrent-scorers.test.ts`), extending their established patterns, helpers (`buildCasMock`, `setupSubscriptions`), and test ID numbering scheme (T093+)
