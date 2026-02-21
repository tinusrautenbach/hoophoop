# Project Rules & Guardrails

This file defines the strict rules and guidelines for this project. Antigravity AI (and any other developer) must follow these rules at all times.

## 1. Backend Development Policy
- **Strict TDD**: No backend logic (services, API routes) shall be written without a corresponding test file.
- **Testing Framework**: All tests must use `Vitest`.
- **Reference**: See `spec/test_policy.md` for detailed workflow.

## 2. Frontend & Design
- **Mobile-First**: All UI components must be designed for mobile screens first `(min-width: 0px)` and scale up.
- **Touch Targets**: Buttons and interactive elements must have a minimum height of 44px.
- **Styling**: Use `Tailwind CSS` utility classes. Do not use standard CSS files unless absolutely necessary for global resets.
- **Components**: Use `Shadcn UI` for base components. Do not reinvent the wheel.

## 3. Code Quality & Standards
- **TypeScript**: Use strict typing. Avoid `any` at all costs.
- **Linter**: Ensure no linting errors before finishing a task.
- **Clean Architecture**: Keep business logic in `services/`, not inside API routes or UI components.

## 4. User Management
- **Auth Provider**: Clerk.
- **No Local User Table**: Do not create a redundant `users` table. Rely on Clerk's `userId`.

## 5. Deployment
- **Docker**: The application must run via `docker-compose up`.
- **Environment Variables**: All secrets must be in `.env`, never hardcoded.

## 6. Version Control & Git Workflow (REQUIRED)
- **Branch Strategy**: Feature branching is mandatory for ALL new features.
  - Format: `feature/short-description` (e.g., `feature/auth-setup`, `feature/scorer-ui`).
  - Never commit directly to `main` for any changes, including documentation updates.
  - Always create a new branch before starting work on a feature.
- **Pull Request Workflow** (Mandatory for all features):
  1.  Create feature branch: `git checkout -b feature/description`
  2.  Make changes and commit with Conventional Commits format (e.g., `feat: add login page`, `fix: correct scoring bug`, `docs: update rules`)
  3.  Push branch to remote: `git push -u origin feature/description`
  4.  Create Pull Request using `gh pr create` with descriptive title and body
  5.  Wait for automated checks (tests, lint) to pass
  6.  Request user review and approval
  7.  Merge using `gh pr merge` (squash or merge commit based on preference)
  8.  Delete feature branch after merge: `git branch -d feature/description` and `git push origin --delete feature/description`
- **Commit Messages**: Conventional Commits format is required (e.g., `feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- **Merge Criteria**:
  1.  Unit tests must pass.
  2.  Linter must pass.
  3.  **User Approval**: The agent must ask for confirmation/approval before merging a feature branch into `main`.
  4.  **Sync**: After merging into `main`, immediately execute `git push` to keep the remote repository synchronized.

## 7. Testing Policy
- **Automated Tests**: Every new service or logic-heavy API route must have a corresponding `.test.ts` file using Vitest.
- **Visual Verification**: After implementing UI changes, the agent MUST use the `browser_subagent` to visually verify the results (screenshots/interaction) before completing the task.
- **Pre-Merge**: All automated tests must pass before any merge into `main`.

## 8. Database Management
- **Schema as Code**: All database changes must be defined in `src/db/schema.ts` (Drizzle ORM).
- **Version Control**: Migration files (`drizzle/migrations/*.sql`) must be committed to Git.
- **Workflow**:
  1.  Modify `schema.ts`.
  2.  Run `npx drizzle-kit generate` to create the migration file.
  3.  Commit both the schema change and the new SQL migration file.
  4.  Never manually edit the database schema in production.

## 9. Project Management
- **Status Tracking**: The `spec/implementation_plan.md` file must be kept up-to-date.
- **Completion**: When a task from the plan is completed, verify it and then mark it with `[x]`.
- **Synchronization**: `spec/outstanding_tasks.md` is a subset of `spec/implementation_plan.md`. Both files must be kept in sync. When a task is marked as complete in one, it must be removed from `spec/outstanding_tasks.md`.

## 10. MCP Configuration
- **Database Access**: Always use the `dbhub-bball` MCP server for database operations instead of the general `dbhub` server.

## 11. Security Testing Policy (REQUIRED)
- **Reference**: See `spec/security_tests.md` for comprehensive security testing plan.
- **Test Frequency Enforcement**:
  - **Every Commit**: Automated security tests must pass before merge (run `npm run test:security`)
  - **Weekly (Mondays)**: Dependency vulnerability scan (`npm audit --audit-level=moderate`)
  - **Monthly (1st of month)**: Full security audit - all test categories
  - **Quarterly**: Penetration testing and external security review
- **Tracking**: Update `spec/security_test_schedule.md` with last run dates after each test cycle
- **Blocking**: High/Critical security findings must be resolved before deployment
- **Mock Auth Check**: Never deploy with `NEXT_PUBLIC_USE_MOCK_AUTH=true` in production

## 12. Pre-Merge Verification & CI/CD Requirements (REQUIRED)

### 12.1 Mandatory Automated Checks
Before ANY merge to `main`, ALL of the following MUST pass:
1. ✅ **Unit Tests** - All Vitest tests must pass (0 failures)
2. ✅ **Linting** - ESLint must pass with zero errors
3. ✅ **Type Checking** - TypeScript must compile without errors
4. ✅ **Security Audit** - No high or critical vulnerabilities in `npm audit`
5. ✅ **CI Workflow** - GitHub Actions CI workflow must be green

### 12.2 Agent Pre-Merge Verification Protocol
The agent MUST complete this checklist before requesting merge approval:

1. **Local Verification** (before pushing):
   ```bash
   npm run lint
   npm run test
   ```
   - Verify both commands exit with code 0

2. **GitHub Verification** (after creating PR):
   - Check PR page shows "All checks have passed"
   - Verify no failing workflows
   - Review any coverage reports

3. **User Approval Request**:
   - Summarize test results in approval request
   - Confirm all status checks are green
   - Wait for explicit "yes" before merging

### 12.3 Deployment Pipeline Overview
- **On PR**: CI workflow runs automatically
- **On Merge**: Deploy workflow triggers Coolify webhook
- **Blocking**: Failed tests BLOCK deployment (no exceptions)
- **Notifications**: PR comments show deployment status

### 12.4 Branch Protection Rules (MUST ENABLE)
Repository owner MUST enable these settings:
- Settings → Branches → Add rule for `main`
- ☑️ Require a pull request before merging
- ☑️ Require status checks to pass
  - Select: `ci / lint`
  - Select: `ci / typecheck`
  - Select: `ci / security`
  - Select: `ci / test`
- ☑️ Require conversation resolution before merging
- ☑️ Include administrators (apply to owners too)

### 12.5 Emergency Procedures
Even for urgent hotfixes:
1. Create feature branch: `git checkout -b hotfix/critical-bug`
2. Make minimal, focused changes
3. Run full verification: `npm run lint && npm run test`
4. Create PR and wait for ALL checks to pass
5. Request expedited review but DO NOT bypass checks
6. Merge only after green status

### 12.6 Failure Handling
If CI checks fail:
1. **DO NOT MERGE** - Block merge until fixed
2. Review failing workflow logs in GitHub Actions
3. Fix issues locally on feature branch
4. Push fixes and wait for re-check
5. Repeat until all checks pass
