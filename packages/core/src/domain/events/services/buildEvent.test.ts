import { describe, expect, it } from 'vitest';
import { buildTrackedEvent, clampTimestamp } from './buildEvent';
import { collectPayloadSchema } from './payloadSchema';

const NOW = Date.UTC(2026, 9, 21, 12);
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1';
const ctx = { siteId: 's1', ip: '1.2.3.4', userAgent: UA, serverSide: false, receivedAt: NOW, salt: 'salt' };

describe('buildTrackedEvent', () => {
  it('nettoie l URL, conserve les UTM et deduit la source', () => {
    const event = buildTrackedEvent(
      {
        type: 'event',
        name: 'purchase_click',
        properties: { product: 'Clavier', price: 89.9 },
        url: 'https://site.fr/produit?token=secret&utm_source=YouTube&utm_campaign=promo#achat',
        referrer: 'https://www.google.com/search?q=clavier',
      },
      ctx,
    );
    expect(event.url).toBe('https://site.fr/produit?utm_source=YouTube&utm_campaign=promo');
    expect(event.path).toBe('/produit');
    expect(event.referrer).toBe('https://www.google.com/search');
    expect(event.source).toBe('youtube');
    expect(event.utm.campaign).toBe('promo');
    expect(event).toMatchObject({ browser: 'Safari', os: 'iOS', device: 'mobile' });
    expect(event.visitorHash).toHaveLength(32);
    expect(JSON.stringify(event)).not.toContain('1.2.3.4');
  });

  it('les UTM de session priment et le referent interne vaut direct', () => {
    const event = buildTrackedEvent(
      {
        type: 'screen',
        name: '/checkout',
        url: 'https://site.fr/checkout',
        referrer: 'https://www.site.fr/',
      },
      ctx,
    );
    expect(event.source).toBe('direct');
    const withSessionUtm = buildTrackedEvent(
      { type: 'screen', name: '/checkout', url: 'https://site.fr/checkout', utm: { source: 'newsletter' } },
      ctx,
    );
    expect(withSessionUtm.source).toBe('newsletter');
  });

  it('marque la source `server` pour les envois backend', () => {
    const event = buildTrackedEvent(
      { type: 'event', name: 'order_paid', userId: 'u42' },
      { ...ctx, serverSide: true },
    );
    expect(event.source).toBe('server');
    expect(event.browser).toBeNull();
  });
});

describe('clampTimestamp', () => {
  it('rejette les horodatages implausibles', () => {
    expect(clampTimestamp(NOW - 1000, NOW, false)).toBe(NOW - 1000);
    expect(clampTimestamp(NOW - 2 * 86_400_000, NOW, false)).toBe(NOW);
    expect(clampTimestamp(NOW - 2 * 86_400_000, NOW, true)).toBe(NOW - 2 * 86_400_000);
    expect(clampTimestamp(NOW + 3_600_000, NOW, false)).toBe(NOW);
  });
});

describe('collectPayloadSchema', () => {
  it('accepte des proprietes libres', () => {
    const result = collectPayloadSchema.safeParse({
      siteKey: 'ay_pk_x',
      events: [
        { type: 'event', name: 'x', properties: { a: 1, b: 'b', c: [1, 2], d: { e: true }, f: null } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('borne les proprietes (profondeur, taille, nombre)', () => {
    const tooDeep = { a: { b: { c: { d: 1 } } } };
    const tooMany = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, i]));
    const tooBig = { a: 'x'.repeat(1000), b: 'x'.repeat(1000), c: 'x'.repeat(1000), d: 'x'.repeat(1000) };
    const huge = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, 'x'.repeat(900)]));
    for (const properties of [tooDeep, tooMany, huge]) {
      const result = collectPayloadSchema.safeParse({
        siteKey: 'k',
        events: [{ type: 'event', name: 'x', properties }],
      });
      expect(result.success).toBe(false);
    }
    expect(
      collectPayloadSchema.safeParse({
        siteKey: 'k',
        events: [{ type: 'event', name: 'x', properties: tooBig }],
      }).success,
    ).toBe(true);
  });

  it('refuse les noms vides, les types inconnus et les lots trop gros', () => {
    const base = { siteKey: 'k' };
    expect(collectPayloadSchema.safeParse({ ...base, events: [{ type: 'event', name: '  ' }] }).success).toBe(
      false,
    );
    expect(collectPayloadSchema.safeParse({ ...base, events: [{ type: 'click', name: 'x' }] }).success).toBe(
      false,
    );
    const many = Array.from({ length: 51 }, () => ({ type: 'event', name: 'x' }));
    expect(collectPayloadSchema.safeParse({ ...base, events: many }).success).toBe(false);
  });
});
