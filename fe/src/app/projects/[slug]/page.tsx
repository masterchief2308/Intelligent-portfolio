'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { useProject } from '@/hooks/useProject';
import { useArchitecture } from '@/hooks/useArchitecture';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactFlow, Background, Controls, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

const BrutalistNode = ({ data }: { data: any }) => (
  <div className={`
    bg-[#050505] border px-4 py-2 font-mono text-[10px] md:text-xs tracking-widest transition-all duration-300 relative flex items-center gap-2
    ${data.isProject ? 'border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)] font-bold' :
      'border-foreground/20 text-foreground'}
  `}>
    <Handle type="target" position={Position.Top} id="t-top" className="w-1 h-1 bg-amber-500/50 border-none" />
    <Handle type="target" position={Position.Left} className="w-1 h-1 bg-amber-500/50 border-none" />
    {data.badge && <span className="text-amber-500 font-bold opacity-70">[{data.badge}]</span>}
    {data.label}
    <Handle type="source" position={Position.Right} className="w-1 h-1 bg-amber-500/50 border-none" />
    <Handle type="source" position={Position.Bottom} id="s-bottom" className="w-1 h-1 bg-amber-500/50 border-none" />
  </div>
);

const BoundingBoxNode = ({ data }: { data: any }) => (
  <div className="w-full h-full border-2 border-dashed border-foreground/20 bg-foreground/[0.02] rounded-none">
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

export default function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { mounted, personalization } = useHydrateSession();
  const visitorEmail = personalization?.visitor_profile?.email;
  
  const { data: project, isLoading: projectLoading, isError: isProjError, error: projError } = useProject(slug, visitorEmail);
  const { data: archData, isLoading: archLoading, isError: isArchError, error: archError } = useArchitecture(slug, visitorEmail);
  
  const [viewMode, setViewMode] = useState<'business' | 'technical'>('business');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  if (!mounted || projectLoading) {
    return (
      <div className="min-h-screen pt-32 px-6 sm:px-12 md:px-24 flex items-center justify-center font-mono">
        <p className="text-muted-foreground uppercase tracking-widest text-center">
          <span className="block mb-4">CONNECTING TO SYSTEM ARCHIVES...</span>
          <span className="text-amber-500 text-xs animate-pulse opacity-70">GENERATING PERSONALIZED CASE STUDY</span>
        </p>
      </div>
    );
  }

  if (isProjError || isArchError) {
    return (
      <div className="min-h-screen pt-32 px-6 sm:px-12 md:px-24 flex items-center justify-center font-mono">
        <div className="p-6 border border-red-500 bg-red-500/10 text-red-500 max-w-2xl z-50">
          <p className="uppercase tracking-widest font-bold mb-4">[BACKEND CAUGHT IN ERROR]</p>
          <p className="text-sm">{(projError as Error)?.message || (archError as Error)?.message || "Failed to load project data"}</p>
        </div>
      </div>
    );
  }

  if (!personalization) {
    return (
      <div className="min-h-screen pt-32 px-6 sm:px-12 md:px-24 flex items-center justify-center font-mono">
        <p className="text-muted-foreground uppercase tracking-widest">[ERR] Session unauthorized. Return to Index.</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen pt-32 px-6 sm:px-12 md:px-24 flex items-center justify-center font-mono">
        <p className="text-muted-foreground uppercase tracking-widest">[ERR] Project unmapped in static DB. Return to Index.</p>
      </div>
    );
  }

  const baseNodes = archData?.nodes || [];
  const baseEdges = archData?.edges || [];

  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    if (!baseNodes.length) return { layoutedNodes: [], layoutedEdges: [] };
    
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'LR', ranksep: 150, nodesep: 100 });

    baseNodes.forEach((node: any) => {
      // Set group node dimensions larger
      if (node.type === 'group') {
        dagreGraph.setNode(node.id, { width: 500, height: 400 });
      } else {
        dagreGraph.setNode(node.id, { width: 180, height: 50 });
      }
    });

    baseEdges.forEach((edge: any) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = baseNodes.map((node: any) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      
      // If it's a child node, we need to adjust its position relative to parent?
      // Actually React Flow handles relative positioning for child nodes if parentId is set
      // and position is relative to parent. Dagre might struggle with nested groups out of the box,
      // but setting explicit positions helps.
      
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - (node.type === 'group' ? 250 : 90),
          y: nodeWithPosition.y - (node.type === 'group' ? 200 : 25),
        },
      };
    });

    return { layoutedNodes, layoutedEdges: baseEdges };
  }, [baseNodes, baseEdges]);

  const displayNodes = layoutedNodes.map(node => {
    if (!selectedNodeId) return { ...node, style: { ...node.style, transition: 'opacity 0.3s' } };

    const connectedEdges = baseEdges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId);
    const connectedNodeIds = new Set([
      selectedNodeId,
      ...connectedEdges.map(e => e.source),
      ...connectedEdges.map(e => e.target)
    ]);

    const hasActiveChild = baseNodes.some(n => n.parentId === node.id && connectedNodeIds.has(n.id));
    const isGroup = node.type === 'group';
    const isVisible = connectedNodeIds.has(node.id) || (isGroup && hasActiveChild);

    return {
      ...node,
      style: {
        ...node.style,
        opacity: isVisible ? 1 : 0.2,
        transition: 'opacity 0.3s'
      }
    };
  });

  const displayEdges = layoutedEdges.map(edge => {
    if (!selectedNodeId) return { ...edge, style: { ...edge.style, transition: 'opacity 0.3s, stroke 0.3s' } };

    const isActive = edge.source === selectedNodeId || edge.target === selectedNodeId;

    return {
      ...edge,
      style: {
        ...edge.style,
        opacity: isActive ? 1 : 0.1,
        stroke: isActive ? 'rgba(245,158,11,1)' : (edge.style?.stroke || 'rgba(251,191,36,0.3)'),
        transition: 'opacity 0.3s, stroke 0.3s'
      }
    };
  });

  return (
    <div className="min-h-screen relative z-10 px-6 sm:px-12 md:px-24 pt-32 pb-24 flex flex-col">
      <main className="flex-1 w-full max-w-[1200px] mx-auto">

        <div className="mb-16 border-b border-foreground/10 pb-8">
          <button
            onClick={() => router.push('/')}
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8 block"
          >
            ← Return to Index
          </button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <h1 className="text-5xl sm:text-6xl md:text-[5rem] font-bold tracking-tighter leading-[0.9] text-foreground uppercase max-w-4xl mb-4">
                {project.title}
              </h1>
              <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
                Client: {project.client} | {project.date} | {project.cloud}
              </p>
            </div>
            <div className="text-left md:text-right">
              <span className="block text-4xl font-bold tracking-tighter text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                {project.metric}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mt-2">
                Core Metric
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
          <div className="md:col-span-5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <h3 className="text-foreground mb-4 border-b border-foreground/10 pb-2 inline-block">00 // System Context</h3>
            <p className="leading-relaxed mb-6">{project.context}</p>
          </div>
          <div className="md:col-span-7 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <h3 className="text-foreground mb-4 border-b border-foreground/10 pb-2 inline-block">01 // Architectural Implementation</h3>
            <p className="leading-relaxed">{project.howItWorks}</p>
          </div>
        </div>

        <div className="mb-16 border border-foreground/10 bg-[#050505] relative overflow-hidden h-[500px]">
          <div className="absolute top-4 left-6 z-10 font-mono text-xs uppercase tracking-widest text-amber-500 bg-[#050505] px-2 py-1">
            02 // Architecture Topology
          </div>

          <div className="w-full h-full pt-16">
            {archLoading ? (
              <div className="w-full h-full flex items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
                COMPILING TOPOLOGY BLUEPRINTS...
              </div>
            ) : (
              <ReactFlow
                nodes={displayNodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                onPaneClick={() => setSelectedNodeId(null)}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
                proOptions={{ hideAttribution: true }}
                className="bg-transparent"
              >
                <Background color="rgba(255,255,255,0.02)" gap={40} size={1} />
                <Controls className="fill-foreground border-foreground/20 bg-[#050505] opacity-50 hover:opacity-100" />
              </ReactFlow>
            )}
          </div>
        </div>

        <div className="border border-foreground/10 bg-white/[0.01] backdrop-blur-sm p-8 sm:p-12 relative overflow-hidden">
          <div className="flex gap-4 mb-12 border-b border-foreground/10 pb-4">
            <button
              onClick={() => setViewMode('business')}
              className={`font-mono text-sm tracking-widest uppercase transition-colors ${viewMode === 'business' ? 'text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              [01] ROI Impact
            </button>
            <button
              onClick={() => setViewMode('technical')}
              className={`font-mono text-sm tracking-widest uppercase transition-colors ${viewMode === 'technical' ? 'text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              [02] Code Stack
            </button>
          </div>

          <div className="min-h-[250px]">
            <AnimatePresence mode="wait">
              {viewMode === 'business' ? (
                <motion.div
                  key="business"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <ul className="space-y-6">
                    {project.roi?.map((item: string, i: number) => (
                      <li key={i} className="flex gap-4 items-start">
                        <span className="font-mono text-amber-500 mt-1">→</span>
                        <p className="text-lg md:text-xl text-foreground font-light leading-relaxed">{item}</p>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ) : (
                <motion.div
                  key="technical"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {project.techStack?.map((tech: string, i: number) => (
                      <div key={i} className="border border-foreground/20 p-4 bg-foreground/5 hover:bg-foreground/10 transition-colors">
                        <span className="font-mono text-xs uppercase tracking-widest text-foreground block mb-2 opacity-50">STACK_{i.toString().padStart(2, '0')}</span>
                        <span className="font-bold text-foreground">{tech}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
