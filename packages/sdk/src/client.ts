import type {
  AynalyticsOptions,
  EventType,
  LinkClick,
  Properties,
  WireContext,
  WireEvent,
  WireUtm,
} from './types';

const SESSION_TTL_MS = 30 * 60_000;
/** Duree de vie max de l'identifiant anonyme persistant (13 mois, recommandation CNIL). */
const ANONYMOUS_ID_TTL_MS = 395 * 86_400_000;
/** Delai avant l'envoi d'un screen automatique : laisse le temps au routeur de mettre a jour le titre. */
const AUTO_SCREEN_DELAY_MS = 300;
const FLUSH_DELAY_MS = 1000;
const MAX_QUEUE = 20;
const MAX_BATCH = 50;
const STORAGE_PREFIX = 'aynalytics:';
const PROP_ATTR_PREFIX = 'data-ay-prop-';
const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const;
const LANDMARKS = 'header, nav, footer, aside, main';

interface SessionState {
  id: string;
  lastSeen: number;
  /** Referent externe au debut de la session : c'est lui qui donne la source des evenements suivants. */
  referrer?: string;
  utm?: WireUtm;
}

interface StoredAnonymousId {
  id: string;
  createdAt: number;
}

type NavigatorExtras = Navigator & {
  globalPrivacyControl?: boolean;
  deviceMemory?: number;
  connection?: { effectiveType?: string; saveData?: boolean };
  userAgentData?: { platform?: string; mobile?: boolean };
};

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from({ length: 4 }, () => Math.random().toString(16).slice(2, 10)).join('-');
}

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readJson<T>(storage: Storage | null, key: string): T | null {
  try {
    const raw = storage?.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage | null, key: string, value: unknown): void {
  try {
    if (value === undefined) storage?.removeItem(STORAGE_PREFIX + key);
    else storage?.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // stockage plein ou bloque : on continue en memoire
  }
}

function utmFromLocation(): WireUtm | undefined {
  const params = new URLSearchParams(window.location.search);
  const utm: WireUtm = {};
  for (const key of UTM_KEYS) {
    const value = params.get(`utm_${key}`);
    if (value) utm[key] = value;
  }
  return Object.keys(utm).length ? utm : undefined;
}

function externalReferrer(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    return new URL(document.referrer).host === window.location.host ? undefined : document.referrer;
  } catch {
    return undefined;
  }
}

