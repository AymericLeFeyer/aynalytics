import type { Db, TrackedEvent } from '@aynalytics/core';
import {
  emptyUtm,
  openDatabase,
  verifySecret,
  SqliteEventRepository,
  SqliteSiteRepository,
} from '@aynalytics/core';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDashboard } from './app';

const AUTH = `Basic ${Buffer.from('admin:mot-de-passe-solide').toString('base64')}`;
let db: Db;
let app: FastifyInstance;

beforeEach(async () => {
  db = openDatabase(':memory:');
  app = await buildDashboard({ db, auth: { user: 'admin', password: 'mot-de-passe-solide' }, logger: false });
});

afterEach(async () => {
  await app.close();
  db.close();
});

const api = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown, headers = {}) =>
  app.inject({
    method,
    url,
    payload: payload as object | undefined,
    headers: { authorization: AUTH, 'x-aynalytics-csrf': '1', ...headers },
  });

describe('securite du dashboard', () => {
  it('exige la basic auth sauf sur /api/health', async () => {
    expect((await app.inject({ url: '/api/health' })).statusCode).toBe(200);
    const res = await app.inject({ url: '/api/sites' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toContain('Basic');
    const wrong = `Basic ${Buffer.from('admin:faux').toString('base64')}`;
    expect((await app.inject({ url: '/api/sites', headers: { authorization: wrong } })).statusCode).toBe(401);
    expect((await api('GET', '/api/sites')).statusCode).toBe(200);
  });

  it('bloque les mutations sans header anti-CSRF ou cross-site', async () => {
    const body = { name: 'Site', allowedOrigins: [] };
    const noHeader = await app.inject({
      method: 'POST',
      url: '/api/sites',
      payload: body,
      headers: { authorization: AUTH },
    });
    expect(noHeader.statusCode).toBe(403);
    const crossSite = await api('POST', '/api/sites', body, { 'sec-fetch-site': 'cross-site' });
    expect(crossSite.statusCode).toBe(403);
  });

  it('pose les headers de durcissement', async () => {
    const res = await api('GET', '/api/sites');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-frame-options']).toBe('DENY');
  });
});

describe('gestion des sites', () => {
  it('cree un site, ne renvoie la cle secrete qu une fois, normalise les origines', async () => {
    const res = await api('POST', '/api/sites', {
      name: ' Boutique ',
      allowedOrigins: ['HTTPS://Boutique.fr/', 'https://*.boutique.fr', 'https://boutique.fr'],
    });
    expect(res.statusCode).toBe(201);
    const { site, secretKey } = res.json();
    expect(site.name).toBe('Boutique');
    expect(site.allowedOrigins).toEqual(['https://boutique.fr', 'https://*.boutique.fr']);
    expect(site.publicKey).toMatch(/^ay_pk_/);
    expect(site.secretHash).toBeUndefined();
    expect(secretKey).toMatch(/^ay_sk_/);

    const stored = new SqliteSiteRepository(db).findById(site.id)!;
    expect(verifySecret(secretKey, stored.secretHash)).toBe(true);
    expect(JSON.stringify((await api('GET', '/api/sites')).json())).not.toContain(stored.secretHash);
  });

  it('refuse une origine invalide', async () => {
    const res = await api('POST', '/api/sites', { name: 'X', allowedOrigins: ['https://x.fr/chemin'] });
    expect(res.statusCode).toBe(400);
  });

  it('desactive, regenere la cle et supprime', async () => {
    const { site, secretKey } = (await api('POST', '/api/sites', { name: 'X', allowedOrigins: [] })).json();
    expect((await api('PATCH', `/api/sites/${site.id}`, { active: false })).json().active).toBe(false);
    const rotated = (await api('POST', `/api/sites/${site.id}/rotate-secret`)).json();
    expect(rotated.secretKey).not.toBe(secretKey);
    expect((await api('DELETE', `/api/sites/${site.id}`)).statusCode).toBe(200);
    expect((await api('DELETE', `/api/sites/${site.id}`)).statusCode).toBe(404);
  });
});

const emptyEvent = (): TrackedEvent => ({
  siteId: 's',
  type: 'event',
  name: 'e',
  properties: {},
  ts: 0,
  receivedAt: 0,
  visitorHash: 'v',
  sessionId: null,
  anonymousId: null,
  userId: null,
  url: null,
  path: null,
  referrer: null,
  referrerHost: null,
  source: 'direct',
  utm: emptyUtm(),
  browser: null,
  os: null,
  device: null,
  language: null,
  screenWidth: null,
  title: null,
  country: null,
  region: null,
  city: null,
  timezone: null,
  screenHeight: null,
  viewportWidth: null,
  viewportHeight: null,
  pixelRatio: null,
  colorScheme: null,
  connection: null,
  context: {},
});

describe('statistiques', () => {
  it('valide les parametres de requete', async () => {
    expect((await api('GET', '/api/stats/overview?from=10&to=5')).statusCode).toBe(400);
    expect((await api('GET', '/api/stats/top?from=0&to=10&dimension=password')).statusCode).toBe(400);
    const ok = await api('GET', '/api/stats/overview?from=0&to=1000');
    expect(ok.statusCode).toBe(200);
    expect(ok.json().current.total).toBe(0);
  });

  it('regroupe sur des dimensions et des proprietes (cle encodee)', async () => {
    new SqliteEventRepository(db).insertMany(
      [
        { ts: 100, visitorHash: 'v1', properties: { merchant: 'amazon', 'a,b': 1 } },
        { ts: 200, visitorHash: 'v2', properties: { merchant: 'amazon', 'a,b': 1 } },
        { ts: 300, visitorHash: 'v2', properties: { merchant: 'fnac' } as TrackedEvent['properties'] },
      ].map((e) => ({ ...emptyEvent(), path: '/p', ...e })),
    );
    const fields = encodeURIComponent(`path,prop:merchant,prop:${encodeURIComponent('a,b')}`);
    const res = await api('GET', `/api/stats/groups?from=0&to=3600000&interval=hour&fields=${fields}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      expect.objectContaining({
        values: ['/p', 'amazon', '1'],
        count: 2,
        visitors: 2,
        firstTs: 100,
        lastTs: 200,
      }),
      expect.objectContaining({ values: ['/p', 'fnac', '(aucun)'], count: 1, visitors: 1 }),
    ]);
    const bad = (f: string) => api('GET', `/api/stats/groups?from=0&to=1000&fields=${f}`);
    expect((await bad('password')).statusCode).toBe(400);
    expect((await bad('path,path')).statusCode).toBe(400);
    expect((await bad('prop:%25E0')).statusCode).toBe(400);
    expect((await bad('a,b,c,d,e')).statusCode).toBe(400);
  });

  it('repartit les statistiques par site, sans tenir compte du site filtre', async () => {
    const events = new SqliteEventRepository(db);
    const base = { type: 'screen' as const, name: '/', properties: {}, receivedAt: 0, sessionId: null };
    events.insertMany(
      [
        { siteId: 'a', ts: 100, visitorHash: 'v1' },
        { siteId: 'a', ts: 200, visitorHash: 'v2' },
        { siteId: 'b', ts: 300, visitorHash: 'v3' },
        { siteId: 'b', ts: -500, visitorHash: 'v3' },
      ].map((e) => ({ ...emptyEvent(), ...base, ...e })),
    );

    const sites = await api('GET', '/api/stats/sites?from=0&to=1000&siteId=a');
    expect(sites.statusCode).toBe(200);
    expect(
      sites.json().current.map((s: { siteId: string; visitors: number }) => [s.siteId, s.visitors]),
    ).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
    expect(sites.json().previous).toEqual([expect.objectContaining({ siteId: 'b', screens: 1 })]);

    const series = await api('GET', '/api/stats/timeseries/sites?from=0&to=7200000&interval=hour');
    expect(series.statusCode).toBe(200);
    expect(
      series.json().map((s: { siteId: string; points: unknown[] }) => [s.siteId, s.points.length]),
    ).toEqual([
      ['a', 2],
      ['b', 2],
    ]);
  });
});
