import { AynalyticsClient } from './client';
import type { AynalyticsOptions, Properties } from './types';

export { AynalyticsClient };
export type * from './types';

let instance: AynalyticsClient | null = null;

/** Initialise le client global (une fois, au demarrage de l'app). */
export function init(options: AynalyticsOptions): AynalyticsClient {
  instance?.destroy();
  instance = new AynalyticsClient(options);
  return instance;
}

export const track = (name: string, properties?: Properties): void => instance?.track(name, properties);
export const screen = (name?: string, properties?: Properties): void => instance?.screen(name, properties);
export const identify = (userId: string | null): void => instance?.identify(userId);
export const reset = (): void => instance?.reset();
export const flush = (): void => instance?.flush();

const aynalytics = { init, track, screen, identify, reset, flush };
export default aynalytics;
