import type { Properties, WireEvent } from './types';

export type { Properties, WireEvent } from './types';

export interface ServerClientOptions {
  endpoint: string;
  siteKey: string;
  /** Cle secrete (`ay_sk_...`) : a garder cote serveur uniquement, jamais dans un bundle front. */
  secretKey: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

type EventContext = Omit<WireEvent, 'type' | 'name' | 'properties'>;

/**
 * Envoi serveur-a-serveur (webhook de paiement, backend...). Authentifie par cle secrete,
 * donc sans controle d'origine.
 */
export function createServerClient(options: ServerClientOptions) {
  const url = `${options.endpoint.replace(/\/+$/, '')}/v1/collect`;
  const doFetch = options.fetch ?? fetch;

  async function send(events: WireEvent[]): Promise<void> {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${options.secretKey}` },
      body: JSON.stringify({ siteKey: options.siteKey, events }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });
    if (!res.ok) throw new Error(`aynalytics: ${res.status} ${await res.text()}`);
  }

  return {
    send,
    track: (name: string, properties?: Properties, context?: EventContext) =>
      send([{ ts: Date.now(), ...context, type: 'event', name, properties }]),
    screen: (name: string, properties?: Properties, context?: EventContext) =>
      send([{ ts: Date.now(), ...context, type: 'screen', name, properties }]),
  };
}
