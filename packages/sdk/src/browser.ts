import aynalytics from './index';
import type { Persistence } from './types';

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
 * (stub `window.aynalytics.q`) sont rejoues apres l'init.
 */
const script = document.currentScript as HTMLScriptElement | null;
const pending = (window.aynalytics as { q?: QueuedCall[] } | undefined)?.q ?? [];

window.aynalytics = aynalytics;

const data = script?.dataset;
if (data?.siteKey) {
  aynalytics.init({
    siteKey: data.siteKey,
    endpoint: data.endpoint ?? new URL(script!.src).origin,
    autoScreens: data.autoScreens !== 'false',
    autoClicks: data.autoClicks !== 'false',
    persistence: (data.persistence as Persistence | undefined) ?? 'session',
    respectDoNotTrack: data.respectDnt === 'true',
    debug: data.debug === 'true',
  });
}

for (const [method, args] of pending) {
  const fn = aynalytics[method] as (...a: unknown[]) => unknown;
  if (typeof fn === 'function') fn(...Array.from(args));
}
