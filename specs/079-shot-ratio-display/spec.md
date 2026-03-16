# Feature Specification: Shot Ratio Display in Game Log

**Feature Branch**: `079-shot-ratio-display`  
**Created**: 2026-03-16  
**Status**: Draft  
**Input**: User description: "Display shot ratio (made/attempts) in game log for score and miss events. For each scoring event or miss event, show the player's cumulative shot ratio for that shot type (1PT, 2PT, or 3PT). For example, a miss event showing '-2 (1/3)' means the player missed a 2-pointer and has made 1 of their 3 two-point attempts so far in the game."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Shot Ratio on Score Events (Priority: P1)

A scorer or spectator viewing the game log sees each scoring event displayed with the player's cumulative made/attempts ratio for that shot type. This helps track shooting performance in real-time without needing to calculate totals manually.

**Why this priority**: This is the core value proposition — seeing shooting efficiency at a glance during live scoring. Score events are the most common event type in the game log.

**Independent Test**: Create a game with multiple scoring events for a player, then verify each score event displays the correct (made/attempts) ratio based on all events up to that point in chronological order.

**Acceptance Scenarios**:

1. **Given** a game where Player A has made 2 two-pointers and missed 1 two-pointer, **When** Player A scores another two-pointer, **Then** the game log displays "+2 (3/4)" indicating 3 made out of 4 total 2PT attempts
2. **Given** a game where Player A has 0 attempts of any type, **When** Player A makes a free throw, **Then** the game log displays "+1 (1/1)"
3. **Given** a game with multiple players and shot types, **When** viewing the game log, **Then** each score event shows only that specific player's ratio for that specific shot type

---

### User Story 2 - View Shot Ratio on Miss Events (Priority: P1)

A scorer or spectator viewing the game log sees each miss event displayed with the player's cumulative made/attempts ratio for that shot type. This provides context for whether poor shooting is improving or persisting.

**Why this priority**: Miss events are equally important for understanding shooting performance. Seeing the ratio on misses helps identify shooting slumps and whether a player is having an off night.

**Independent Test**: Create a game with miss events, then verify each miss displays the correct ratio including both made and missed attempts up to that point.

**Acceptance Scenarios**:

1. **Given** a game where Player A has made 1 three-pointer and missed 2 three-pointers, **When** Player A misses another three-pointer, **Then** the game log displays "-3 (1/4)" indicating 1 made out of 4 total 3PT attempts
2. **Given** a game where Player A has 0 attempts, **When** Player A misses a shot, **Then** the game log displays "-X (0/1)" where X is the point value
3. **Given** a player with mixed shot types (1PT, 2PT, 3PT), **When** viewing the game log, **Then** each event shows the correct ratio for that specific shot type independently

---

### User Story 3 - Real-Time Ratio Updates (Priority: P2)

As events are added, edited, or deleted during a live game, the shot ratio for each displayed event updates to reflect the current state of all events in chronological order.

**Why this priority**: Ensures accuracy during live game operations where scorers may need to correct mistakes.

**Independent Test**: Add events, edit an event, delete an event, and verify all affected ratios update correctly.

**Acceptance Scenarios**:

1. **Given** a displayed event showing "(2/5)", **When** an earlier event for that player is deleted, **Then** the ratio updates to reflect the new total (e.g., "(2/4)")
2. **Given** a displayed event showing "(2/5)", **When** a new event is added for that player, **Then** all subsequent event ratios update to include the new event in their calculations
3. **Given** a miss event showing "-2 (1/3)", **When** that miss event is deleted, **Then** the ratio for other events of the same type updates to (1/2)

---

### Edge Cases

- What happens when a player has events for the same shot type but for different teams (traded mid-game)? → Ratio accumulates across teams for same player (acceptable behavior — player switching teams mid-game is extremely rare).
- What happens when an event's type is changed from 'score' to 'miss' or vice versa? → The ratio recalculates based on the new type; made count and attempts count update accordingly.
- What happens when event chronology is ambiguous (events with same timestamp)? → Events are sorted by creation time as a secondary sort key.
- What happens for players not in the roster (ad-hoc entries)? → Ratio is calculated the same way using player name matching.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game log MUST display a shot ratio "(made/attempts)" for every event with type 'score' or 'miss' that has a value in {1, 2, 3}
- **FR-002**: The ratio MUST be calculated cumulatively for each player + shot value combination (e.g., all 2PT events for Player A)
- **FR-003**: The ratio MUST include all events up to and including the current event, sorted chronologically (oldest first)
- **FR-004**: Made count MUST be the number of events with type 'score' for that player and shot value
- **FR-005**: Attempts count MUST be the number of events with type 'score' or 'miss' for that player and shot value
- **FR-006**: The ratio display MUST be styled distinctly from the point value (e.g., muted color, smaller font, or parenthetical)
- **FR-007**: The ratio MUST update when events are added, edited, or deleted during the game
- **FR-008**: Events without a player assigned MUST NOT display a ratio (show point value only)
- **FR-009**: Events with type other than 'score' or 'miss' MUST NOT display a ratio

### Key Entities

- **GameEvent**: The scoring or miss event containing type ('score' or 'miss'), player name, value (1PT/2PT/3PT), team, and timestamp
- **Shot Ratio**: Calculated value (made/attempts) derived from all GameEvents for a specific player + shot value combination
- **Game Log**: The chronological display of all game events with their associated ratios

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Scorers can view shot ratios on game log events without any manual calculation
- **SC-002**: Shot ratios are accurate at all times during live game operations
- **SC-003**: All events display ratios within 50ms of any event modification (add, edit, delete)
- **SC-004**: The ratio display does not obscure or interfere with the primary event information (type, player, points)
- **SC-005**: Calculations handle games with 100+ events without noticeable performance degradation

### Assumptions

- Events are stored with player name (string) rather than player ID; ratio calculation uses exact string matching for player identification
- Shot value (1, 2, 3) determines shot type; different values are tracked independently
- The game log is displayed in reverse chronological order (newest first) but ratio calculation uses chronological order (oldest first)
- Events without a player field (rare edge case) will not show a ratio; this is acceptable per FR-008
- The ratio is calculated client-side from the events array; no additional API endpoints are required
