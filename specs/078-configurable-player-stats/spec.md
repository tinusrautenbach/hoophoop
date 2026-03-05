# Feature Specification: Configurable Player Statistics

**Feature Branch**: `078-configurable-player-stats`  
**Created**: 2026-03-05  
**Status**: Draft  
**Input**: User description: "Support configurable player statistics during scoring (turnovers, defensive rebounds, rebounds, assists, steals, blocks, etc.) with a configurable interface allowing users to select which stats to track per game, enabling multi-scorer games where different scorers focus on different stats"

---

## User Scenarios & Testing

### User Story 1 - Configure Game Stats (Priority: P1)

A game creator sets up a new game and configures which player statistics will be tracked during the game. They select from a list of available stats (points, rebounds, assists, steals, blocks, turnovers, defensive rebounds, offensive rebounds) and enable only the ones relevant to their game format.

**Why this priority**: This is the foundation feature - without stat configuration, the multi-scorer stat tracking cannot work. It defines the "contract" for what data will be collected.

**Independent Test**: Create a new game, open the stat configuration panel, enable/disable various stats, save the configuration, and verify the scoring interface only shows buttons for the enabled stats.

**Acceptance Scenarios**:

1. **Given** a user creating a new game, **When** they access the game settings, **Then** they see a "Statistics Configuration" section with toggle switches for each available stat type.

2. **Given** a game with points and rebounds enabled, **When** a scorer opens the scoring interface, **Then** they see quick-access buttons for recording points and rebounds, but not for assists or steals.

3. **Given** a game in progress with specific stats enabled, **When** the game creator tries to disable a stat that already has recorded data, **Then** the system warns about existing data and requires confirmation before disabling.

4. **Given** a game configuration with all stats disabled except points, **When** the game starts, **Then** the scoring interface shows a simplified view focused only on scoring actions.

---

### User Story 2 - Multi-Scorer Stat Focus (Priority: P1)

Two scorers are scoring the same game simultaneously. Scorer A focuses on recording points and fouls while Scorer B focuses on recording rebounds and assists. Both see only the stat buttons relevant to their assigned focus, and all stats are aggregated correctly in real-time across both scorers.

**Why this priority**: This delivers the core value proposition - enabling distributed scoring where different people can focus on different aspects of the game without getting overwhelmed by too many buttons.

**Independent Test**: Set up a game with 4+ stats enabled, open the game in two browser tabs as different scorers, configure each scorer's "stat focus" differently, record various stats from both scorers, and verify all stats appear correctly in the game log and box score.

**Acceptance Scenarios**:

1. **Given** a game with multiple stats enabled, **When** a scorer opens their scoring view, **Then** they see a "My Stat Focus" selector where they can choose which 2-3 stats to display as quick-access buttons.

2. **Given** Scorer A has selected points and rebounds as their focus, **When** they look at the scoring interface, **Then** they see prominent buttons for points and rebounds, with other stats accessible via a "More Stats" menu.

3. **Given** two scorers are recording different stats simultaneously, **When** Scorer A records a rebound and Scorer B records an assist at the same time, **Then** both events appear in the game log within 500ms and both update the player's stat totals correctly.

4. **Given** a scorer wants to record a stat not in their primary focus, **When** they tap "More Stats", **Then** a modal or expanded view shows all enabled stats for the game, allowing them to record any enabled stat.

5. **Given** a player has stats recorded by multiple scorers, **When** viewing the box score, **Then** all recorded stats are aggregated and displayed as a single row per player with all their totals.

---

### User Story 3 - Stats Display and Aggregation (Priority: P2)

After the game, coaches and players view the complete statistics in the box score and individual player profiles. The stats are correctly aggregated even though different scorers recorded different stat types during the game.

