import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getProjectArchitecture as getFallbackArchitecture } from '@/lib/architectures';
import type { ArchitectureData } from '@/types';
import { Node, Edge, Position } from '@xyflow/react';

function transformToReactFlow(data: ArchitectureData): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = data.nodes.map((n) => {
    if (n.type === 'group') {
      return {
        id: n.id,
        type: 'group',
        position: { x: n.x, y: n.y },
        style: { width: n.width, height: n.height },
        data: { label: n.label, badge: n.badge },
        ...(n.parentId && { parentId: n.parentId }),
      };
    }
    return {
      id: n.id,
      type: 'custom',
      position: { x: n.x, y: n.y },
      data: { label: n.label, badge: n.badge, isProject: n.isExternal },
      ...(n.parentId && { parentId: n.parentId, extent: 'parent' as const }),
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  const edges: Edge[] = data.edges.map((e) => ({
    id: `e-${e.source}-${e.sourceHandle || 'r'}-${e.target}-${e.targetHandle || 'l'}`,
    source: e.source,
    target: e.target,
    ...(e.sourceHandle && { sourceHandle: e.sourceHandle }),
    ...(e.targetHandle && { targetHandle: e.targetHandle }),
    animated: e.animated ?? true,
    type: 'smoothstep',
    ...(e.label && { label: e.label }),
    style: {
      stroke: e.dashed ? 'rgba(255,255,255,0.2)' : 'rgba(251,191,36,0.3)',
      strokeWidth: e.dashed ? 1 : 2,
      strokeDasharray: e.dashed ? '5,5' : 'none',
    },
  }));

  return { nodes, edges };
}

export function useArchitecture(slug: string) {
  const fallback = getFallbackArchitecture(slug);

  return useQuery({
    queryKey: ['architecture', slug],
    queryFn: async () => {
      try {
        const data = await api.getArchitecture(slug);
        return transformToReactFlow(data);
      } catch (e) {
        console.warn(`Backend unavailable for architecture ${slug}, falling back to static data`);
        return fallback ?? undefined;
      }
    },
    staleTime: 5 * 60_000,
    initialData: fallback ?? undefined,
    enabled: !!slug,
  });
}
