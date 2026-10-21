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
