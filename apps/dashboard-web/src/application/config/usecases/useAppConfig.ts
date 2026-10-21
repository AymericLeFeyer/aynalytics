import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../../composition';
import { fetchAppConfig } from '../../../infrastructure/config/appConfigApi';

export function useAppConfig() {
  return useQuery({ queryKey: ['config'], queryFn: () => fetchAppConfig(httpClient), staleTime: Infinity });
}
