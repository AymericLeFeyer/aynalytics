import { describe, expect, it } from 'vitest';
import type { TrackedEvent } from '../../domain/events/entities/TrackedEvent';
import { emptyUtm } from '../../domain/events/services/enrichment';
import { openDatabase } from './database';
import { SqliteAnalyticsRepository } from './SqliteAnalyticsRepository';
import { SqliteEventRepository } from './SqliteEventRepository';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1);

function event(partial: Partial<TrackedEvent>): TrackedEvent {
  return {
    siteId: 's1',
    type: 'event',
    name: 'purchase_click',
    properties: {},
    ts: T0,
    receivedAt: T0,
    visitorHash: 'v1',
    sessionId: 'sess1',
    anonymousId: null,
    userId: null,
    url: null,
    path: '/',
    referrer: null,
    referrerHost: null,
    source: 'direct',
    utm: emptyUtm(),
    browser: 'Chrome',
    os: 'Windows',
    device: 'desktop',
    language: 'fr-FR',
    screenWidth: 1920,
    title: null,
    country: 'FR',
    region: null,
    city: null,
    timezone: 'Europe/Paris',
    screenHeight: 1080,
    viewportWidth: null,
    viewportHeight: null,
    pixelRatio: null,
    colorScheme: null,
    connection: null,
    context: {},
    ...partial,
  };
}

function setup() {
  const db = openDatabase(':memory:');
  const events = new SqliteEventRepository(db);
  events.insertMany([
    event({ properties: { product: 'Clavier', price: 90 }, source: 'youtube' }),
    event({
      properties: { product: 'Souris', price: 30 },
      visitorHash: 'v2',
      sessionId: 'sess2',
      ts: T0 + DAY,
    }),
    event({ properties: { product: 'Clavier', price: 90, promo: true }, ts: T0 + DAY }),
    event({ type: 'screen', name: '/home', ts: T0 + 2 * DAY }),
    event({ siteId: 's2', ts: T0 }),
  ]);
  return new SqliteAnalyticsRepository(db);
}

const filter = { siteId: 's1', from: T0, to: T0 + 3 * DAY };

describe('SqliteAnalyticsRepository', () => {
  it('calcule la vue d ensemble', () => {
    expect(setup().overview(filter)).toEqual({ total: 4, screens: 1, events: 3, visitors: 2, sessions: 2 });
  });

  it('repartit la vue d ensemble par site', () => {
    const { siteId: _ignored, ...allSites } = filter;
    expect(setup().overviewBySite(allSites)).toEqual([
      { siteId: 's1', total: 4, screens: 1, events: 3, visitors: 2, sessions: 2 },
      { siteId: 's2', total: 1, screens: 0, events: 1, visitors: 1, sessions: 1 },
    ]);
  });

  it('produit une serie complete par site', () => {
    const { siteId: _ignored, ...allSites } = filter;
    const series = setup().timeseriesBySite({ ...allSites, type: 'event' }, 'day', 0);
    expect(series.map((s) => [s.siteId, s.points.map((p) => p.count)])).toEqual([
      ['s1', [1, 2, 0]],
      ['s2', [1, 0, 0]],
    ]);
  });

  it('remplit les trous de la serie temporelle', () => {
    const points = setup().timeseries({ ...filter, type: 'event' }, 'day', 0);
    expect(points.map((p) => p.count)).toEqual([1, 2, 0]);
    expect(points[0]?.bucket).toBe(T0);
  });

  it('agrege par dimension whitelistee', () => {
    const rows = setup().top(filter, 'source', 10);
    expect(rows[0]).toEqual({ value: 'direct', count: 3, visitors: 2 });
  });

  it('explore les proprietes dynamiques', () => {
    const repo = setup();
    const scoped = { ...filter, name: 'purchase_click' };
    expect(repo.propertyKeys(scoped).map((k) => k.key)).toEqual(['price', 'product', 'promo']);
    const byProduct = repo.propertyBreakdown(scoped, 'product', 10);
    expect(byProduct.rows[0]).toMatchObject({ value: 'Clavier', count: 2 });
    expect(byProduct.numeric).toBeNull();
    const byPrice = repo.propertyBreakdown(scoped, 'price', 10);
    expect(byPrice.numeric).toMatchObject({ count: 3, sum: 210, min: 30, max: 90 });
    expect(repo.propertyBreakdown(scoped, 'promo', 10).rows[0]?.value).toBe('true');
  });

  it('liste et filtre les evenements bruts', () => {
    const repo = setup();
    const all = repo.listEvents(filter, { limit: 2 });
    expect(all).toHaveLength(2);
    const next = repo.listEvents(filter, { limit: 10, before: all[1]?.id });
    expect(next).toHaveLength(2);
    expect(repo.listEvents(filter, { limit: 10, propKey: 'product', propValue: 'Souris' })).toHaveLength(1);
    expect(repo.listEvents(filter, { limit: 10, propKey: 'promo' })[0]?.properties).toMatchObject({
      promo: true,
    });
  });
});

