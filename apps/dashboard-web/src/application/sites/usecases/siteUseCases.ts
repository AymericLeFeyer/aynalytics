import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { siteRepository } from '../../../composition';
import type { SiteInput, SitePatch } from '../../../domain/sites/entities/Site';

const SITES_KEY = ['sites'] as const;

export function useSites() {
  return useQuery({ queryKey: SITES_KEY, queryFn: () => siteRepository.list() });
}

export function useCreateSite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SiteInput) => siteRepository.create(input),
    onSuccess: () => client.invalidateQueries({ queryKey: SITES_KEY }),
  });
}

export function useUpdateSite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SitePatch }) => siteRepository.update(id, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: SITES_KEY }),
  });
}

export function useRotateSiteSecret() {
  return useMutation({ mutationFn: (id: string) => siteRepository.rotateSecret(id) });
}

export function useDeleteSite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => siteRepository.remove(id),
    // Les stats changent aussi : on invalide tout.
    onSuccess: () => client.invalidateQueries(),
  });
}
