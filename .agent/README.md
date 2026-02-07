# .agent Directory Structure

This directory serves as the "brain" and "instruction manual" for the AI Agent (Antigravity). It contains context, procedures, and rules that ensure consistent and high-quality development.

## 1. /rules.md (Required)
Defines the **inymmovable constraints** and **guardrails** for the project. Code style, testing policies, and architectural decisions live here.

## 2. /workflows/*.md (Recommended)
Contains procedural instructions for complex, multi-step tasks. These act as "scripts" for the AI to execute reliably.
Example workflows:
- `setup_dev_env.md`: How to install dependencies and start the dev server.
- `deploy_production.md`: Steps to push to production.
- `database_migration.md`: Safe process for migrating the database.
- `run_tests.md`: How to execute the `vitest` suite properly.

## 3. /knowledge/*.md (Optional)
Stores long-term context and decision records that don't fit into the main `spec/` folder.
- `architecture_decisions.md`: Why we chose Clerk over NextAuth, or Drizzle over Prisma.
- `legacy_context.md`: Information about old systems (if migrating).
- `debugging_guide.md`: Common issues and fixes for this specific project.

## 4. /scratchpad.md (Optional)
A place for the AI or User to jot down ideas, TODOs, or open questions that aren't ready for the main spec.
