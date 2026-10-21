import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  DATA_DIR: z.string().default('../../data'),
  /** `false`, `true` ou une liste d'IP/CIDR de proxies de confiance (ex : `127.0.0.1,172.16.0.0/12`). */
  TRUST_PROXY: z.string().default('false'),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(240),
  /** 0 = conservation illimitee. */
  RETENTION_DAYS: z.coerce.number().int().min(0).default(0),
  /** Geolocalisation IP via DB-IP Lite : `city` (~130 Mo en RAM), `country` (~10 Mo) ou `off`. */
  GEOIP: z.enum(['city', 'country', 'off']).default('city'),
  SDK_DIR: z.string().default('../../packages/sdk/dist'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type CollectorEnv = z.infer<typeof schema>;

export const loadEnv = (): CollectorEnv => schema.parse(process.env);

export function parseTrustProxy(value: string): boolean | string[] {
  if (value === 'true') return true;
  if (value === 'false' || value === '') return false;
  return value.split(',').map((v) => v.trim());
}
