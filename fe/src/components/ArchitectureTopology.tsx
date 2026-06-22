'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ARCH_LAYOUT } from '@/lib/architectureLayout';

const BrutalistNode = ({ data }: { data: any }) => (
  <div
    className={`
    bg-[#050505] border px-4 py-2 font-mono text-[10px] md:text-xs tracking-widest transition-all duration-300 relative flex items-center gap-2 whitespace-nowrap
    ${
      data.isProject
        ? 'border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)] font-bold'
        : 'border-foreground/20 text-foreground'
    }
  `}
  >
    <Handle type="target" position={Position.Top} id="t-top" className="w-1 h-1 bg-amber-500/50 border-none" />
    <Handle type="target" position={Position.Left} id="t-left" className="w-1 h-1 bg-amber-500/50 border-none" />
    {data.badge && <span className="text-amber-500 font-bold opacity-70">[{data.badge}]</span>}
    {data.label}
    <Handle type="source" position={Position.Right} id="s-right" className="w-1 h-1 bg-amber-500/50 border-none" />
    <Handle type="source" position={Position.Bottom} id="s-bottom" className="w-1 h-1 bg-amber-500/50 border-none" />
  </div>
);

const BoundingBoxNode = ({ data }: { data: any }) => (
  <div className="w-full h-full border-2 border-dashed border-foreground/20 bg-foreground/[0.02] rounded-none pointer-events-none">
    <div className="absolute top-0 left-4 -translate-y-1/2 bg-[#050505] px-2 font-mono text-[10px] uppercase tracking-widest text-foreground font-bold flex items-center gap-2 border border-foreground/20">
      {data.badge && <span className="text-amber-500">[{data.badge}]</span>}
      {data.label}
    </div>
  </div>
);

const nodeTypes = {
  custom: BrutalistNode,
  group: BoundingBoxNode,
};

interface ArchitectureTopologyProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
  isLoading?: boolean;
}

function ArchitectureFlow({
  nodes,
  edges,
  selectedNodeId,
  onNodeSelect,
  isLoading,
}: ArchitectureTopologyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  const fit = useCallback(() => {
    fitView({ padding: ARCH_LAYOUT.fitViewPadding, duration: 250, minZoom: 0.08, maxZoom: 1.2 });
  }, [fitView]);

  useEffect(() => {
    if (!nodes.length || isLoading) return;
    const t = window.setTimeout(fit, 50);
    return () => window.clearTimeout(t);
  }, [nodes, edges, isLoading, fit]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const displayNodes = useMemo(() => {
    if (!selectedNodeId) {
      return nodes.map((node) => ({
        ...node,
        style: { ...node.style, transition: 'opacity 0.3s' },
      }));
    }

    const connectedEdges = edges.filter(
      (e) => e.source === selectedNodeId || e.target === selectedNodeId,
    );
    const connectedNodeIds = new Set([
      selectedNodeId,
      ...connectedEdges.flatMap((e) => [e.source, e.target]),
    ]);

    return nodes.map((node) => {
      const hasActiveChild = nodes.some(
        (n) => n.parentId === node.id && connectedNodeIds.has(n.id),
      );
      const isGroup = node.type === 'group';
      const isVisible = connectedNodeIds.has(node.id) || (isGroup && hasActiveChild);

      return {
        ...node,
        style: {
          ...node.style,
          opacity: isVisible ? 1 : 0.2,
          transition: 'opacity 0.3s',
        },
      };
    });
  }, [nodes, edges, selectedNodeId]);

  const displayEdges = useMemo(() => {
    if (!selectedNodeId) {
      return edges.map((edge) => ({
        ...edge,
        style: { ...edge.style, transition: 'opacity 0.3s, stroke 0.3s' },
      }));
    }

    return edges.map((edge) => {
      const isActive = edge.source === selectedNodeId || edge.target === selectedNodeId;
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: isActive ? 1 : 0.1,
          stroke: isActive ? 'rgba(245,158,11,1)' : edge.style?.stroke || 'rgba(251,191,36,0.3)',
          transition: 'opacity 0.3s, stroke 0.3s',
        },
      };
    });
  }, [edges, selectedNodeId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full pt-16"
      style={{ minHeight: ARCH_LAYOUT.canvasMinHeight }}
    >
      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          COMPILING TOPOLOGY BLUEPRINTS...
        </div>
      ) : (
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onNodeSelect(node.id)}
          onPaneClick={() => onNodeSelect(null)}
          fitView
          fitViewOptions={{ padding: ARCH_LAYOUT.fitViewPadding }}
          minZoom={0.08}
          maxZoom={1.2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
          className="bg-transparent"
        >
          <Background color="rgba(255,255,255,0.02)" gap={40} size={1} />
          <Controls className="fill-foreground border-foreground/20 bg-[#050505] opacity-50 hover:opacity-100" />
        </ReactFlow>
      )}
    </div>
  );
}

export default function ArchitectureTopology(props: ArchitectureTopologyProps) {
  return (
    <ReactFlowProvider>
      <ArchitectureFlow {...props} />
    </ReactFlowProvider>
  );
}
