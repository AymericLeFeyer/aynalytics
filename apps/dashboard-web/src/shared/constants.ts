import type { Dimension } from '../domain/analytics/entities/Stats';

export type RangePreset = '24h' | '7d' | '30d' | '90d' | '365d';

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: '24h', label: '24 h' },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: '365d', label: '12 mois' },
];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  site: 'Site',
  name: 'Nom',
  path: 'Page',
  source: 'Source',
  referrer: 'Référent',
  utm_source: 'utm_source',
  utm_medium: 'utm_medium',
  utm_campaign: 'Campagne',
  browser: 'Navigateur',
  os: 'Système',
  device: 'Appareil',
  language: 'Langue',
  title: 'Titre',
  country: 'Pays',
  region: 'Région',
  city: 'Ville',
  timezone: 'Fuseau',
  screen: 'Écran',
  color_scheme: 'Thème',
  connection: 'Réseau',
};
