import { z } from 'zod';
import type { JsonValue } from '../entities/TrackedEvent';

export const LIMITS = {
  maxEventsPerBatch: 50,
  maxNameLength: 100,
  maxPropertyKeys: 50,
  maxKeyLength: 64,
  maxStringLength: 1000,
  maxArrayLength: 50,
  maxDepth: 3,
  maxPropertiesBytes: 8192,
  maxUrlLength: 2048,
  maxIdLength: 128,
} as const;

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function depthOf(value: JsonValue): number {
  if (value === null || typeof value !== 'object') return 0;
  const children = Array.isArray(value) ? value : Object.values(value);
  return 1 + children.reduce<number>((max, child) => Math.max(max, depthOf(child)), 0);
}

const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string().max(LIMITS.maxStringLength),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue).max(LIMITS.maxArrayLength),
    z.record(z.string().max(LIMITS.maxKeyLength), jsonValue),
  ]),
);

const propertyKey = z
  .string()
  .min(1)
  .max(LIMITS.maxKeyLength)
  .refine((k) => !hasControlChars(k), 'invalid key');

/** Proprietes libres ("on met ce qu'on veut"), mais bornees en taille et profondeur. */
export const propertiesSchema = z
  .record(propertyKey, jsonValue)
  .refine((o) => Object.keys(o).length <= LIMITS.maxPropertyKeys, 'too many properties')
  .refine((o) => depthOf(o) <= LIMITS.maxDepth, 'properties too deep')
  .refine((o) => JSON.stringify(o).length <= LIMITS.maxPropertiesBytes, 'properties too large');

const eventName = z
  .string()
  .trim()
  .min(1)
  .max(LIMITS.maxNameLength)
  .refine((n) => !hasControlChars(n), 'invalid name');

const identifier = z.string().min(1).max(LIMITS.maxIdLength);
const shortText = z.string().max(200);
const dimension = z.number().int().min(0).max(20000);

/** Donnees navigateur collectees sans permission (pas de Geolocation API). Champs inconnus ignores. */
export const contextSchema = z.object({
  timezone: z.string().max(64).optional(),
  languages: z.array(z.string().max(35)).max(10).optional(),
  screenHeight: dimension.optional(),
  viewportWidth: dimension.optional(),
  viewportHeight: dimension.optional(),
  pixelRatio: z.number().min(0).max(10).optional(),
  colorScheme: z.enum(['light', 'dark']).optional(),
  reducedMotion: z.boolean().optional(),
  connection: z.string().max(20).optional(),
  saveData: z.boolean().optional(),
  deviceMemory: z.number().min(0).max(1024).optional(),
  cpuCores: z.number().int().min(0).max(1024).optional(),
  touchPoints: z.number().int().min(0).max(100).optional(),
  platform: z.string().max(50).optional(),
  mobile: z.boolean().optional(),
});
export type BrowserContext = z.infer<typeof contextSchema>;

export const incomingEventSchema = z.object({
  type: z.enum(['screen', 'event']),
  name: eventName,
  properties: propertiesSchema.optional(),
  ts: z.number().int().positive().optional(),
  url: z.string().max(LIMITS.maxUrlLength).optional(),
  referrer: z.string().max(LIMITS.maxUrlLength).optional(),
  utm: z
    .object({
      source: shortText.optional(),
      medium: shortText.optional(),
      campaign: shortText.optional(),
      term: shortText.optional(),
      content: shortText.optional(),
    })
    .optional(),
  sessionId: identifier.optional(),
  anonymousId: identifier.optional(),
  userId: identifier.optional(),
  language: z.string().max(35).optional(),
  screenWidth: z.number().int().min(0).max(20000).optional(),
  title: z.string().max(300).optional(),
  context: contextSchema.optional(),
});

export const collectPayloadSchema = z.object({
  siteKey: z.string().min(1).max(64),
  events: z.array(incomingEventSchema).min(1).max(LIMITS.maxEventsPerBatch),
});

export type IncomingEvent = z.infer<typeof incomingEventSchema>;
export type CollectPayload = z.infer<typeof collectPayloadSchema>;
