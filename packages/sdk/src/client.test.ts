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

  it('trace aussi le clic molette (ouverture dans un nouvel onglet), pas le clic droit', async () => {
    document.body.innerHTML = `<a id="buy" href="https://boutique.exemple/p/1" target="_blank" data-ay-event="purchase_click">Acheter</a>`;
    client = new AynalyticsClient({ ...OPTIONS, autoScreens: false });
    const link = document.getElementById('buy');
    link?.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 2 }));
    expect(beaconMock).not.toHaveBeenCalled();
    link?.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));

    expect(beaconMock).toHaveBeenCalledOnce();
    const [payload] = await beaconPayloads();
    expect(payload?.events[0]).toMatchObject({ name: 'purchase_click' });
  });

  it('trace un screen par route, apres mise a jour du titre, et ignore les routes quittees aussitot', () => {
    vi.useFakeTimers();
    try {
      document.title = 'Accueil';
      client = new AynalyticsClient(OPTIONS);
      vi.advanceTimersByTime(300);
      history.pushState({}, '', '/redirection');
      history.pushState({}, '', '/blog');
      document.title = 'Blog';
      history.pushState({}, '', '/blog');
      history.replaceState({}, '', '/blog?tri=date');
      vi.advanceTimersByTime(300);
      history.pushState({}, '', '/contact');
      document.title = 'Contact';
      // Fermeture de page avant le delai : le screen en attente part quand meme.
      client.flush();
      const screens = fetchedPayloads()
        .flatMap((p) => p.events)
        .map((e) => `${e.name}|${e.title}`);
      expect(screens).toEqual(['/|Accueil', '/blog|Blog', '/contact|Contact']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('joint le contexte navigateur a chaque evenement', () => {
    client = new AynalyticsClient({ ...OPTIONS, autoScreens: false });
    client.track('x');
    client.flush();
    const [event] = fetchedPayloads().flatMap((p) => p.events);
    expect(event?.context?.timezone).toBeTruthy();
    expect(event?.context).toMatchObject({
      viewportWidth: expect.any(Number),
      viewportHeight: expect.any(Number),
      colorScheme: expect.stringMatching(/light|dark/),
    });
  });

  it('trace les liens sortants avec leur section, ignore les liens internes', async () => {
    document.body.innerHTML = `
      <footer><a id="yt" target="_blank" href="https://www.youtube.com/@ay_labs" data-ay-prop-network="youtube"> YouTube </a></footer>
      <a id="mail" target="_blank" href="mailto:contact@aylabs.fr?subject=Collab">Mail</a>
      <a id="internal" target="_blank" href="/videos">Vidéos</a>`;
    client = new AynalyticsClient({ ...OPTIONS, autoScreens: false });
    for (const id of ['yt', 'mail', 'internal']) {
      document.getElementById(id)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    const events = (await beaconPayloads()).flatMap((p) => p.events);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      name: 'outbound_click',
      properties: { host: 'youtube.com', text: 'YouTube', section: 'footer', network: 'youtube' },
    });
    expect(events[1]?.properties).toMatchObject({ url: 'mailto:contact@aylabs.fr', host: 'mailto' });
  });

  it('classifyLink renomme, enrichit ou ignore les clics de liens', async () => {
    document.body.innerHTML = `
      <a id="shop" target="_blank" href="https://www.amazon.fr/dp/X">Acheter</a>
      <a id="internal" target="_blank" href="/domadoo">Domadoo</a>
      <a id="ignored" target="_blank" href="https://exemple.org">Ignoré</a>`;
    client = new AynalyticsClient({
      ...OPTIONS,
      autoScreens: false,
      classifyLink: ({ url }) => {
        if (url.hostname.endsWith('amazon.fr'))
          return { name: 'merchant_click', properties: { merchant: 'Amazon' } };
        if (url.pathname === '/domadoo')
          return { name: 'merchant_click', properties: { merchant: 'Domadoo' } };
        if (url.hostname === 'exemple.org') return false;
        return null;
      },
    });
    for (const id of ['internal', 'shop', 'ignored']) {
      document.getElementById(id)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    const events = (await beaconPayloads()).flatMap((p) => p.events);
    expect(events.map((e) => [e.name, e.properties?.merchant])).toEqual([
      ['merchant_click', 'Domadoo'],
      ['merchant_click', 'Amazon'],
    ]);
    expect(events[1]?.properties?.host).toBe('amazon.fr');
  });

  it("renouvelle l'identifiant anonyme apres 13 mois", () => {
    localStorage.setItem(
      'aynalytics:anonymousId',
      JSON.stringify({ id: 'ancien', createdAt: Date.now() - 400 * 86_400_000 }),
    );
    client = new AynalyticsClient({ ...OPTIONS, autoScreens: false, persistence: 'local' });
    client.track('x');
    client.flush();
    const [event] = fetchedPayloads().flatMap((p) => p.events);
    expect(event?.anonymousId).toBeTruthy();
    expect(event?.anonymousId).not.toBe('ancien');
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
