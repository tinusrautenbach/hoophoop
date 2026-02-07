# Database Migration Workflow

## 1. Create Migration
When you modify `src/db/schema.ts`:

1.  **Generate SQL**:
    ```bash
    npx drizzle-kit generate
    ```
    This creates a new `.sql` file in `drizzle/migrations/`.

2.  **Verify**: Check the generated SQL file to ensure it matches your expectations.

## 2. Apply Migration (Development)
To apply changes to the local development database:

1.  **Migrate**:
    ```bash
    npx drizzle-kit migrate
    ```

## 3. Production Deployment
In production, migrations should typically be run as part of the build or deployment pipeline, using `drizzle-kit migrate` or a custom migration script within the Node.js app on startup.
