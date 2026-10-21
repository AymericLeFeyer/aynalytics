import { describe, expect, it } from 'vitest';
import { isOriginAllowed, normalizeOriginPattern } from './originPolicy';

describe('normalizeOriginPattern', () => {
  it('normalise casse, slash final et port par defaut', () => {
    expect(normalizeOriginPattern(' HTTPS://Exemple.com/ ')).toBe('https://exemple.com');
    expect(normalizeOriginPattern('https://exemple.com:443')).toBe('https://exemple.com');
    expect(normalizeOriginPattern('http://localhost:5173')).toBe('http://localhost:5173');
  });

  it('accepte les wildcards de sous-domaine', () => {
    expect(normalizeOriginPattern('https://*.exemple.com')).toBe('https://*.exemple.com');
  });

  it('rejette ce qui n est pas une origine pure', () => {
    for (const bad of [
      'exemple.com',
      'ftp://exemple.com',
      'https://exemple.com/path',
      'https://exemple.com?x=1',
      'https://user:pw@exemple.com',
      'https://*',
      'https://a*.exemple.com',
      'https://*.*.exemple.com',
      '*',
    ]) {
      expect(normalizeOriginPattern(bad), bad).toBeNull();
    }
  });
});

describe('isOriginAllowed', () => {
  const patterns = ['https://exemple.com', 'https://*.boutique.fr', 'http://localhost:5173'];

  it('autorise les origines exactes et les sous-domaines du wildcard', () => {
    expect(isOriginAllowed('https://exemple.com', patterns)).toBe(true);
    expect(isOriginAllowed('https://shop.boutique.fr', patterns)).toBe(true);
    expect(isOriginAllowed('https://a.b.boutique.fr', patterns)).toBe(true);
    expect(isOriginAllowed('http://localhost:5173', patterns)).toBe(true);
  });

  it('refuse le reste', () => {
    expect(isOriginAllowed(undefined, patterns)).toBe(false);
    expect(isOriginAllowed('null', patterns)).toBe(false);
    expect(isOriginAllowed('http://exemple.com', patterns)).toBe(false);
    expect(isOriginAllowed('https://exemple.com.evil.io', patterns)).toBe(false);
    expect(isOriginAllowed('https://evilexemple.com', patterns)).toBe(false);
    expect(isOriginAllowed('https://boutique.fr', patterns)).toBe(false);
    expect(isOriginAllowed('https://evilboutique.fr', patterns)).toBe(false);
    expect(isOriginAllowed('http://localhost:3000', patterns)).toBe(false);
  });
});
