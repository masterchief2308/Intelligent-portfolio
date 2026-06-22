import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getProjectArchitecture as getFallbackArchitecture } from '@/lib/architectures';
import { architectureDataToReactFlow, layoutArchitectureGraph } from '@/lib/architectureLayout';
import type { ArchitectureData } from '@/types';

export function useArchitecture(slug: string, email?: string) {
  const fallback = getFallbackArchitecture(slug);

  return useQuery({
    queryKey: ['architecture', slug, email],
    queryFn: async () => {
      try {
        const data: ArchitectureData = await api.getArchitecture(slug, email);
        return architectureDataToReactFlow(data);
      } catch (e: any) {
        if (e.message?.includes('Failed to fetch') || !email) {
          console.warn(`Backend unavailable for architecture ${slug}, falling back to static data`);
          if (fallback) {
            return layoutArchitectureGraph(fallback.nodes, fallback.edges);
          }
          return undefined;
        }
        throw e;
      }
    },
    enabled: !!slug,
  });
}
