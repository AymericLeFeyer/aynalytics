import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import { createGunzip } from 'node:zlib';

export type GeoEdition = 'city' | 'country';

const MAX_AGE_MS = 32 * 86_400_000;
const BASE_URL = 'https://download.db-ip.com/free';

const monthKey = (date: Date): string => date.toISOString().slice(0, 7);

/**
 * Base DB-IP Lite (CC BY 4.0, mise a jour mensuelle, sans compte) stockee dans le volume
 * de donnees. Retelechargee quand elle a plus de 32 jours. Le fichier est ecrit a cote puis
 * renomme : une base partielle n'est jamais lue.
 */
export class DbIpDownloader {
  constructor(
    private readonly dir: string,
    private readonly edition: GeoEdition,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get path(): string {
    return join(this.dir, `dbip-${this.edition}-lite.mmdb`);
  }

  /** Retourne le chemin de la base si elle est presente, et indique si elle vient d'etre (re)telechargee. */
  async ensureFresh(now = new Date()): Promise<{ path: string; updated: boolean } | null> {
    const age = await stat(this.path).then(
      (s) => now.getTime() - s.mtimeMs,
      () => Infinity,
    );
    if (age < MAX_AGE_MS) return { path: this.path, updated: false };

    await mkdir(this.dir, { recursive: true });
    const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    // La base du mois est publiee le 1er : on retombe sur celle du mois precedent si besoin.
    for (const month of [monthKey(now), monthKey(previousMonth)]) {
      if (await this.download(`${BASE_URL}/dbip-${this.edition}-lite-${month}.mmdb.gz`)) {
        return { path: this.path, updated: true };
      }
    }
    return Number.isFinite(age) ? { path: this.path, updated: false } : null;
  }

  private async download(url: string): Promise<boolean> {
    const res = await this.fetchImpl(url).catch(() => null);
    if (!res?.ok || !res.body) return false;
    const tmp = `${this.path}.download`;
    try {
      await pipeline(
        Readable.fromWeb(res.body as ReadableStream<Uint8Array>),
        createGunzip(),
        createWriteStream(tmp),
      );
      await rename(tmp, this.path);
      return true;
    } catch {
      await rm(tmp, { force: true });
      return false;
    }
  }
}
