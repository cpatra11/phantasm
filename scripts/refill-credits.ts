import { eq, sql } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { credits } from '../lib/db/schema';

/** Resets a user's credit balance (total + used=0). Run: npx tsx --env-file=.env.local scripts/refill-credits.ts <userId> <total> */
async function main() {
  const userId = process.argv[2];
  const total = Number(process.argv[3] ?? 10);
  if (!userId) throw new Error('Usage: refill-credits <userId> [total]');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const db = drizzle(neon(url));
  await db
    .insert(credits)
    .values({ userId, total, used: 0 })
    .onConflictDoUpdate({ target: credits.userId, set: { total, used: sql`0` } });
  const rows = await db.select().from(credits).where(eq(credits.userId, userId));
  console.log('credits now:', rows[0]);
  process.exit(0);
}

void main();
