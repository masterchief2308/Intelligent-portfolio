import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fallbackResumeData } from '@/lib/data';
import type { PortfolioData } from '@/types';
import { useHydrateSession } from '@/hooks/useHydrateSession';

export function usePortfolioData() {
  const { personalization } = useHydrateSession();
  const email = personalization?.visitor_profile?.email;

  return useQuery<PortfolioData>({
    queryKey: ['portfolio', email],
    queryFn: async () => {
      try {
        return await api.getPortfolio(email);
      } catch (e) {
        console.warn('Backend unavailable, falling back to static data');
        return fallbackResumeData;
      }
    }
  });
}
