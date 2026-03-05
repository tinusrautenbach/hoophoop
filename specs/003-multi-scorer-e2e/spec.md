# Feature Specification: End-to-End Multi-Scorer Browser Testing

**Feature Branch**: `003-multi-scorer-e2e`  
**Created**: March 1, 2026  
**Status**: Draft  
**Input**: User description: "add not only unit tests for this, but run real multi scorer tests against the local server that has hasura running. these tests ideally need to be run from a web browser too make sure all typescripts are working properly"

## Clarifications

### Session 2026-03-01

- Q: How should Playwright handle Clerk authentication for multiple isolated test users? → A: Use Clerk Testing Tokens: Authenticate via `clerk.authenticateWithToken()` or Clerk's official `@clerk/testing` package.
- Q: How should the suite handle test data teardown to prevent orphans if tests crash? → A: Prefix + Pre-run sweep: Prefix all test games with "[E2E-TEST]" and run a cleanup script that deletes these before every test run.
## User Scenarios & Testing *(mandatory)*

### User Story 1 - Two Scorers Scoring Simultaneously in Real Browsers (Priority: P1)

Developers and CI systems need to run automated browser tests that simulate two different users connected to the same live game via WebSockets. When both users record points almost simultaneously, the end-to-end system (UI → API → Postgres → Hasura → WebSocket → UI) must successfully process both events, display correct totals on both screens, and not drop any data.

**Why this priority**: This validates the entire stack. Unit/integration tests mock the network and database layers, but true concurrency bugs often hide in the WebSocket delivery, React state batching, or full-stack latency.

**Independent Test**: Execute a test script that opens two distinct browser contexts, navigates both to the same live game URL, triggers score buttons simultaneously, and asserts that both DOMs eventually show the correct combined score.

**Acceptance Scenarios**:

1. **Given** two browser sessions (Scorer A and Scorer B) viewing the same game with a score of 0-0, **When** Scorer A clicks "+2 Home" and Scorer B clicks "+3 Guest" at the exact same time, **Then** both browser sessions must display a final score of 2-3 within 2 seconds.
2. **Given** two browser sessions viewing the same game, **When** Scorer A records a foul, **Then** Scorer B's browser must reflect the updated team and player foul counts without requiring a manual refresh.
3. **Given** two browser sessions where Scorer A deletes a previously recorded event, **When** the deletion completes, **Then** Scorer B's game log must immediately remove the event and correct the displayed totals.

---

### User Story 2 - Viewer vs Scorer Role Enforcement (Priority: P1)

The system must ensure that users with "viewer" roles cannot mutate game state, even by manipulating the frontend UI or API requests. The test suite must simulate a viewer attempting to score while a legitimate scorer is actively scoring, verifying that the viewer's actions are rejected by the backend and do not corrupt the active game state.

**Why this priority**: Security and data integrity. Real browsers can be manipulated, and we must prove the server (Hasura RLS and Next.js APIs) correctly enforces roles end-to-end.

**Independent Test**: Execute a test script with two browser contexts (one authenticated as an owner/scorer, one as a viewer). Verify the viewer cannot interact with scoring controls, and if forced via script, the backend rejects it.

**Acceptance Scenarios**:

1. **Given** a browser session authenticated as a viewer, **When** the game page loads, **Then** all scoring controls (score buttons, foul buttons, timer controls) must be disabled or hidden.
2. **Given** a browser session authenticated as a viewer and one as a scorer, **When** the scorer records points and the viewer simultaneously attempts to force an API score request, **Then** the scorer's points are recorded, the viewer receives an authorization error, and both screens show only the scorer's points.

---

### User Story 3 - Automated Setup and Teardown for Local Dev (Priority: P2)

Developers need a seamless way to run these tests locally against a running development server (Next.js + Postgres + Hasura) without manually setting up test data, user accounts, or game state. The test suite must handle creating test users, authenticating them, generating a test game, and cleaning up afterward.

