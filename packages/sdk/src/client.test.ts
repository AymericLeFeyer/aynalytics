// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AynalyticsClient } from './client';
import type { CollectPayload } from './types';

const OPTIONS = { siteKey: 'ay_pk_test', endpoint: 'https://analytics.test/' };

let fetchMock: ReturnType<typeof vi.fn>;
let beaconMock: ReturnType<typeof vi.fn>;
let client: AynalyticsClient | undefined;

const fetchedPayloads = (): CollectPayload[] =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string) as CollectPayload);

const beaconPayloads = async (): Promise<CollectPayload[]> =>
  Promise.all(
    beaconMock.mock.calls.map(async ([, blob]) => JSON.parse(await (blob as Blob).text()) as CollectPayload),
  );

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  history.replaceState({}, '', '/');
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
  beaconMock = vi.fn(() => true);
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(navigator, 'sendBeacon', { value: beaconMock, configurable: true });
});

afterEach(() => {
  client?.destroy();
  client = undefined;
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('AynalyticsClient', () => {
  it('envoie les evenements en lot avec le contexte de page', () => {
    history.replaceState({}, '', '/produit?utm_source=youtube&utm_campaign=promo');
    client = new AynalyticsClient({ ...OPTIONS, autoScreens: false });
    client.track('purchase_click', { product: 'Clavier', price: 89.9 });
    client.screen('Checkout');
    client.flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://analytics.test/v1/collect');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe('omit');
    expect((init.headers as Record<string, string>)['content-type']).toBe('text/plain');

    const [payload] = fetchedPayloads();
    expect(payload?.siteKey).toBe('ay_pk_test');
    expect(payload?.events).toHaveLength(2);
    expect(payload?.events[0]).toMatchObject({
      type: 'event',
      name: 'purchase_click',
      properties: { product: 'Clavier', price: 89.9 },
      utm: { source: 'youtube', campaign: 'promo' },
    });
    expect(payload?.events[0]?.sessionId).toBe(payload?.events[1]?.sessionId);
    expect(payload?.events[0]?.anonymousId).toBeUndefined();
  });

  it('conserve les UTM de la session sur les pages suivantes', () => {
    history.replaceState({}, '', '/?utm_source=newsletter');
    client = new AynalyticsClient({ ...OPTIONS, autoScreens: false });
    client.track('landing');
    history.replaceState({}, '', '/autre-page');
    client.track('purchase_click');
    client.flush();
    const events = fetchedPayloads().flatMap((p) => p.events);
    expect(events[1]?.utm).toEqual({ source: 'newsletter' });
  });

  it('trace les clics data-ay-event via sendBeacon (survit a la navigation)', async () => {
    document.body.innerHTML = `
      <a id="buy" href="https://boutique.exemple/p/1" data-ay-event="purchase_click"
         data-ay-prop-product="Clavier" data-ay-prop-price="89.9" data-ay-prop-ref="00123" data-ay-prop-promo="true">
        <span id="inner">Acheter</span>
      </a>`;
    client = new AynalyticsClient({ ...OPTIONS, autoScreens: false });
    document.getElementById('inner')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(beaconMock).toHaveBeenCalledOnce();
    const [payload] = await beaconPayloads();
    expect(payload?.events[0]).toMatchObject({
      type: 'event',
      name: 'purchase_click',
      properties: {
        product: 'Clavier',
        price: 89.9,
        ref: '00123',
        promo: true,
        href: 'https://boutique.exemple/p/1',
      },
    });
  });

  it('trace un screen a chaque changement de route', () => {
    client = new AynalyticsClient(OPTIONS);
    history.pushState({}, '', '/blog');
    history.pushState({}, '', '/blog');
    history.replaceState({}, '', '/blog?tri=date');
    history.pushState({}, '', '/contact');
    client.flush();
    const screens = fetchedPayloads()
      .flatMap((p) => p.events)
      .map((e) => `${e.type}:${e.name}`);
    expect(screens).toEqual(['screen:/', 'screen:/blog', 'screen:/contact']);
  });

  it('persistence local : identifiant anonyme stable, identify/reset', () => {
    client = new AynalyticsClient({ ...OPTIONS, autoScreens: false, persistence: 'local' });
    client.identify('user-42');
    client.track('a');
    client.reset();
    client.track('b');
    client.flush();
    const [a, b] = fetchedPayloads().flatMap((p) => p.events);
    expect(a?.anonymousId).toBeTruthy();
    expect(a?.userId).toBe('user-42');
    expect(b?.userId).toBeUndefined();
    expect(b?.anonymousId).not.toBe(a?.anonymousId);
    expect(b?.sessionId).not.toBe(a?.sessionId);
  });

  it('respecte Do Not Track si demande', () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    client = new AynalyticsClient({ ...OPTIONS, respectDoNotTrack: true });
    client.track('x');
    client.flush(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(beaconMock).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true });
  });

  it('restaure history a la destruction', () => {
    const original = history.pushState;
    client = new AynalyticsClient(OPTIONS);
    expect(history.pushState).not.toBe(original);
    client.destroy();
    client = undefined;
    expect(history.pushState).toBe(original);
  });
});
