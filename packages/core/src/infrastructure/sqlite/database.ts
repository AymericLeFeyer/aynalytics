import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';

export type Db = Database.Database;

export const DB_FILENAME = 'aynalytics.db';

/**
 * Migrations sequentielles (index = user_version). Ne jamais modifier une migration deja deployee :
 * en ajouter une nouvelle a la fin.
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    public_key TEXT NOT NULL UNIQUE,
    secret_hash TEXT NOT NULL,
    allowed_origins TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    site_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('screen', 'event')),
    name TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{}',
    ts INTEGER NOT NULL,
    received_at INTEGER NOT NULL,
    visitor_hash TEXT NOT NULL,
    session_id TEXT,
    anonymous_id TEXT,
    user_id TEXT,
    url TEXT,
    path TEXT,
    referrer TEXT,
    referrer_host TEXT,
    source TEXT NOT NULL,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,
    browser TEXT,
    os TEXT,
    device TEXT,
    language TEXT,
    screen_width INTEGER
  );
  CREATE INDEX idx_events_site_ts ON events (site_id, ts);
  CREATE INDEX idx_events_site_name_ts ON events (site_id, name, ts);
  CREATE INDEX idx_events_ts ON events (ts);
  CREATE INDEX idx_events_received_at ON events (received_at);

  CREATE TABLE salts (
    day TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // v2 : titre de page, geolocalisation IP, contexte navigateur.
  `
  ALTER TABLE events ADD COLUMN title TEXT;
  ALTER TABLE events ADD COLUMN country TEXT;
  ALTER TABLE events ADD COLUMN region TEXT;
  ALTER TABLE events ADD COLUMN city TEXT;
  ALTER TABLE events ADD COLUMN timezone TEXT;
  ALTER TABLE events ADD COLUMN screen_height INTEGER;
  ALTER TABLE events ADD COLUMN viewport_width INTEGER;
  ALTER TABLE events ADD COLUMN viewport_height INTEGER;
  ALTER TABLE events ADD COLUMN pixel_ratio REAL;
  ALTER TABLE events ADD COLUMN color_scheme TEXT;
  ALTER TABLE events ADD COLUMN connection TEXT;
  ALTER TABLE events ADD COLUMN context TEXT NOT NULL DEFAULT '{}';
  `,
];

/**
 * Ouvre la base partagee entre le collector et le dashboard (deux process, meme fichier).
 * WAL + busy_timeout permettent les acces concurrents ; les migrations sont serialisees
 * par une transaction IMMEDIATE (verrou d'ecriture), donc les deux conteneurs peuvent demarrer ensemble.
 */
export function openDatabase(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  let db: Db;
  try {
    db = new Database(file);
  } catch (err) {
    if ((err as { code?: string }).code !== 'SQLITE_CANTOPEN') throw err;
    // Cas typique en Docker : bind mount cree par root, process non-root (uid 1000).
    const uid = process.getuid?.() ?? '?';
    throw new Error(
      `Impossible d'ouvrir ${file} : le dossier ${dirname(file)} n'est pas accessible en ecriture ` +
        `pour l'uid ${uid}. Sur l'hote : sudo chown -R ${uid}:${uid} <dossier monte sur /data>.`,
      { cause: err },
    );
  }
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  migrate(db);
  return db;
}

export const databasePath = (dataDir: string): string => join(dataDir, DB_FILENAME);

function migrate(db: Db): void {
  const run = db.transaction(() => {
    const current = db.pragma('user_version', { simple: true }) as number;
    for (let version = current; version < MIGRATIONS.length; version++) {
      db.exec(MIGRATIONS[version] as string);
    }
    if (current < MIGRATIONS.length) db.pragma(`user_version = ${MIGRATIONS.length}`);
  });
  run.immediate();
}
