import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8081),
  HOST: z.string().default('0.0.0.0'),
  DATA_DIR: z.string().default('../../data'),
  BASIC_AUTH_USER: z.string().min(1, 'BASIC_AUTH_USER est requis'),
  BASIC_AUTH_PASSWORD: z.string().min(12, 'BASIC_AUTH_PASSWORD doit faire au moins 12 caracteres'),
  /** URL publique du collector, utilisee pour generer les snippets d'integration. */
  COLLECTOR_PUBLIC_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  WEB_DIST: z.string().default('../dashboard-web/dist'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type DashboardEnv = z.infer<typeof schema>;

export const loadEnv = (): DashboardEnv => schema.parse(process.env);
