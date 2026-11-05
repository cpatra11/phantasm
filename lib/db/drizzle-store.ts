import { neon } from '@neondatabase/serverless';
import { and, desc, eq, sql } from 'drizzle-orm';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { artifacts, brands, credits, renders, versions } from './schema';
import type {
  ArtifactRecord,
  BrandRecord,
  CreditRecord,
  RenderRecord,
  Store,
  VersionRecord,
} from './store';
import type { SceneDoc } from '../scenedoc';

/** Postgres (Neon) implementation. Set DATABASE_URL to enable it. */
export class DrizzleStore implements Store {
  private db: NeonHttpDatabase;

  constructor(url: string) {
    this.db = drizzle(neon(url));
  }

  async saveBrand(b: BrandRecord) {
    await this.db.insert(brands).values({ id: b.id, userId: b.userId, sourceUrl: b.sourceUrl, data: b, createdAt: b.createdAt });
  }
  async getBrand(id: string) {
    const rows = await this.db.select().from(brands).where(eq(brands.id, id));
    return rows[0] ? (rows[0].data as BrandRecord) : null;
  }
  async latestBrand(userId: string) {
    const rows = await this.db
      .select()
      .from(brands)
      .where(eq(brands.userId, userId))
      .orderBy(desc(brands.createdAt))
      .limit(1);
    return rows[0] ? (rows[0].data as BrandRecord) : null;
  }

  async createArtifact(a: ArtifactRecord, first: VersionRecord) {
    await this.db.insert(artifacts).values(a);
    await this.db.insert(versions).values(this.versionRow(first));
  }
  async getArtifact(id: string) {
    const rows = await this.db.select().from(artifacts).where(eq(artifacts.id, id));
    return (rows[0] as ArtifactRecord | undefined) ?? null;
  }
  async listArtifacts(userId: string) {
    return (await this.db
      .select()
      .from(artifacts)
      .where(eq(artifacts.userId, userId))
      .orderBy(desc(artifacts.createdAt))) as ArtifactRecord[];
  }
  async getVersion(artifactId: string, version: number) {
    const rows = await this.db.select().from(versions).where(eq(versions.id, `${artifactId}:${version}`));
    const r = rows[0];
    return r ? { artifactId: r.artifactId, version: r.version, doc: r.doc as SceneDoc, message: r.message, createdAt: r.createdAt } : null;
  }
  async listVersions(artifactId: string) {
    const rows = await this.db.select().from(versions).where(eq(versions.artifactId, artifactId));
    return rows
      .map((r) => ({ artifactId: r.artifactId, version: r.version, doc: r.doc as SceneDoc, message: r.message, createdAt: r.createdAt }))
      .sort((a, b) => a.version - b.version);
  }
  async addVersion(v: VersionRecord) {
    await this.db.insert(versions).values(this.versionRow(v));
    await this.db.update(artifacts).set({ currentVersion: v.version }).where(eq(artifacts.id, v.artifactId));
  }

  async saveRender(r: RenderRecord) {
    await this.db.insert(renders).values(r);
  }
  async updateRender(id: string, patch: Partial<RenderRecord>) {
    await this.db.update(renders).set(patch).where(eq(renders.id, id));
  }
  async getRender(id: string) {
    const rows = await this.db.select().from(renders).where(eq(renders.id, id));
    return (rows[0] as RenderRecord | undefined) ?? null;
  }

  async ensureCredits(userId: string, allowance: number): Promise<CreditRecord> {
    await this.db.insert(credits).values({ userId, total: allowance, used: 0 }).onConflictDoNothing();
    const rows = await this.db.select().from(credits).where(eq(credits.userId, userId));
    return rows[0];
  }
  async spendCredit(userId: string, allowance: number) {
    await this.ensureCredits(userId, allowance);
    // Conditional update: only succeeds while used < total, so two parallel runs cannot overspend.
    const rows = await this.db
      .update(credits)
      .set({ used: sql`${credits.used} + 1` })
      .where(and(eq(credits.userId, userId), sql`${credits.used} < ${credits.total}`))
      .returning({ userId: credits.userId });
    return rows.length === 1;
  }
  async refundCredit(userId: string) {
    await this.db
      .update(credits)
      .set({ used: sql`greatest(${credits.used} - 1, 0)` })
      .where(eq(credits.userId, userId));
  }

  private versionRow(v: VersionRecord) {
    return { id: `${v.artifactId}:${v.version}`, artifactId: v.artifactId, version: v.version, doc: v.doc, message: v.message, createdAt: v.createdAt };
  }
}
