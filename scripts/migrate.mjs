import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const runMigrate = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not defined');
    }

    const connectionString = process.env.DATABASE_URL;
    const sql = postgres(connectionString, { max: 1 });
    const db = drizzle(sql);

    console.log('[Migrate] Running migrations...');

    const start = Date.now();
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    const end = Date.now();

    console.log(`[Migrate] Migrations completed in ${end - start}ms`);
    
    // Verify tables exist
    console.log('[Migrate] Verifying Hasura sync tables...');
    const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('game_states', 'hasura_game_events', 'timer_sync')
    `;
    
    console.log(`[Migrate] Found ${tables.length}/3 Hasura tables: ${tables.map(t => t.table_name).join(', ') || 'none'}`);
    
    if (tables.length < 3) {
        console.warn('[Migrate] WARNING: Some Hasura tables are missing!');
    }
    
    await sql.end();
    console.log('[Migrate] Migration complete, proceeding...');
};

runMigrate().catch((err) => {
    console.error('[Migrate] Migration failed');
    console.error(err);
    process.exit(1);
});