describe('donnees v2 (geo, contexte, visiteurs persistants)', () => {
  it('compte un visiteur par identifiant anonyme sur plusieurs jours', () => {
    const db = openDatabase(':memory:');
    new SqliteEventRepository(db).insertMany([
      // Meme navigateur (anonymousId) vu deux jours : hash journalier different, un seul visiteur.
      event({ anonymousId: 'a1', visitorHash: 'jour1', ts: T0 }),
      event({ anonymousId: 'a1', visitorHash: 'jour2', ts: T0 + DAY }),
      // Sans identifiant persistant : retombe sur le hash journalier.
      event({ visitorHash: 'h1', ts: T0 }),
    ]);
    expect(new SqliteAnalyticsRepository(db).overview(filter).visitors).toBe(2);
  });

  it('agrege par pays, resolution et fuseau, et restitue le contexte', () => {
    const db = openDatabase(':memory:');
    new SqliteEventRepository(db).insertMany([
      event({ country: 'FR', city: 'Lyon', context: { cpuCores: 8, languages: ['fr-FR', 'en'] } }),
      event({ country: 'BE', screenWidth: 390, screenHeight: 844 }),
      event({ country: 'FR', screenWidth: null, screenHeight: null }),
    ]);
    const repo = new SqliteAnalyticsRepository(db);
    expect(repo.top(filter, 'country', 10)).toEqual([
      { value: 'FR', count: 2, visitors: 1 },
      { value: 'BE', count: 1, visitors: 1 },
    ]);
    expect(repo.top(filter, 'screen', 10).map((r) => r.value)).toEqual(['(aucun)', '1920x1080', '390x844']);
    const [stored] = repo.listEvents({ ...filter, name: 'purchase_click' }, { limit: 10 }).reverse();
    expect(stored).toMatchObject({ city: 'Lyon', timezone: 'Europe/Paris', context: { cpuCores: 8 } });
  });
});

describe('timeseries', () => {
  it('range les evenements en cours de journee dans le bon bucket (fuseau compris)', () => {
    const db = openDatabase(':memory:');
    const HOUR = 3_600_000;
    new SqliteEventRepository(db).insertMany([
      event({ ts: T0 + 13 * HOUR + 1234 }),
      event({ ts: T0 + DAY + 23 * HOUR + 59_000 }), // 23h59 UTC = lendemain 01h59 a Paris (UTC+2)
    ]);
    const repo = new SqliteAnalyticsRepository(db);
    expect(repo.timeseries(filter, 'day', 0).map((p) => p.count)).toEqual([1, 1, 0]);
    const paris = repo.timeseries({ ...filter, from: T0 - 2 * HOUR }, 'day', 120);
    expect(paris.map((p) => p.count)).toEqual([1, 0, 1, 0]);
    expect(
      repo
        .timeseries(filter, 'hour', 0)
        .filter((p) => p.count)
        .map((p) => p.bucket),
    ).toEqual([T0 + 13 * HOUR, T0 + DAY + 23 * HOUR]);
  });
});
