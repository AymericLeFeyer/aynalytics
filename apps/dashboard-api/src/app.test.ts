import type { Db } from '@aynalytics/core';
import { openDatabase, verifySecret, SqliteSiteRepository } from '@aynalytics/core';
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

describe('statistiques', () => {
  it('valide les parametres de requete', async () => {
    expect((await api('GET', '/api/stats/overview?from=10&to=5')).statusCode).toBe(400);
    expect((await api('GET', '/api/stats/top?from=0&to=10&dimension=password')).statusCode).toBe(400);
    const ok = await api('GET', '/api/stats/overview?from=0&to=1000');
    expect(ok.statusCode).toBe(200);
    expect(ok.json().current.total).toBe(0);
  });
});
