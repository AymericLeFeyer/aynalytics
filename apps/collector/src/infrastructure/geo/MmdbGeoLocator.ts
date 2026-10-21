import { readFile } from 'node:fs/promises';
import type { GeoLocation, GeoLocator } from '@aynalytics/core';
import type { CityResponse } from 'maxmind';
import { Reader } from 'maxmind';

type Names = { fr?: string; en?: string } | undefined;
const pickName = (names: Names): string | null => names?.fr ?? names?.en ?? null;

/**
 * Geolocalisation IP a partir d'une base mmdb (DB-IP Lite, format GeoIP2).
 * Sans base chargee, `locate` renvoie null : la collecte continue sans localisation.
 */
export class MmdbGeoLocator implements GeoLocator {
  private reader: Reader<CityResponse> | null = null;

  /** Charge (ou recharge a chaud) la base. La base precedente reste active en cas d'echec. */
  async load(path: string): Promise<void> {
    this.reader = new Reader<CityResponse>(await readFile(path));
  }

  get loaded(): boolean {
    return this.reader !== null;
  }

  locate(ip: string): GeoLocation | null {
    if (!this.reader || !ip) return null;
    let result: CityResponse | null;
    try {
      result = this.reader.get(ip.replace(/^::ffff:/, ''));
    } catch {
      return null;
    }
    if (!result?.country) return null;
    return {
      country: result.country.iso_code ?? null,
      region: pickName(result.subdivisions?.[0]?.names),
      city: pickName(result.city?.names),
      latitude: result.location?.latitude ?? null,
      longitude: result.location?.longitude ?? null,
    };
  }
}
