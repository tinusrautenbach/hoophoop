# Feature Specification: Scorer Page UX Improvements

**Feature Branch**: `080-scorer-ux-improvements`  
**Created**: 2026-03-17  
**Status**: Draft  
**Input**: "Improve scorer page UI for responsive design across mobile portrait, mobile landscape, tablet, and PC with optimized touch targets, click efficiency, and legibility for fast-paced basketball scoring"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fast Player Scoring (Priority: P1)

As a basketball scorer using a mobile phone during an intense game, I need to record scores for the same player multiple times in quick succession without re-selecting the player each time, so that I can keep up with rapid gameplay and not miss any action.

**Why this priority**: Basketball games have rapid scoring sequences where the same player often scores multiple baskets consecutively. Reducing the click count from 3 to 2 for repeat scorers directly impacts game accuracy and scorer stress during fast-paced moments.

**Independent Test**: Can be fully tested by selecting a player, scoring for them, and then verifying that a shortcut to score again for the same player appears, reducing subsequent scores from 3 clicks to 2.

**Acceptance Scenarios**:

1. **Given** a player has just scored, **When** the scoring modal closes, **Then** a "Score Again for [Player]" quick-action button appears in the scoring interface (portrait and landscape)
2. **Given** the quick-action button is visible, **When** tapped, **Then** the scoring modal opens with that player pre-selected, requiring only the point value to be chosen
3. **Given** a different player is selected or the game state changes significantly (timeout, period end), **When** the scorer returns to the main interface, **Then** the quick-action button updates to reflect the current context or disappears if no recent scorer

---

### User Story 2 - Touch Target Visibility (Priority: P1)

As a scorer using the app outdoors or in varying lighting conditions, I need all interactive elements to be clearly visible and large enough to tap reliably, so that I can operate the interface without looking twice or making errors.

**Why this priority**: Touch targets that are too small or have insufficient contrast cause errors during fast gameplay. The period display, game log action icons, and connection indicator are currently below WCAG 2.5.5 minimum touch target recommendations.

**Independent Test**: Can be fully tested by measuring touch target sizes and verifying all interactive elements meet minimum 48×48pt size requirements across all device layouts.

**Acceptance Scenarios**:

1. **Given** the scorer page in portrait mode, **When** displayed on any supported device, **Then** all primary scoring buttons (+2, +3, +1) have touch targets ≥ 60×60pt
2. **Given** the scorer page in landscape mode, **When** displayed on any supported device, **Then** the period indicator has a touch target ≥ 48×48pt and text size ≥ 12pt
3. **Given** the scorer page at any orientation, **When** displayed, **Then** game log action icons (edit, delete) have touch targets ≥ 32×32pt and visual size ≥ 20×20pt
4. **Given** the scorer page in any mode, **When** the WebSocket connection status is displayed, **Then** the indicator has a minimum visual size of 6×6pt and is legible at arm's length

---

### User Story 3 - Period and Clock Accessibility (Priority: P2)

As a scorer focusing on game action, I need the period number and clock display to be immediately readable at a glance without squinting or focusing, so that I can quickly verify game state while keeping my eyes on the court.

**Why this priority**: Period and clock information is critical for game management decisions (timeouts, fouls management). The current small text sizes require focused attention away from the court.

**Independent Test**: Can be fully tested by displaying the scorer page at all supported orientations and verifying period/clock text meets minimum legibility thresholds.

**Acceptance Scenarios**:

1. **Given** the scorer page in portrait mode, **When** displayed, **Then** the period display shows "P{N}" with text ≥ 14pt and is tappable to advance periods
2. **Given** the scorer page in landscape mode, **When** displayed, **Then** the period display shows "P{N}" with text ≥ 12pt (increased from current 8pt)
3. **Given** the clock display at any orientation, **When** the timer is running or stopped, **Then** the clock digits are ≥ 36pt in portrait and ≥ 28pt in landscape
4. **Given** the period indicator, **When** tapped, **Then** the period advances with visual feedback confirming the action

---

### User Story 4 - Landscape Mode Optimization (Priority: P2)

As a scorer using a tablet or phone in landscape mode, I need the scoring buttons, game log, and action controls to be proportionally sized so that all elements are comfortably tappable without hand strain or accidental mis-taps.

**Why this priority**: Landscape mode is commonly used by tablet users and mobile users who prefer wider view. The current layout has overly compressed elements that reduce usability.

**Independent Test**: Can be fully tested by displaying the scorer page in landscape on multiple device widths and measuring that all buttons maintain ≥ 44pt minimum touch targets even at narrow widths.

**Acceptance Scenarios**:

1. **Given** the scorer page in landscape mode on a 667pt-width device, **When** displayed, **Then** scoring button columns maintain ≥ 44pt width per button
2. **Given** the scorer page in landscape mode, **When** displayed, **Then** the miss buttons (−2, −3, −1) have opacity ≥ 70% (increased from 60%) and padding ≥ 12pt
3. **Given** the scorer page in landscape mode, **When** displayed, **Then** the game log shows at least 8 items with text size ≥ 10pt
4. **Given** the scorer page in landscape mode on a narrow device (< 600pt), **When** displayed, **Then** the "Box Score" navigation button is collapsed or hidden to prioritize scoring controls

