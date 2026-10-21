export interface Site {
  id: string;
  name: string;
  publicKey: string;
  allowedOrigins: string[];
  active: boolean;
  createdAt: number;
}

export interface SiteInput {
  name: string;
  allowedOrigins: string[];
}

export interface SitePatch {
  name?: string;
  allowedOrigins?: string[];
  active?: boolean;
}

/** La cle secrete n'est visible qu'a la creation / regeneration. */
export interface CreatedSite {
  site: Site;
  secretKey: string;
}
