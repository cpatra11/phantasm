import { DrizzleStore } from './drizzle-store';
import { MemoryStore, type Store } from './store';

const g = globalThis as unknown as { __basixStore?: Store };

/** One store per process. Postgres when DATABASE_URL is set, otherwise in-memory. */
export function getStore(): Store {
  if (!g.__basixStore) {
    g.__basixStore = process.env.DATABASE_URL ? new DrizzleStore(process.env.DATABASE_URL) : new MemoryStore();
  }
  return g.__basixStore;
}
