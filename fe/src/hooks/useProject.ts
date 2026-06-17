import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useProject(slug: string, email?: string) {
  return useQuery({
    queryKey: ['project', slug, email],
    queryFn: async () => {
      return api.getProject(slug, email);
    },
    enabled: !!slug,
  });
}