**Why this priority**: Important for post-game analysis and player tracking, but the game can function without it (stats are still stored even if display isn't perfect).

**Independent Test**: Complete a game with stats recorded by multiple scorers, open the box score view, and verify all player stats are correctly summed and displayed. Check that season stats correctly aggregate across multiple games with different stat configurations.

**Acceptance Scenarios**:

1. **Given** a completed game with stats recorded by multiple scorers, **When** viewing the box score, **Then** each player shows their complete stat line with all recorded categories.

2. **Given** a player has participated in multiple games with different stat configurations, **When** viewing their season stats, **Then** the system shows per-game breakdowns and only aggregates stats that were tracked in each specific game.

3. **Given** a game had rebounds disabled during play, **When** viewing that game's box score later, **Then** the rebound column shows "N/A" or is hidden rather than showing zeros.

---

### Edge Cases

- What happens when a scorer tries to record a stat that was disabled after the game started?
  → The system prevents recording disabled stats; the button is hidden or disabled with a tooltip explaining "This stat is not tracked for this game."

- What happens when two scorers record the same stat for the same player simultaneously?
  → Both events are recorded (duplicate entries) but the UI warns about potential duplicates; the admin can merge duplicate events if needed.

- What happens when a game is switched from "Simple" mode to "Advanced" mode mid-game?
  → The stat configuration becomes available; previously recorded stats are preserved; new stats can be enabled and recorded going forward.

- What happens when a stat is disabled mid-game after data has been recorded?
  → Existing data is preserved but hidden from the main view; a warning is shown that disabling affects visibility, not data integrity.

- How does the system handle a scorer who wants to see all stats, not just their focus?
  → The "More Stats" button or an expand option always provides access to all enabled stats.

- What happens when a stat event is edited multiple times by different scorers?
  → Full version history is maintained showing each change with scorer attribution, timestamp, and what was modified. Previous versions remain viewable in an audit log.

---

## Requirements

### Functional Requirements

**Game-Level Configuration**
- **FR-001**: System MUST allow game creators to configure which player statistics are tracked for each game independently.
- **FR-002**: System MUST support the following stat types: Points (1PT, 2PT, 3PT), Rebounds (Offensive, Defensive - with Total derived automatically), Assists, Steals, Blocks, Turnovers, Personal Fouls.
- **FR-003**: System MUST persist the stat configuration with the game and apply it to all scoring sessions for that game.
- **FR-004**: System MUST allow stat configuration changes before the game starts without restrictions.
- **FR-005**: System MUST warn users when attempting to disable a stat that has existing recorded data for that game.

**Scorer Interface**
- **FR-006**: System MUST allow each scorer to select a "Stat Focus" of 1-3 primary stats that appear as quick-access buttons.
- **FR-007**: System MUST provide access to all enabled stats via a "More Stats" or expanded view, regardless of the scorer's primary focus.
- **FR-008**: System MUST synchronize stat configurations across all connected scorers in real-time.
- **FR-009**: System MUST visually distinguish between primary focus stats and secondary stats in the scoring interface.

**Data Recording**
- **FR-010**: System MUST record each stat event with: player, stat type, value, timestamp, period, clock time, and scorer attribution.
- **FR-011**: System MUST support stat recording via the existing event system (game_events table) with appropriate metadata.
- **FR-012**: System MUST aggregate stats per player in real-time for display in the box score.
- **FR-016**: System MUST allow any scorer to edit or delete any stat event at any time without time restrictions (trust-based model).
- **FR-017**: System MUST track full edit history with scorer attribution for all changes, including original creation, edits, and deletions.

**Display and Reporting**
- **FR-013**: System MUST display only enabled stats in the game box score, hiding or marking disabled stats appropriately.
- **FR-014**: System MUST aggregate season stats accounting for games where certain stats were not tracked.
- **FR-015**: System MUST show per-game stat breakdowns in player profiles, indicating which stats were tracked in each game.

### Key Entities

- **GameStatConfig**: Configuration of which stats are enabled for a specific game. Tied to the games table, editable by game owner before/during game. Can inherit from season/community defaults.
- **PlayerStatEvent**: Individual stat recording event (e.g., "Player 23 got 1 rebound at 4:32 in Q2"). Stored in game_events with metadata. Includes full audit trail: createdBy, createdAt, modifiedBy, modifiedAt, version history for accountability.
- **StatType**: Enumeration of supported statistics. Primary stats (recorded by scorers): points_1pt, points_2pt, points_3pt, rebound_off, rebound_def, assist, steal, block, turnover, foul. Derived stats (calculated automatically): points_total (sum of all point types), rebound_total (rebound_off + rebound_def).
- **ScorerStatFocus**: Per-scorer preference for which stats they want as quick-access buttons. Two-level persistence: (1) Global user preference as default for new games, (2) Per-game override remembered for returning to the same game.
- **PlayerGameStats**: Aggregated stats for a player in a specific game. Derived from PlayerStatEvents. Automatically calculates derived stats (e.g., total rebounds = offensive + defensive).

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Scorers can configure their stat focus and begin recording within 10 seconds of joining a game.
- **SC-002**: Stat events from multiple scorers appear in the game log within 500ms for 95% of events under normal load.
- **SC-003**: Box score correctly aggregates stats from multiple scorers with 100% accuracy (verified by summing individual events).
- **SC-004**: Games with 6+ enabled stats remain usable on 375px-wide mobile screens without requiring horizontal scrolling.
- **SC-005**: Scorers report that the stat focus feature reduces interface clutter and improves scoring speed (measured via user feedback).
- **SC-006**: Zero data loss when scorers record different stats simultaneously (all events persisted and retrievable).

---

## Clarifications

### Session 2026-03-05

- **Q: Should stat configuration be per-game only, or should there be community/season-level defaults?** → **A: Add community/season-level defaults with per-game override - leagues set standard stats, individual games can customize**
- **Q: How should rebound stats (Total, Offensive, Defensive) relate to each other?** → **A: Track offensive and defensive separately, automatically derive total (offensive + defensive = total)**
- **Q: Should scorer stat focus persist for future games or reset per game?** → **A: Persist per-game with optional global default - remember focus per game, use global default for new games**
- **Q: How should stat event corrections/undo work?** → **A: No restrictions - any scorer can edit/delete any stat event at any time**
- **Q: Should the system track who made each edit for accountability?** → **A: Yes, track full edit history with scorer attribution for all changes**

---

## Assumptions

- Stat configuration has a hierarchy: Community/Season-level defaults → Per-game override. Games inherit from their season/community but can customize.
- Points (1PT, 2PT, 3PT) are considered separate stat types but grouped visually in the interface.
- The existing game_events table structure can accommodate stat events with appropriate metadata.
- Stat aggregation is calculated on-demand from events (not pre-computed) to ensure accuracy.
- All scorers can see which stats other scorers are focusing on to avoid duplication.
