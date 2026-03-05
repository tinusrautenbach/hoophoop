import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { like } from 'drizzle-orm';
import { games } from '../src/db/schema';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/bball';
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

export async function cleanupE2EGames(): Promise<void> {
  const deleted = await db
    .delete(games)
    .where(like(games.name, '%[E2E-TEST]%'))
    .returning({ id: games.id, name: games.name });

  console.log(`[E2E Cleanup] Deleted ${deleted.length} test game(s):`, deleted.map(g => g.name));
  await client.end();
}

// Default export for Playwright globalSetup
export default async function globalSetup(): Promise<void> {
  await cleanupE2EGames();
}

// Run directly via: npx tsx scripts/cleanup-e2e.ts
if (require.main === module) {
  cleanupE2EGames().catch(err => {
    console.error('[E2E Cleanup] Error:', err);
    process.exit(1);
  });
}
