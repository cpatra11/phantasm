import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../db/schema';

/**
 * The Better Auth server. Email + password sign-in; users, sessions, and credentials live
 * in Postgres (Neon) next to the app tables. Without DATABASE_URL a per-process memory
 * store keeps local runs working (accounts vanish on restart).
 */
function createAuth() {
  const url = process.env.DATABASE_URL;
  const database = url
    ? drizzleAdapter(drizzle(neon(url), { schema }), { provider: 'pg', schema })
    : memoryAdapter({
        user: [],
        session: [],
        account: [],
        verification: [],
      });
  return betterAuth({
    database,
    emailAndPassword: { enabled: true },
  });
}

export const auth = createAuth();
