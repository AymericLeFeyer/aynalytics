import type { Site } from '../../domain/sites/entities/Site';
import type { SitePatch, SiteRepository } from '../../domain/sites/repositories/SiteRepository';
import type { Db } from './database';

interface SiteRow {
  id: string;
  name: string;
  public_key: string;
  secret_hash: string;
  allowed_origins: string;
  active: number;
  created_at: number;
}

const toSite = (row: SiteRow): Site => ({
  id: row.id,
  name: row.name,
  publicKey: row.public_key,
  secretHash: row.secret_hash,
  allowedOrigins: JSON.parse(row.allowed_origins) as string[],
  active: row.active === 1,
  createdAt: row.created_at,
});

export class SqliteSiteRepository implements SiteRepository {
  constructor(private readonly db: Db) {}

  list(): Site[] {
    const rows = this.db.prepare('SELECT * FROM sites ORDER BY created_at ASC').all() as SiteRow[];
    return rows.map(toSite);
  }

  findById(id: string): Site | undefined {
    const row = this.db.prepare('SELECT * FROM sites WHERE id = ?').get(id) as SiteRow | undefined;
    return row && toSite(row);
  }

  findByPublicKey(publicKey: string): Site | undefined {
    const row = this.db.prepare('SELECT * FROM sites WHERE public_key = ?').get(publicKey) as
      SiteRow | undefined;
    return row && toSite(row);
  }

  insert(site: Site): void {
    this.db
      .prepare(
        `INSERT INTO sites (id, name, public_key, secret_hash, allowed_origins, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        site.id,
        site.name,
        site.publicKey,
        site.secretHash,
        JSON.stringify(site.allowedOrigins),
        site.active ? 1 : 0,
        site.createdAt,
      );
  }

  update(id: string, patch: SitePatch): Site | undefined {
    const current = this.findById(id);
    if (!current) return undefined;
    const next: Site = { ...current, ...patch };
    this.db
      .prepare('UPDATE sites SET name = ?, secret_hash = ?, allowed_origins = ?, active = ? WHERE id = ?')
      .run(next.name, next.secretHash, JSON.stringify(next.allowedOrigins), next.active ? 1 : 0, id);
    return next;
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM sites WHERE id = ?').run(id).changes > 0;
  }
}
