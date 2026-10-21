import aynalytics from './index';
import type { AynalyticsOptions, Persistence } from './types';

type Api = typeof aynalytics;
type QueuedCall = [keyof Api, IArguments | unknown[]];

declare global {
  interface Window {
    aynalytics?: Api | { q?: QueuedCall[] };
  }
}

/**
 * Point d'entree du script `<script src=".../sdk.js" data-site-key="ay_pk_...">`.
 * L'endpoint est deduit de l'origine du script. Les appels faits avant le chargement
 * (stub `window.aynalytics.q`) sont rejoues apres l'init : automatique si `data-site-key`
 * est present, sinon au premier `window.aynalytics.init({...})` (init depuis le code, ex :
 * pour passer un `classifyLink`).
 */
const script = document.currentScript as HTMLScriptElement | null;
let pending = (window.aynalytics as { q?: QueuedCall[] } | undefined)?.q ?? [];

const replay = () => {
  const calls = pending;
  pending = [];
  for (const [method, args] of calls) {
    if (method === 'init') continue;
    const fn = aynalytics[method] as (...a: unknown[]) => unknown;
    if (typeof fn === 'function') fn(...Array.from(args));
  }
};

let initialized = false;

const init = (options: AynalyticsOptions) => {
  const client = aynalytics.init({
    ...options,
    endpoint: options.endpoint ?? (script ? new URL(script.src).origin : ''),
  });
  initialized = true;
  replay();
  return client;
};

/** Tant que `init` n'a pas ete appele, les appels sont mis en file au lieu d'etre perdus. */
const deferred =
  <K extends Exclude<keyof Api, 'init'>>(method: K) =>
  (...args: Parameters<Api[K]>) => {
    if (initialized) return (aynalytics[method] as (...a: unknown[]) => unknown)(...args);
    pending.push([method, args]);
  };

window.aynalytics = {
  ...aynalytics,
  init,
  track: deferred('track'),
  screen: deferred('screen'),
  identify: deferred('identify'),
  reset: deferred('reset'),
  flush: deferred('flush'),
} as Api;

const data = script?.dataset;
if (data?.siteKey) {
  init({
    siteKey: data.siteKey,
    endpoint: data.endpoint ?? new URL(script!.src).origin,
    autoScreens: data.autoScreens !== 'false',
    autoClicks: data.autoClicks !== 'false',
    outboundLinks: data.outboundLinks !== 'false',
    persistence: (data.persistence as Persistence | undefined) ?? 'session',
    respectDoNotTrack: data.respectDnt === 'true',
    debug: data.debug === 'true',
  });
}