---

### User Story 5 - Real-Time Sync Feedback (Priority: P3)

As a scorer experiencing network latency or connectivity issues, I need visual feedback when my scoring actions are in progress or have failed to sync, so that I can avoid double-scoring or missing events during connection problems.

**Why this priority**: Scorers in gymnasiums may experience WiFi/cellular connectivity issues. Without feedback, they may tap multiple times or not realize events failed to sync.

**Independent Test**: Can be fully tested by simulating network conditions and verifying visual feedback appears during mutation states.

**Acceptance Scenarios**:

1. **Given** a scorer taps a scoring button, **When** the mutation is in progress, **Then** the button briefly shows a loading state (subtle pulse, not blocking)
2. **Given** a scoring mutation completes, **When** success, **Then** visual feedback confirms the score was recorded (brief highlight, haptic on mobile)
3. **Given** a scoring mutation fails, **When** the error is detected, **Then** an error toast appears indicating the action failed and offering retry
4. **Given** the WebSocket connection is lost, **When** displayed, **Then** the connection indicator turns red and a toast explains the scorer can continue scoring locally (optimistic updates)

---

### Edge Cases

- What happens when a scorer rapidly taps the same button multiple times? Should debounce and only send one mutation, not queue multiple.
- How does the interface handle orientation changes mid-action? Any open modal should adapt gracefully or maintain scroll position.
- What happens when touch targets overlap on very narrow screens? Elements should collapse or stack rather than overlap.
- How does the last-scored-player shortcut handle player substitutions? Should clear when lineup changes significantly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a "quick repeat" shortcut after a player scores, allowing the scorer to score again for the same player with fewer taps.
- **FR-002**: System MUST display all interactive touch targets at minimum 44×44pt across all device orientations and sizes.
- **FR-003**: System MUST display the period indicator with text ≥ 12pt in landscape mode and ≥ 14pt in portrait mode.
- **FR-004**: System MUST display the game clock with digits ≥ 28pt in landscape mode and ≥ 36pt in portrait mode.
- **FR-005**: System MUST provide visual feedback during scoring mutations (loading state on button, success confirmation).
- **FR-006**: System MUST display the WebSocket connection status with a minimum visual indicator of 6×6pt.
- **FR-007**: System MUST increase the opacity of "miss" buttons in landscape mode from 60% to ≥ 70% for better visibility.
- **FR-008**: System MUST ensure all game log action icons (edit, delete) have touch targets ≥ 32×32pt.
- **FR-009**: System MUST adapt the landscape layout for narrow devices (< 600pt width) by collapsing or hiding secondary navigation controls.
- **FR-010**: System MUST clear the quick-repeat shortcut when lineup changes (substitutions) or a significant game event occurs (timeout, period end).
- **FR-011**: System MUST debounce rapid consecutive taps on scoring buttons to prevent duplicate mutations.
- **FR-012**: System MUST maintain scoring functionality during temporary connection loss using optimistic local updates with eventual sync.

### Key Entities

- **Quick-Action State**: Tracks the last-scoring-player context for the shortcut feature. Includes player ID, team, point type, expiration trigger events.
- **Touch Target Configuration**: Theme/layout constants defining minimum sizes for various element types (primary action, secondary action, navigation).
- **Mutation Feedback State**: Tracks in-flight mutations for visual feedback. Includes mutation ID, target element, status (pending, success, error).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Scorers can record a repeat score for the same player in 2 clicks (down from 3) after initial player selection.
- **SC-002**: All interactive touch targets meet WCAG 2.5.5 minimum of 44×44pt across portrait mobile, landscape mobile, landscape tablet, and desktop views.
- **SC-003**: Period indicator is readable at arm's length (≥ 12pt) in all orientations.
- **SC-004**: Scoring mutations show visual feedback within 100ms of user action.
- **SC-005**: Connection status indicator is visible from 2 meters away.
- **SC-006**: Landscape mode on devices ≥ 600pt wide displays all primary scoring buttons with ≥ 60×60pt touch targets.
- **SC-007**: Game log items are legible with text ≥ 10pt and action icons ≥ 20pt visual size.
- **SC-008**: 90% of scorers can complete a scoring action within 3 seconds during repeated testing scenarios.
- **SC-009**: Zero double-scoring events during rapid-tap testing (5 taps in 1 second).

## Assumptions

- Current Tailwind CSS infrastructure supports responsive design changes without major architectural changes.
- Existing Framer Motion animations can be adjusted for new interaction feedback.
- The scoring modal component can be extended to support pre-selection states.
- WebSocket infrastructure already supports optimistic updates (mutation feedback is display layer only).
- The app is tested primarily on mobile phones (portrait primary) and tablets (landscape primary), with desktop as secondary.

## Out of Scope

- Keyboard shortcuts for desktop users (can be addressed in a follow-up feature).
- Persistent player stats sidebar for large screens (can be addressed in a follow-up feature).
- Advanced gesture-based scoring (swipe to score, long-press for foul).
- Voice-activated scoring.
- Multi-game view for tournament managers.
