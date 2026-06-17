import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fallbackResumeData } from '@/lib/data';
import type { PortfolioData } from '@/types';

export function usePortfolioData() {
  return useQuery<PortfolioData>({
    queryKey: ['portfolio'],
    queryFn: async () => {
      try {
        return await api.getPortfolio();
      } catch (e) {
        console.warn('Backend unavailable, falling back to static data');
        return fallbackResumeData;
      }
    }
  });
}
