export interface Site {
  id: string;
  name: string;
  /** Cle publique embarquee dans le SDK navigateur (non secrete). */
  publicKey: string;
  /** SHA-256 de la cle secrete (envoi serveur-a-serveur). La cle en clair n'est jamais stockee. */
  secretHash: string;
  /** Origines autorisees : `https://exemple.com`, `https://*.exemple.com`, `http://localhost:5173`. */
  allowedOrigins: string[];
  active: boolean;
  createdAt: number;
}

export type PublicSite = Omit<Site, 'secretHash'>;

export function toPublicSite(site: Site): PublicSite {
  const { secretHash: _secretHash, ...rest } = site;
  return rest;
}