function isDoNotTrack(): boolean {
  const nav = navigator as NavigatorExtras;
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

const matches = (query: string): boolean => {
  try {
    return window.matchMedia?.(query).matches ?? false;
  } catch {
    return false;
  }
};

/** Tout ce que le navigateur expose sans demander de permission. */
function collectContext(): WireContext {
  const nav = navigator as NavigatorExtras;
  const context: WireContext = {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    languages: nav.languages?.slice(0, 10),
    screenHeight: window.screen?.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pixelRatio: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    colorScheme: matches('(prefers-color-scheme: dark)') ? 'dark' : 'light',
    reducedMotion: matches('(prefers-reduced-motion: reduce)'),
    connection: nav.connection?.effectiveType,
    saveData: nav.connection?.saveData,
    deviceMemory: nav.deviceMemory,
    cpuCores: nav.hardwareConcurrency,
    touchPoints: nav.maxTouchPoints,
    platform: nav.userAgentData?.platform,
    mobile: nav.userAgentData?.mobile,
  };
  return Object.fromEntries(
    Object.entries(context).filter(([, v]) => v !== undefined && v !== ''),
  ) as WireContext;
}

/** Valeur d'attribut data-ay-prop-* : nombres et booleens convertis, le reste en texte. */
function coerceAttribute(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function attributeProperties(element: Element): Properties {
  const properties: Properties = {};
  for (const attr of Array.from(element.attributes)) {
    if (attr.name.startsWith(PROP_ATTR_PREFIX)) {
      properties[attr.name.slice(PROP_ATTR_PREFIX.length)] = coerceAttribute(attr.value);
    }
  }
  return properties;
}

function sectionOf(element: Element): string | undefined {
  const tagged = element.closest('[data-ay-section]')?.getAttribute('data-ay-section');
  const section = element.closest('section[id]')?.id;
  return tagged || section || element.closest(LANDMARKS)?.tagName.toLowerCase();
}

export class AynalyticsClient {
  private queue: WireEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pendingScreen: ReturnType<typeof setTimeout> | undefined;
  private session: SessionState | undefined;
  private anonymousId: string | undefined;
  private userId: string | undefined;
  private lastScreenPath: string | undefined;
  private readonly collectUrl: string;
  private readonly enabled: boolean;
  private readonly cleanups: (() => void)[] = [];

  constructor(private readonly options: AynalyticsOptions) {
    if (!options.siteKey || !options.endpoint) throw new Error('aynalytics: siteKey et endpoint sont requis');
    this.collectUrl = `${options.endpoint.replace(/\/+$/, '')}/v1/collect`;
    this.enabled = isBrowser() && !(options.respectDoNotTrack && isDoNotTrack());
    if (!this.enabled) return;

    if (this.persistence === 'local') this.anonymousId = this.loadAnonymousId();
    this.userId = readJson<string>(this.sessionStore, 'userId') ?? undefined;

    this.listen(window, 'pagehide', () => this.flush(true));
    this.listen(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush(true);
    });
    if (options.autoClicks !== false || options.outboundLinks !== false || options.classifyLink) {
      this.listen(document, 'click', this.onClick, true);
      // Clic molette (« ouvrir dans un nouvel onglet ») : pas d'evenement `click`, seulement `auxclick`.
      this.listen(document, 'auxclick', this.onAuxClick, true);
    }
    if (options.autoScreens !== false) this.watchRoutes();
  }

  /** Evenement metier : `track('purchase_click', { product: 'Clavier', price: 89.9 })`. */
  track(name: string, properties?: Properties): void {
    this.enqueue('event', name, properties);
  }

  /** Ecran / page vue. Sans nom, utilise le chemin courant. */
  screen(name?: string, properties?: Properties): void {
    this.enqueue('screen', name ?? (isBrowser() ? window.location.pathname : '/'), properties);
  }

  /** Associe les evenements suivants a un identifiant utilisateur (null pour l'oublier). */
  identify(userId: string | null): void {
    this.userId = userId ?? undefined;
    writeJson(this.sessionStore, 'userId', this.userId);
  }

  /** Oublie l'utilisateur, la session et l'identifiant anonyme (ex : deconnexion). */
  reset(): void {
    this.identify(null);
    this.session = undefined;
    writeJson(this.sessionStore, 'session', undefined);
    if (this.persistence === 'local') this.anonymousId = this.renewAnonymousId();
  }

  /** Envoie la file. `beacon` = envoi garanti meme si la page se ferme (clic sortant, fermeture d'onglet). */
  flush(beacon = false): void {
    this.firePendingScreen();
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    while (this.queue.length) {
      const events = this.queue.splice(0, MAX_BATCH);
      this.send(JSON.stringify({ siteKey: this.options.siteKey, events }), beacon);
    }
  }

  destroy(): void {
    this.flush(true);
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }

  private get persistence() {
    return this.options.persistence ?? 'session';
  }

  private get localStore(): Storage | null {
    return this.persistence === 'local' ? safeStorage('local') : null;
  }

  private get sessionStore(): Storage | null {
    return this.persistence === 'memory' ? null : safeStorage('session');
  }

  private loadAnonymousId(): string {
    const stored = readJson<StoredAnonymousId | string>(this.localStore, 'anonymousId');
    if (stored && typeof stored === 'object' && Date.now() - stored.createdAt < ANONYMOUS_ID_TTL_MS) {
      return stored.id;
    }
    return this.renewAnonymousId();
  }

  private renewAnonymousId(): string {
    const value: StoredAnonymousId = { id: uuid(), createdAt: Date.now() };
    writeJson(this.localStore, 'anonymousId', value);
    return value.id;
  }

  private currentSession(now: number): SessionState {
    const stored = this.session ?? readJson<SessionState>(this.sessionStore, 'session') ?? undefined;
    const utm = utmFromLocation();
    let session: SessionState;
    if (!stored || now - stored.lastSeen > SESSION_TTL_MS) {
      session = { id: uuid(), lastSeen: now, referrer: externalReferrer(), utm };
    } else {
      // Une nouvelle campagne en cours de session remplace l'ancienne attribution.
      session = { ...stored, lastSeen: now, ...(utm ? { utm, referrer: externalReferrer() } : {}) };
    }
    this.session = session;
    writeJson(this.sessionStore, 'session', session);
    return session;
  }

  private enqueue(type: EventType, name: string, properties?: Properties): void {
    if (!this.enabled) return;
    const now = Date.now();
    const session = this.currentSession(now);
    this.queue.push({
      type,
      name: String(name).slice(0, 100),
      properties,
      ts: now,
      url: window.location.href,
      title: document.title?.slice(0, 300) || undefined,
      referrer: session.referrer,
      utm: session.utm,
      sessionId: session.id,
      anonymousId: this.anonymousId,
      userId: this.userId,
      language: navigator.language,
      screenWidth: window.screen?.width,
      context: collectContext(),
    });
    if (this.queue.length >= MAX_QUEUE) this.flush();
    else if (!this.timer) this.timer = setTimeout(() => this.flush(), FLUSH_DELAY_MS);
  }

  private send(body: string, beacon: boolean): void {
    // text/plain = requete CORS "simple" (pas de preflight) et compatible sendBeacon.
    if (beacon && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(this.collectUrl, new Blob([body], { type: 'text/plain' }))) return;
    }
    fetch(this.collectUrl, {
      method: 'POST',
      body,
      keepalive: true,
      credentials: 'omit',
      headers: { 'content-type': 'text/plain' },
    })
      .then((res) => {
        if (this.options.debug) console.debug('[aynalytics]', res.status, JSON.parse(body));
      })
      .catch((err: unknown) => {
        if (this.options.debug) console.warn('[aynalytics] envoi impossible', err);
      });
  }

  private onAuxClick = (event: Event): void => {
    if (event instanceof MouseEvent && event.button === 1) this.onClick(event);
  };

  private onClick = (event: Event): void => {
    if (!(event.target instanceof Element)) return;
    const tagged = event.target.closest('[data-ay-event]');
    const name = tagged?.getAttribute('data-ay-event');
    if (tagged && name && this.options.autoClicks !== false) {
      const properties = attributeProperties(tagged);
      if (tagged instanceof HTMLAnchorElement && tagged.href && properties.href === undefined) {
        properties.href = tagged.href;
      }
      this.track(name, properties);
      // Le clic peut quitter la page (lien d'achat) : envoi immediat via beacon.
      this.flush(true);
      return;
    }

    const anchor = event.target.closest('a[href]');
    if (anchor instanceof HTMLAnchorElement) this.onLinkClick(anchor);
  };

  private onLinkClick(anchor: HTMLAnchorElement): void {
    let url: URL;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }
    const isWeb = url.protocol === 'http:' || url.protocol === 'https:';
    const isContact = url.protocol === 'mailto:' || url.protocol === 'tel:';
    const external = isContact || (isWeb && url.hostname !== window.location.hostname);
    const link: LinkClick = {
      url,
      element: anchor,
      text: (anchor.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 100),
      section: sectionOf(anchor),
      external,
      properties: attributeProperties(anchor),
    };

    const custom = this.options.classifyLink?.(link);
    if (custom === false) return;
    if (custom) {
      this.track(custom.name, { ...this.defaultLinkProperties(link), ...custom.properties });
    } else if (external && this.options.outboundLinks !== false) {
      this.track('outbound_click', this.defaultLinkProperties(link));
    } else {
      return;
    }
    this.flush(true);
  }

  private defaultLinkProperties(link: LinkClick): Properties {
    const { url } = link;
    const isContact = url.protocol === 'mailto:' || url.protocol === 'tel:';
    const properties: Properties = {
      // Pour mailto/tel : on garde le protocole et l'adresse, pas d'eventuels sujet/corps.
      url: isContact ? `${url.protocol}${url.pathname}` : url.href,
      host: isContact ? url.protocol.slice(0, -1) : url.hostname.replace(/^www\./, ''),
    };
    if (link.text) properties.text = link.text;
    if (link.section) properties.section = link.section;
    return { ...properties, ...link.properties };
  }

  private firePendingScreen(): void {
    if (!this.pendingScreen) return;
    clearTimeout(this.pendingScreen);
    this.pendingScreen = undefined;
    this.screen();
  }

  private watchRoutes(): void {
    const onRoute = () => {
      if (window.location.pathname === this.lastScreenPath) return;
      // Route quittee avant le delai (redirection, double navigation) : pas une vraie vue, on l'abandonne.
      // L'URL a deja change, l'envoyer maintenant l'attribuerait a la nouvelle page.
      clearTimeout(this.pendingScreen);
      this.lastScreenPath = window.location.pathname;
      this.pendingScreen = setTimeout(() => this.firePendingScreen(), AUTO_SCREEN_DELAY_MS);
    };
    for (const method of ['pushState', 'replaceState'] as const) {
      const original = history[method];
      history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
        const result = original.apply(this, args);
        onRoute();
        return result;
      };
      this.cleanups.push(() => {
        history[method] = original;
      });
    }
    this.listen(window, 'popstate', onRoute);
    onRoute();
  }

  private listen(target: EventTarget, type: string, handler: (event: Event) => void, capture = false): void {
    target.addEventListener(type, handler, capture);
    this.cleanups.push(() => target.removeEventListener(type, handler, capture));
  }
}
