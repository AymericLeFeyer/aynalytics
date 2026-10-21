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
