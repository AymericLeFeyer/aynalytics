import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const generatePublicKey = (): string => `ay_pk_${randomBytes(12).toString('base64url')}`;
export const generateSecretKey = (): string => `ay_sk_${randomBytes(32).toString('base64url')}`;

export const hashSecret = (secret: string): string => createHash('sha256').update(secret).digest('hex');

/** Comparaison a temps constant de la cle secrete avec son hash stocke. */
export function verifySecret(secret: string, expectedHash: string): boolean {
  const given = Buffer.from(hashSecret(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
