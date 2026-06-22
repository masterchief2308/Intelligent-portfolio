import dagre from 'dagre';
import { Node, Edge, Position } from '@xyflow/react';
import type { ArchitectureData, ArchEdge, ArchNode } from '@/types';

/** Layout contract shared with the backend / Gemini prompts. FE owns all x/y sizing. */
export const ARCH_LAYOUT = {
  direction: 'TB' as const,
  nodeSep: 100,
  rankSep: 140,
  marginX: 48,
  marginY: 48,
  groupPaddingX: 48,
  groupPaddingY: 56,
  minNodeWidth: 168,
  maxNodeWidth: 300,
  nodeHeight: 52,
  minGroupWidth: 320,
  minGroupHeight: 240,
  canvasMinHeight: 420,
  canvasHeight: 'min(55vh, 560px)',
  fitViewPadding: 0.18,
} as const;

function estimateNodeWidth(label: string, badge?: string): number {
  const text = badge ? `[${badge}] ${label}` : label;
  const width = text.length * 7.5 + 40;
  return Math.min(ARCH_LAYOUT.maxNodeWidth, Math.max(ARCH_LAYOUT.minNodeWidth, width));
}

function toEdgeStyle(e: ArchEdge) {
  return {
    stroke: e.dashed ? 'rgba(255,255,255,0.2)' : 'rgba(251,191,36,0.3)',
    strokeWidth: e.dashed ? 1 : 2,
    strokeDasharray: e.dashed ? '5,5' : 'none',
  };
}

function defaultHandles(direction: 'TB' | 'LR') {
  if (direction === 'LR') {
    return { sourcePosition: Position.Right, targetPosition: Position.Left };
  }
  return { sourcePosition: Position.Bottom, targetPosition: Position.Top };
}

function nodeLabel(data: Record<string, unknown> | undefined): string {
  return typeof data?.label === 'string' ? data.label : '';
}

function nodeBadge(data: Record<string, unknown> | undefined): string | undefined {
  return typeof data?.badge === 'string' ? data.badge : undefined;
}

/** Dagre compound layout — single source of truth for architecture positioning. */
export function layoutArchitectureGraph(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = ARCH_LAYOUT.direction,
): { nodes: Node[]; edges: Edge[] } {
  if (!nodes.length) return { nodes: [], edges: [] };

  const nodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  const dagreGraph = new dagre.graphlib.Graph({ compound: true, multigraph: false });
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: ARCH_LAYOUT.nodeSep,
    ranksep: ARCH_LAYOUT.rankSep,
    marginx: ARCH_LAYOUT.marginX,
    marginy: ARCH_LAYOUT.marginY,
    edgesep: 24,
  });

  const handles = defaultHandles(direction);

  nodes.forEach((node) => {
    if (node.type === 'group') {
      dagreGraph.setNode(node.id, {
        label: node.data?.label,
        width: ARCH_LAYOUT.minGroupWidth,
        height: ARCH_LAYOUT.minGroupHeight,
      });
    } else {
      const label = nodeLabel(node.data);
      const badge = nodeBadge(node.data);
      dagreGraph.setNode(node.id, {
        width: estimateNodeWidth(label, badge),
        height: ARCH_LAYOUT.nodeHeight,
      });
    }
  });

  nodes.forEach((node) => {
    if (node.parentId && nodeIds.has(node.parentId)) {
      dagreGraph.setParent(node.id, node.parentId);
    }
  });

  validEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const pos = dagreGraph.node(node.id);
    if (!pos) {
      return { ...node, position: node.position ?? { x: 0, y: 0 } };
    }

    if (node.type === 'group') {
      const width = Math.max(ARCH_LAYOUT.minGroupWidth, pos.width + ARCH_LAYOUT.groupPaddingX);
      const height = Math.max(ARCH_LAYOUT.minGroupHeight, pos.height + ARCH_LAYOUT.groupPaddingY);
      return {
        ...node,
        position: {
          x: pos.x - width / 2,
          y: pos.y - height / 2,
        },
        style: { ...node.style, width, height },
      };
    }

    const width = estimateNodeWidth(nodeLabel(node.data), nodeBadge(node.data));
    return {
      ...node,
      ...handles,
      position: {
        x: pos.x - width / 2,
        y: pos.y - ARCH_LAYOUT.nodeHeight / 2,
      },
    };
  });

  // React Flow nested nodes need parent-relative coordinates.
  layoutedNodes.forEach((node) => {
    if (!node.parentId) return;
    const parent = layoutedNodes.find((n) => n.id === node.parentId);
    if (!parent) return;
    node.position = {
      x: node.position.x - parent.position.x,
      y: node.position.y - parent.position.y,
    };
  });

  return { nodes: layoutedNodes, edges: validEdges };
}

export function architectureDataToReactFlow(data: ArchitectureData): { nodes: Node[]; edges: Edge[] } {
  const handles = defaultHandles(ARCH_LAYOUT.direction);

  const nodes: Node[] = data.nodes.map((n: ArchNode) => {
    if (n.type === 'group') {
      return {
        id: n.id,
        type: 'group',
        position: { x: 0, y: 0 },
        data: { label: n.label, badge: n.badge, layer: n.layer },
        ...(n.parentId && { parentId: n.parentId }),
      };
    }
    return {
      id: n.id,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        badge: n.badge,
        isProject: n.isExternal,
        layer: n.layer,
      },
      ...(n.parentId && { parentId: n.parentId, extent: 'parent' as const }),
      ...handles,
    };
  });

  const edges: Edge[] = data.edges.map((e: ArchEdge) => ({
    id: `e-${e.source}-${e.sourceHandle || 's'}-${e.target}-${e.targetHandle || 't'}`,
    source: e.source,
    target: e.target,
    ...(e.sourceHandle && { sourceHandle: e.sourceHandle }),
    ...(e.targetHandle && { targetHandle: e.targetHandle }),
    animated: e.animated ?? true,
    type: 'smoothstep',
    ...(e.label && { label: e.label }),
    style: toEdgeStyle(e),
  }));

  return layoutArchitectureGraph(nodes, edges);
}

/** Layout contract text — keep in sync with be/routers/architecture.py prompts. */
export const ARCH_LAYOUT_CONTRACT = `
FRONTEND LAYOUT CONTRACT (the renderer computes all positions — do NOT output x, y, width, or height):
- Types: "custom" = service/component box, "group" = dashed container (cloud, cluster, VPC).
- parentId: every node inside a group MUST set parentId to that group's id. Groups with no parent are top-level.
- isExternal: true for users, browsers, third-party plugins — keep them top-level (no parentId).
- Nesting: at most 2 levels (e.g. GCP group → GKE subgroup → pods). Do not nest deeper.
- Node budget: keep the same node count as the original diagram; do not add or remove nodes.
- Edges: preserve every original source→target pair; only adjust labels/animated/dashed if needed.
- layer (optional 0–4): 0=external actor, 1=frontend/edge, 2=API/compute, 3=async/workers, 4=data/storage — helps vertical ordering.
- Spacing is auto-calculated for a responsive canvas (~${ARCH_LAYOUT.canvasHeight}); overlapping coordinates from the static JSON are ignored.
`.trim();
