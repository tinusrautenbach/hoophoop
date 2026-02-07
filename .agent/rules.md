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

## 6. Version Control & Git Workflow
- **Branch Strategy**: Feature branching is mandatory.
  - Format: `feature/short-description` (e.g., `feature/auth-setup`, `feature/scorer-ui`).
  - Never commit directly to `main` for substantial changes.
- **Commit Messages**: Conventional Commits format is preferred (e.g., `feat: add login page`, `fix: correct scoring bug`).
- **Merge Criteria**:
  1.  Unit tests must pass.
  2.  Linter must pass.
  3.  **User Approval**: The agent must ask for confirmation/approval before merging a feature branch into `main`.
  4.  **Sync**: After merging into `main`, immediately execute `git push` to keep the remote repository synchronized.

## 7. Database Management
- **Schema as Code**: All database changes must be defined in `src/db/schema.ts` (Drizzle ORM).
- **Version Control**: Migration files (`drizzle/migrations/*.sql`) must be committed to Git.
- **Workflow**:
  1.  Modify `schema.ts`.
  2.  Run `npx drizzle-kit generate` to create the migration file.
  3.  Commit both the schema change and the new SQL migration file.
  4.  Never manually edit the database schema in production.

## 8. Project Management
- **Status Tracking**: The `spec/implementation_plan.md` file must be kept up-to-date.
- **Completion**: When a task from the plan is completed, verify it and then mark it with `[x]`.