**Why this priority**: If E2E tests are hard to run, developers won't run them. Frictionless execution is critical for long-term maintenance.

**Independent Test**: Run the test command on a fresh development environment and observe it successfully seed data, execute browser actions, and report success without manual intervention.

**Acceptance Scenarios**:

1. **Given** a running local development environment, **When** the developer runs the E2E test command, **Then** the suite automatically provisions two test users, creates a live game, and authenticates the browser contexts before executing scenarios.
2. **Given** a completed E2E test run, **When** the suite exits, **Then** the created test games and events are cleaned up or isolated so they do not pollute the local development database for subsequent runs.

---

### Edge Cases

- Network latency: How do the tests handle varying response times from the local Hasura instance?
- Authentication state: Can two browser contexts share the same Clerk authentication state, or must they be strictly isolated?
- UI rendering delays: Do the tests properly wait for React to render the WebSocket updates before asserting?
- What happens if the test teardown fails and leaves orphan games in the database? (Resolved: Pre-run sweep script deletes any games prefixed with `[E2E-TEST]`)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST integrate an end-to-end browser testing framework (e.g., Playwright) capable of managing multiple isolated browser contexts simultaneously.
- **FR-002**: The E2E suite MUST include a test that drives two browsers to perform score mutations on the same game at the same time and verifies the correct arithmetic sum on both screens.
- **FR-003**: The E2E suite MUST include a test that verifies WebSocket event propagation (e.g., Scorer A deletes an event, Scorer B's UI updates).
- **FR-004**: The E2E suite MUST include a test verifying role-based UI restrictions (viewers cannot see/use scoring buttons).
- **FR-005**: The tests MUST run against the actual local stack (Next.js server, PostgreSQL, Hasura) rather than mocked network layers.
- **FR-006**: The E2E suite MUST include automated setup/teardown hooks to provision test games and authenticate users via Clerk's official testing token mechanism (e.g., `@clerk/testing` package) to ensure reliable, CAPTCHA-free logins.
- **FR-007**: The tests MUST explicitly wait for UI state to settle after WebSocket events are received before making assertions.
- **FR-008**: The test configuration MUST define timeouts appropriate for local full-stack execution (allowing for database and GraphQL overhead).
- **FR-009**: The E2E suite MUST prefix all generated test data (games, teams) with a specific identifier (e.g., `[E2E-TEST]`) and include a pre-run cleanup script to sweep away orphaned data from previous crashed runs.

### Key Entities

- **Browser Context**: An isolated browsing session with its own cookies, local storage, and authentication state, representing a distinct user.
- **Test User**: A programmatic user account (owner, co_scorer, or viewer) provisioned specifically for the duration of the test.
- **E2E Test Runner**: The framework orchestrating the browsers, making assertions against the DOM, and managing the test lifecycle.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The E2E test suite successfully executes a 2-scorer concurrent update scenario, with both browsers arriving at the correct final score exactly 100% of the time over 10 consecutive runs.
- **SC-002**: The suite provisions its own test data and completes a full execution (all scenarios) in under 2 minutes on a standard developer machine.
- **SC-003**: The E2E test command provides clear console output indicating whether the full stack (Next.js, DB, Hasura) is correctly communicating.
- **SC-004**: Test execution leaves the database in a clean state, enforced by a pre-run cleanup script that successfully identifies and removes 100% of orphaned data from previous runs.

## Assumptions

- The local development environment (Next.js, Postgres, Hasura) is already running before the test suite is invoked, or the suite uses a tool like `start-server-and-test` to manage it.
- Clerk provides a testing mechanism (e.g., bypass tokens, local testing keys, or a programmatic login API) that allows Playwright to authenticate users without manual CAPTCHAs or 2FA.
- The term "multi-threaded" in the user prompt is interpreted as "multi-browser context" in the E2E testing domain, simulating real-world concurrency.
- Playwright is the preferred E2E framework due to its strong support for multiple isolated browser contexts and WebSocket interception/waiting, though Cypress could also be evaluated during planning.
