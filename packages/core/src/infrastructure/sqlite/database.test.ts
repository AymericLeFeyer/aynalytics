import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { MIGRATIONS, openDatabase } from './database';

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('openDatabase', () => {
  it('migre une base v1 existante sans perdre les evenements', () => {
    dir = mkdtempSync(join(tmpdir(), 'aynalytics-migration-'));
    const file = join(dir, 'aynalytics.db');
    const v1 = new Database(file);
    v1.exec(MIGRATIONS[0] as string);
    v1.pragma('user_version = 1');
    v1.prepare(
      `INSERT INTO events (site_id, type, name, ts, received_at, visitor_hash, source)
       VALUES ('s1', 'screen', '/', 1, 1, 'h', 'direct')`,
    ).run();
    v1.close();

    const db = openDatabase(file);
    expect(db.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length);
    const row = db.prepare('SELECT name, country, context FROM events').get();
    expect(row).toEqual({ name: '/', country: null, context: '{}' });
    db.close();
  });

  it('est idempotent au redemarrage', () => {
    dir = mkdtempSync(join(tmpdir(), 'aynalytics-migration-'));
    const file = join(dir, 'aynalytics.db');
    openDatabase(file).close();
    expect(() => openDatabase(file).close()).not.toThrow();
  });
});
