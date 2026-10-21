import type { AynalyticsOptions, EventType, Properties, WireEvent, WireUtm } from './types';

const SESSION_TTL_MS = 30 * 60_000;
const FLUSH_DELAY_MS = 1000;
const MAX_QUEUE = 20;
const MAX_BATCH = 50;
const STORAGE_PREFIX = 'aynalytics:';
const PROP_ATTR_PREFIX = 'data-ay-prop-';
const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const;

interface SessionState {
  id: string;
  lastSeen: number;
  /** Referent externe au debut de la session : c'est lui qui donne la source des evenements suivants. */
  referrer?: string;
  utm?: WireUtm;
}

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
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

/** Valeur d'attribut data-ay-prop-* : nombres et booleens convertis, le reste en texte. */
function coerceAttribute(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

export class AynalyticsClient {
  private queue: WireEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
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

    if (this.persistence === 'local') {
      this.anonymousId = readJson<string>(this.localStore, 'anonymousId') ?? uuid();
      writeJson(this.localStore, 'anonymousId', this.anonymousId);
    }
    this.userId = readJson<string>(this.sessionStore, 'userId') ?? undefined;

    this.listen(window, 'pagehide', () => this.flush(true));
    this.listen(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush(true);
    });
    if (options.autoClicks !== false) this.listen(document, 'click', this.onClick, true);
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
    if (this.persistence === 'local') {
      this.anonymousId = uuid();
      writeJson(this.localStore, 'anonymousId', this.anonymousId);
    }
  }

  /** Envoie la file. `beacon` = envoi garanti meme si la page se ferme (clic sortant, fermeture d'onglet). */
  flush(beacon = false): void {
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
      referrer: session.referrer,
      utm: session.utm,
      sessionId: session.id,
      anonymousId: this.anonymousId,
      userId: this.userId,
      language: navigator.language,
      screenWidth: window.screen?.width,
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

  private onClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest('[data-ay-event]') : null;
    const name = target?.getAttribute('data-ay-event');
    if (!target || !name) return;
    const properties: Properties = {};
    for (const attr of Array.from(target.attributes)) {
      if (attr.name.startsWith(PROP_ATTR_PREFIX)) {
        properties[attr.name.slice(PROP_ATTR_PREFIX.length)] = coerceAttribute(attr.value);
      }
    }
    if (target instanceof HTMLAnchorElement && target.href && properties.href === undefined) {
      properties.href = target.href;
    }
    this.track(name, properties);
    // Le clic peut quitter la page (lien d'achat) : envoi immediat via beacon.
    this.flush(true);
  };

  private watchRoutes(): void {
    const onRoute = () => {
      if (window.location.pathname === this.lastScreenPath) return;
      this.lastScreenPath = window.location.pathname;
      this.screen();
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
