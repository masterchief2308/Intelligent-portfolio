import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getProjectArchitecture as getFallbackArchitecture } from '@/lib/architectures';
import type { ArchitectureData } from '@/types';
import { Node, Edge, Position } from '@xyflow/react';

import dagre from 'dagre';

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'TB') {
  const dagreGraph = new dagre.graphlib.Graph({ compound: true });
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Create a new graph with padding and spacing
  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 150 });

  // Add all nodes to Dagre
  nodes.forEach((node) => {
    if (node.type === 'group') {
      dagreGraph.setNode(node.id, { label: node.data?.label });
    } else {
      dagreGraph.setNode(node.id, { width: 250, height: 60 });
    }
  });

  // Assign parents
  nodes.forEach((node) => {
    if (node.parentId) {
      dagreGraph.setParent(node.id, node.parentId);
    }
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    if (node.type === 'group') {
      // Dagre calculates the bounding box for compound nodes
      // Add padding so children aren't touching the borders
      return { 
        ...node, 
        position: { x: nodeWithPosition.x - (nodeWithPosition.width / 2) - 20, y: nodeWithPosition.y - (nodeWithPosition.height / 2) - 40 }, 
        style: { width: nodeWithPosition.width + 40, height: nodeWithPosition.height + 60 } 
      };
    }

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
