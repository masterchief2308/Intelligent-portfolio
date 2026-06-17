import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getProjectArchitecture as getFallbackArchitecture } from '@/lib/architectures';
import type { ArchitectureData } from '@/types';
import { Node, Edge, Position } from '@xyflow/react';

import dagre from 'dagre';

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'TB') {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Create a new graph with padding and spacing
  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 150 });

  // For React Flow groups, Dagre handles them if we set them as parents, but it's simpler
  // to strip groups or just treat them as large background nodes. 
  // Let's strip parentId to ensure dagre cleanly lays out everything flat.
  const flatNodes = nodes.map(n => {
    const { parentId, ...rest } = n;
    return rest;
  });

  flatNodes.forEach((node) => {
    // Group nodes are large backgrounds, we skip them from the layout flow and place them at 0,0
    if (node.type === 'group') {
      // Don't add to dagre
    } else {
      dagreGraph.setNode(node.id, { width: 250, height: 60 });
    }
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = flatNodes.map((node) => {
    if (node.type === 'group') {
      return { ...node, position: { x: -200, y: -100 }, style: { width: 1200, height: 900 } };
    }
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      position: {
        x: nodeWithPosition.x - 125, // offset by half width
        y: nodeWithPosition.y - 30,  // offset by half height
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function transformToReactFlow(data: ArchitectureData): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = data.nodes.map((n) => {
    if (n.type === 'group') {
      return {
        id: n.id,
        type: 'group',
        position: { x: n.x || 0, y: n.y || 0 },
        style: { width: n.width, height: n.height },
        data: { label: n.label, badge: n.badge },
        ...(n.parentId && { parentId: n.parentId }),
      };
    }
    return {
      id: n.id,
      type: 'custom',
      position: { x: n.x || 0, y: n.y || 0 },
      data: { label: n.label, badge: n.badge, isProject: n.isExternal },
      ...(n.parentId && { parentId: n.parentId, extent: 'parent' as const }),
      sourcePosition: Position.Top,
      targetPosition: Position.Bottom,
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

  // Auto-layout elements so LLM doesn't have to guess XY coordinates!
  return getLayoutedElements(nodes, edges);
}

export function useArchitecture(slug: string, email?: string) {
  const fallback = getFallbackArchitecture(slug);

  return useQuery({
    queryKey: ['architecture', slug, email],
    queryFn: async () => {
      try {
        const data = await api.getArchitecture(slug, email);
        return transformToReactFlow(data);
      } catch (e) {
        console.warn(`Backend unavailable for architecture ${slug}, falling back to static data`);
        return fallback ?? undefined;
      }
    },
    enabled: !!slug,
  });
}
