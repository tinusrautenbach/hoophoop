# Feature Specification: Automatic Score Recalculation from Game Events

**Feature Branch**: `001-score-recalculation`  
**Created**: March 1, 2026  
**Status**: Draft  
**Input**: User description: "make sure that the total score is always recalculated form game events so that we always know when event is deleted or amended, the total updates correctly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accurate Score After Event Deletion (Priority: P1)

A game scorer realizes they accidentally recorded a scoring event (e.g., entered a 3-pointer when it should have been 2 points) and needs to delete or correct the event. When they remove the incorrect event, the team's total score must immediately reflect the change across all displays and for all viewers watching the game.

**Why this priority**: Core data integrity - incorrect scores undermine the entire platform's value. This is the most critical scenario as score accuracy is the primary purpose of the application.

**Independent Test**: Create a game with scoring events, delete one or more events, and verify the total score updates instantly and correctly for all connected users.

**Acceptance Scenarios**:

1. **Given** a live game with home team scored 10 points (two 3-pointers and two 2-pointers), **When** the scorer deletes one 3-pointer event, **Then** the home team's total score updates to 7 points immediately
2. **Given** multiple users viewing the same game, **When** a scoring event is deleted by one scorer, **Then** all viewers see the updated score within 1 second
3. **Given** a game with 50 scoring events accumulated over 4 periods, **When** an event from period 1 is deleted, **Then** the final score reflects the deletion accurately

---

### User Story 2 - Accurate Score After Event Amendment (Priority: P2)

A scorer needs to correct an event's value (e.g., changing a 2-point shot to a 3-point shot, or reassigning points to the correct player). When they edit the event details, the team total score must recalculate to reflect the amended value.

**Why this priority**: Supports data correction workflows without requiring deletion and re-entry. Enables scorers to maintain accurate records efficiently.

**Independent Test**: Create a game, record scoring events with specific point values, modify event values or player assignments, and verify total scores update correctly.

**Acceptance Scenarios**:

1. **Given** a game where a 2-point basket was recorded, **When** the scorer changes it to a 3-pointer, **Then** the team's total score increases by 1 point immediately
2. **Given** a scoring event assigned to the wrong player on the same team, **When** the scorer reassigns it to the correct player, **Then** the team total remains the same but player statistics update correctly
3. **Given** a game with complex scoring including fouls and field goals, **When** multiple events are amended in sequence, **Then** each amendment triggers accurate score recalculation

---

### User Story 3 - Score Consistency Across Game States (Priority: P3)

Users viewing historical games (completed games) or games in progress need to see scores that accurately reflect the sum of all scoring events, regardless of when events were added, modified, or deleted.

**Why this priority**: Ensures data trustworthiness over time. Users must trust that scores are always derived from the source of truth (events), not stale cached values.

**Independent Test**: View a completed game's final score, make administrative corrections to events, and verify the historical score updates to match the corrected event log.

**Acceptance Scenarios**:

1. **Given** a completed game with a final score of 85-72, **When** an administrator corrects a scoring event from the game log, **Then** the final score display updates to reflect the correction
2. **Given** a game transitioning from "live" to "final" status, **When** the status changes, **Then** the final score matches the sum of all scoring events exactly
3. **Given** a scorer viewing game statistics days after the game, **When** they review the box score, **Then** the displayed totals match the sum of all recorded scoring events

---

### Edge Cases

- What happens when all scoring events for a team are deleted? (Score should become 0, not undefined or stale)
- How does the system handle simultaneous event deletions by multiple scorers? (Last write wins with conflict resolution, or optimistic locking)
- What happens if the score calculation encounters invalid event data (e.g., null point values)? (System should handle gracefully, log error, and show warning to scorer)
- How does the system ensure score integrity during network interruptions or database failures? (Transactions should be atomic; partial updates should roll back)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST recalculate team total scores whenever a scoring event is deleted from a game
- **FR-002**: System MUST recalculate team total scores whenever a scoring event's point value is modified
- **FR-003**: System MUST derive total scores as the sum of all active scoring events, not from a manually maintained counter
- **FR-004**: System MUST propagate score updates to all connected viewers in real-time (within 1 second) when events change
- **FR-005**: System MUST maintain score calculation consistency across game states (scheduled, live, final)
- **FR-006**: System MUST validate score calculations match event totals before marking a game as "final"
- **FR-007**: System MUST handle concurrent event modifications by multiple scorers without score calculation errors
- **FR-008**: System MUST recalculate player individual scores when their scoring events are modified or deleted
- **FR-009**: System MUST provide audit trail showing score changes triggered by event modifications
- **FR-010**: System MUST handle edge cases (all events deleted, zero scores, invalid data) without system failure

### Key Entities

- **Game Event**: Represents an action during a game (score, foul, timeout, etc.) with attributes including event type, point value, associated team, associated player/roster entry, period, game clock timestamp, and creation metadata
- **Game**: Container for all game events with computed total scores (homeScore, guestScore) derived from scoring events
- **Team Score**: Calculated value representing the sum of all scoring event point values for a specific team (home or guest) within a game
- **Score Event**: Subset of game events where type is "score" and includes a point value (e.g., 1 for free throw, 2 for field goal, 3 for three-pointer)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a scoring event is deleted, all connected viewers see the updated total score within 1 second 100% of the time
- **SC-002**: Total score displayed for any game always equals the sum of that game's scoring events with zero tolerance for discrepancy
- **SC-003**: Scorers can delete or modify events during live games without causing score display errors or system crashes in 100% of cases
- **SC-004**: Post-game administrative corrections to scoring events automatically update final scores without manual intervention in 100% of cases

### Assumptions

- Scoring events store point values as integer fields (1, 2, or 3 points typically for basketball)
- The system uses WebSocket-based real-time synchronization for score updates (as indicated in README)
- Multiple scorers can operate on the same game simultaneously (multi-scorer support exists)
- Event deletion is a soft delete or hard delete at the database level (implementation will determine approach)
- Score values are stored in the `games` table as `homeScore` and `guestScore` fields that need to be kept synchronized with event totals
