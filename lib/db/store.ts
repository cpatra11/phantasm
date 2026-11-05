import type { BrandKit } from '../brand/types';
import type { Aspect, SceneDoc } from '../scenedoc';

export type BrandRecord = BrandKit & { id: string; userId: string; createdAt: string };

export type ArtifactRecord = {
  id: string;
  userId: string;
  brandId: string | null;
  title: string;
  prompt: string;
  currentVersion: number;
  createdAt: string;
};

export type VersionRecord = {
  artifactId: string;
  version: number;
  doc: SceneDoc;
  message: string;
  createdAt: string;
};

export type RenderRecord = {
  id: string;
  userId: string;
  artifactId: string;
  version: number;
  aspect: Aspect;
  kind: 'video' | 'still';
  status: 'rendering' | 'done' | 'failed';
  remoteId: string | null;
  bucketName: string | null;
  functionName: string | null;
  region: string | null;
  url: string | null;
  error: string | null;
  createdAt: string;
};

export type CreditRecord = { userId: string; total: number; used: number };

export interface Store {
  saveBrand(b: BrandRecord): Promise<void>;
  getBrand(id: string): Promise<BrandRecord | null>;
  /** The user's most recently saved brand kit, or null. */
  latestBrand(userId: string): Promise<BrandRecord | null>;

  createArtifact(a: ArtifactRecord, first: VersionRecord): Promise<void>;
  getArtifact(id: string): Promise<ArtifactRecord | null>;
  listArtifacts(userId: string): Promise<ArtifactRecord[]>;
  getVersion(artifactId: string, version: number): Promise<VersionRecord | null>;
  listVersions(artifactId: string): Promise<VersionRecord[]>;
  /** Appends a version and makes it current. */
  addVersion(v: VersionRecord): Promise<void>;

  saveRender(r: RenderRecord): Promise<void>;
  updateRender(id: string, patch: Partial<RenderRecord>): Promise<void>;
  getRender(id: string): Promise<RenderRecord | null>;

  /** Returns the account's credit record, creating it with `allowance` on first use. */
  ensureCredits(userId: string, allowance: number): Promise<CreditRecord>;
  /** Spends one credit. Returns false when none are left. */
  spendCredit(userId: string, allowance: number): Promise<boolean>;
  /** Gives back one credit, for a run that failed. */
  refundCredit(userId: string): Promise<void>;
}

/** In-process store. Used when DATABASE_URL is not set. Data is lost on restart. */
export class MemoryStore implements Store {
  private brands = new Map<string, BrandRecord>();
  private artifacts = new Map<string, ArtifactRecord>();
  private versions = new Map<string, VersionRecord>();
  private renders = new Map<string, RenderRecord>();
  private credits = new Map<string, CreditRecord>();

  private vkey(artifactId: string, version: number) {
    return `${artifactId}:${version}`;
  }

  async saveBrand(b: BrandRecord) {
    this.brands.set(b.id, b);
  }
  async getBrand(id: string) {
    return this.brands.get(id) ?? null;
  }
  async latestBrand(userId: string) {
    return (
      [...this.brands.values()]
        .filter((b) => b.userId === userId)
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0] ?? null
    );
  }

  async createArtifact(a: ArtifactRecord, first: VersionRecord) {
    this.artifacts.set(a.id, a);
    this.versions.set(this.vkey(first.artifactId, first.version), first);
  }
  async getArtifact(id: string) {
    return this.artifacts.get(id) ?? null;
  }
  async listArtifacts(userId: string) {
    return [...this.artifacts.values()]
      .filter((a) => a.userId === userId)
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  }
  async getVersion(artifactId: string, version: number) {
    return this.versions.get(this.vkey(artifactId, version)) ?? null;
  }
  async listVersions(artifactId: string) {
    return [...this.versions.values()].filter((v) => v.artifactId === artifactId).sort((a, b) => a.version - b.version);
  }
  async addVersion(v: VersionRecord) {
    this.versions.set(this.vkey(v.artifactId, v.version), v);
    const a = this.artifacts.get(v.artifactId);
    if (a) this.artifacts.set(a.id, { ...a, currentVersion: v.version });
  }

  async saveRender(r: RenderRecord) {
    this.renders.set(r.id, r);
  }
  async updateRender(id: string, patch: Partial<RenderRecord>) {
    const cur = this.renders.get(id);
    if (cur) this.renders.set(id, { ...cur, ...patch });
  }
  async getRender(id: string) {
    return this.renders.get(id) ?? null;
  }

  async ensureCredits(userId: string, allowance: number) {
    const cur = this.credits.get(userId) ?? { userId, total: allowance, used: 0 };
    this.credits.set(userId, cur);
    return cur;
  }
  async spendCredit(userId: string, allowance: number) {
    const cur = await this.ensureCredits(userId, allowance);
    if (cur.used >= cur.total) return false;
    this.credits.set(userId, { ...cur, used: cur.used + 1 });
    return true;
  }
  async refundCredit(userId: string) {
    const cur = this.credits.get(userId);
    if (cur && cur.used > 0) this.credits.set(userId, { ...cur, used: cur.used - 1 });
  }
}
