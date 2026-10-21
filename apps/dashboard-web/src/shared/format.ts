import dayjs from 'dayjs';

const integer = new Intl.NumberFormat('fr-FR');
const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export const formatInt = (value: number): string => integer.format(value);
export const formatNumber = (value: number): string => decimal.format(value);
export const formatDateTime = (ts: number): string => dayjs(ts).format('DD/MM/YYYY HH:mm:ss');

/** Variation relative en %, null si pas de base de comparaison. */
export function variation(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' });
  } catch {
    return null;
  }
})();

const flag = (code: string): string =>
  String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));

/** `FR` -> `🇫🇷 France`. Les valeurs non ISO (ex : `(aucun)`) sont rendues telles quelles. */
export function formatCountry(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return code;
  return `${flag(code)} ${regionNames?.of(code.toUpperCase()) ?? code}`;
}

const COLOR_SCHEMES: Record<string, string> = { dark: 'Sombre', light: 'Clair' };

/** Libelle lisible d'une valeur de dimension (pays, theme...). */
export function formatDimensionValue(dimension: string, value: string): string {
  if (dimension === 'country') return formatCountry(value);
  if (dimension === 'color_scheme') return COLOR_SCHEMES[value] ?? value;
  return value;
}
