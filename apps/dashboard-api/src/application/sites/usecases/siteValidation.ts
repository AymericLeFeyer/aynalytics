import { DomainError, normalizeOriginPattern } from '@aynalytics/core';

export function normalizeOrigins(origins: string[]): string[] {
  const normalized = origins.map((origin) => {
    const value = normalizeOriginPattern(origin);
    if (!value)
      throw new DomainError(
        `Origine invalide : "${origin}" (attendu : https://domaine.fr ou https://*.domaine.fr)`,
      );
    return value;
  });
  return [...new Set(normalized)];
}

export function normalizeName(name: string): string {
  const value = name.trim();
  if (!value || value.length > 100) throw new DomainError('Le nom doit faire entre 1 et 100 caractères');
  return value;
}
