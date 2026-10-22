import { useCallback, useMemo } from 'react';
import { useSites } from '../../application/sites/usecases/siteUseCases';

/** Nom lisible d'un site a partir de son id (les statistiques ne renvoient que l'id). */
export function useSiteNames(): (siteId: string) => string {
  const { data: sites } = useSites();
  const names = useMemo(() => new Map((sites ?? []).map((site) => [site.id, site.name])), [sites]);
  return useCallback(
    // Par securite : la suppression d un site efface ses evenements, mais le cache peut etre en retard.
    (siteId) => names.get(siteId) ?? (sites ? `Site inconnu (${siteId.slice(0, 8)})` : siteId),
    [names, sites],
  );
}
