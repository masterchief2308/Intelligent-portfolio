'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import Link from 'next/link';
import SessionGate from '@/components/SessionGate';
import { ReactFlow, Background, Controls, Node, Edge, Position, Handle, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const BrutalistNode = ({ data }: { data: any }) => (
  <div className={`
    bg-[#050505] border px-6 py-3 font-mono text-[10px] md:text-xs uppercase tracking-widest transition-all duration-300 relative
    ${data.isFaded ? 'opacity-20 grayscale' : 'opacity-100'}
    ${data.isProject ? 'border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' :
      'border-foreground/20 text-foreground hover:border-foreground hover:text-foreground'}
  `}>
    {!data.isProject && <Handle type="target" position={Position.Left} className="w-1 h-1 bg-amber-500/50 border-none" />}
    {data.label}
    {data.isProject && <Handle type="source" position={Position.Right} className="w-1 h-1 bg-amber-500/50 border-none" />}
  </div>
);

const nodeTypes = { custom: BrutalistNode };

export default function ExploreTopologyPage() {
  const { mounted, personalization } = useHydrateSession();
  const { data: portfolio, isError, error } = usePortfolioData();

  const { initialNodes, initialEdges } = useMemo(() => {
    const projects = portfolio?.projects || [];
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const allSkills = new Set<string>();
    projects.forEach(p => p.techStack?.forEach((tech: string) => allSkills.add(tech)));
    const uniqueSkills = Array.from(allSkills);

    const projectX = 0;
    const skillX = 500;
    const projectSpacingY = 200;
    const projectStartY = -((projects.length - 1) * projectSpacingY) / 2;

    projects.forEach((project, pIdx) => {
      const pY = projectStartY + pIdx * projectSpacingY;
      const pId = `proj-${project.id}`;
      nodes.push({
        id: pId,
        type: 'custom',
        position: { x: projectX, y: pY },
        data: { label: project.title, isProject: true },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
      project.techStack?.forEach((tech: string) => {
        const skillId = `skill-${tech.replace(/\s+/g, '-')}`;
        edges.push({
          id: `edge-${pId}-${skillId}`,
          source: pId,
          target: skillId,
          animated: true,
          style: { stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }
        });
      });
    });

    const skillSpacingY = 50;
    const skillStartY = -((uniqueSkills.length - 1) * skillSpacingY) / 2;
    uniqueSkills.forEach((skill, sIdx) => {
      const sY = skillStartY + sIdx * skillSpacingY;
      const skillId = `skill-${skill.replace(/\s+/g, '-')}`;
      nodes.push({
        id: skillId,
        type: 'custom',
        position: { x: skillX, y: sY },
        data: { label: skill, isSkill: true },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [portfolio]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback((_event: any, node: Node) => {
    const connectedEdges = initialEdges.filter(e => e.source === node.id || e.target === node.id);
    const connectedNodeIds = new Set([
      node.id,
      ...connectedEdges.map(e => e.source),
      ...connectedEdges.map(e => e.target)
    ]);

    setEdges((eds) =>
      eds.map((edge) => {
        const isConnected = edge.source === node.id || edge.target === node.id;
        return {
          ...edge,
          animated: isConnected,
          style: {
            ...edge.style,
            stroke: isConnected ? 'rgba(251,191,36, 1)' : 'rgba(255,255,255, 0.02)',
            strokeWidth: isConnected ? 2 : 1,
          },
          zIndex: isConnected ? 10 : 0,
        };
      })
    );

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isFaded: !connectedNodeIds.has(n.id) }
      }))
    );
  }, [initialEdges, setEdges, setNodes]);

  const onPaneClick = useCallback(() => {
    setEdges(initialEdges);
    setNodes(initialNodes);
  }, [initialEdges, initialNodes, setEdges, setNodes]);

  useEffect(() => {
    if (!personalization) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [personalization]);

  if (!mounted) return null;

  if (isError) {
    return (
      <div className="min-h-screen pt-32 px-6 sm:px-12 md:px-24 flex items-center justify-center font-mono">
        <div className="p-6 border border-red-500 bg-red-500/10 text-red-500 max-w-2xl z-50">
          <p className="uppercase tracking-widest font-bold mb-4">[BACKEND CAUGHT IN ERROR]</p>
          <p className="text-sm">{(error as Error)?.message || "Failed to load data"}</p>
        </div>
      </div>
    );
  }

  if (!personalization) {
    return <SessionGate title="Topology requires a session" />;
  }

  return (
    <div className="h-[100dvh] overflow-hidden relative z-10 flex flex-col">
      <div className="absolute top-24 sm:top-28 left-6 sm:left-12 md:left-24 z-20 pointer-events-none max-w-[min(100%,28rem)]">
        <Link
          href="/explore"
          className="pointer-events-auto font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-4 inline-block bg-[#050505]/90 p-2 border border-foreground/10"
        >
          ← Explore hub
        </Link>
        <div className="pointer-events-none">
          <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] font-bold tracking-tighter leading-[0.95] text-foreground uppercase mb-2 drop-shadow-md">
            Topology
          </h1>
          <p className="font-mono text-xs uppercase tracking-widest text-amber-500 bg-[#050505]/90 p-2 border border-foreground/10 w-fit">
            Click any node to isolate connections
          </p>
        </div>
      </div>

      <main className="flex-1 min-h-0 w-full relative">
        <div className="absolute inset-0 pt-16">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            proOptions={{ hideAttribution: true }}
            className="bg-transparent"
          >
            <Background color="rgba(255,255,255,0.02)" gap={40} size={1} />
            <Controls className="fill-foreground border-foreground/20 bg-[#050505] opacity-50 hover:opacity-100" />
          </ReactFlow>
        </div>
      </main>
    </div>
  );
}
