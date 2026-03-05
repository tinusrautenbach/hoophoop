# Feature Specification: Fix Deprecated Middleware File Convention

**Feature Branch**: `004-fix-middleware-proxy`  
**Created**: 2026-03-02  
**Status**: Draft  
**Input**: User description: "remove this error on server startup: ⚠ The middleware file convention is deprecated. Please use proxy instead."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean Server Startup (Priority: P1)

A developer starting the local dev server sees no deprecation warnings in the terminal output. The application behaves identically to before — authentication, route protection, and public route access all work as expected.

**Why this priority**: The warning appears on every server start, creating noise that can obscure real errors. Fixing it is a one-step file rename with zero functional impact.

**Independent Test**: Start the dev server and confirm the deprecation warning no longer appears. Verify that protected routes still require authentication and public routes remain accessible.

**Acceptance Scenarios**:

1. **Given** the dev server is stopped, **When** `bun run dev` is executed, **Then** the startup output does not contain "middleware file convention is deprecated"
2. **Given** the server is running, **When** a protected route is accessed without authentication, **Then** the user is redirected to sign-in (unchanged behaviour)
3. **Given** the server is running, **When** a public route is accessed without authentication, **Then** the page loads normally (unchanged behaviour)

---

### Edge Cases

- The renamed file must export the same `config` matcher so route matching is unaffected.
- Any CI scripts or tooling referencing `middleware.ts` by explicit path must also be updated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The proxy/request-intercept file MUST reside at the path expected by the current framework version.
- **FR-002**: All existing route-protection and public-route logic MUST be preserved without modification.
- **FR-003**: Server startup output MUST NOT contain the deprecation warning after the change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero deprecation warnings related to the middleware/proxy file convention appear on server startup.
- **SC-002**: All previously protected routes continue to require authentication.
- **SC-003**: All previously public routes remain accessible without authentication.
