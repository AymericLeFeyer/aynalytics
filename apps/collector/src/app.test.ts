import type { Db } from '@aynalytics/core';
import { generateSecretKey, hashSecret, openDatabase, SqliteSiteRepository } from '@aynalytics/core';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildCollector } from './app';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36';
const SECRET = generateSecretKey();

let db: Db;
let app: FastifyInstance;

beforeEach(async () => {
  db = openDatabase(':memory:');
  new SqliteSiteRepository(db).insert({
    id: 'site-1',
    name: 'Boutique',
    publicKey: 'ay_pk_test',
    secretHash: hashSecret(SECRET),
    allowedOrigins: ['https://boutique.fr', 'https://*.boutique.fr'],
    active: true,
    createdAt: Date.now(),
  });
  app = await buildCollector({
    db,
    rateLimitPerMinute: 5,
    trustProxy: false,
    logger: false,
    registryTtlMs: 0,
  });
});

afterEach(async () => {
  await app.close();
  db.close();
});

const payload = (siteKey = 'ay_pk_test') => ({
  siteKey,
  events: [
    {
      type: 'event',
      name: 'purchase_click',
      properties: { product: 'Clavier', price: 89.9 },
      url: 'https://boutique.fr/produit?utm_source=youtube',
    },
  ],
});

const collect = (headers: Record<string, string>, body: unknown = payload()) =>
  app.inject({
    method: 'POST',
    url: '/v1/collect',
    headers: { 'user-agent': UA, 'content-type': 'text/plain', ...headers },
    payload: typeof body === 'string' ? body : JSON.stringify(body),
  });

const countEvents = () => (db.prepare('SELECT COUNT(*) AS n FROM events').get() as { n: number }).n;

describe('POST /v1/collect', () => {
  it('accepte un envoi navigateur depuis une origine autorisee (text/plain)', async () => {
    const res = await collect({ origin: 'https://shop.boutique.fr' });
    expect(res.statusCode).toBe(202);
    expect(res.headers['access-control-allow-origin']).toBe('https://shop.boutique.fr');
    expect(countEvents()).toBe(1);
    const row = db.prepare('SELECT source, properties FROM events').get() as {
      source: string;
      properties: string;
    };
    expect(row.source).toBe('youtube');
    expect(JSON.parse(row.properties)).toEqual({ product: 'Clavier', price: 89.9 });
  });

  it('refuse une origine non autorisee ou absente', async () => {
    const evil = await collect({ origin: 'https://evil.io' });
    expect(evil.statusCode).toBe(403);
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    expect((await collect({})).statusCode).toBe(403);
    expect(countEvents()).toBe(0);
  });

  it('refuse une cle de site inconnue', async () => {
    const res = await collect({ origin: 'https://boutique.fr' }, payload('ay_pk_inconnue'));
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'unknown_site' });
  });

  it('accepte un envoi serveur avec la cle secrete, refuse une mauvaise cle', async () => {
    const ok = await collect({ authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' });
    expect(ok.statusCode).toBe(202);
    const ko = await collect({ authorization: 'Bearer ay_sk_faux', origin: 'https://boutique.fr' });
    expect(ko.statusCode).toBe(403);
    expect(ko.json()).toEqual({ error: 'invalid_secret' });
  });

  it('valide le payload et le JSON', async () => {
    expect((await collect({ origin: 'https://boutique.fr' }, '{pas du json')).statusCode).toBe(400);
    const proto = await collect(
      { origin: 'https://boutique.fr' },
      '{"__proto__":{"x":1},"siteKey":"ay_pk_test"}',
    );
    expect(proto.statusCode).toBe(400);
    const invalid = await collect({ origin: 'https://boutique.fr' }, { siteKey: 'ay_pk_test', events: [] });
    expect(invalid.statusCode).toBe(400);
  });

  it('ignore les robots sans erreur', async () => {
    const res = await collect({ origin: 'https://boutique.fr', 'user-agent': 'Googlebot/2.1' });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: 0 });
  });

  it('applique le rate limit par IP', async () => {
    for (let i = 0; i < 5; i++) await collect({ origin: 'https://boutique.fr' });
    const res = await collect({ origin: 'https://boutique.fr' });
    expect(res.statusCode).toBe(429);
  });

  it('prend en compte la desactivation d un site', async () => {
    db.prepare('UPDATE sites SET active = 0').run();
    expect((await collect({ origin: 'https://boutique.fr' })).statusCode).toBe(403);
  });
});

describe('OPTIONS /v1/collect', () => {
  it('ne repond au preflight que pour une origine connue', async () => {
    const ok = await app.inject({
      method: 'OPTIONS',
      url: '/v1/collect',
      headers: { origin: 'https://boutique.fr' },
    });
    expect(ok.statusCode).toBe(204);
    expect(ok.headers['access-control-allow-origin']).toBe('https://boutique.fr');
    const ko = await app.inject({
      method: 'OPTIONS',
      url: '/v1/collect',
      headers: { origin: 'https://evil.io' },
    });
    expect(ko.statusCode).toBe(403);
  });
});
