'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { api } from '@/lib/api';
import { applyStepEvent } from '@/lib/thinkingSteps';
import ThinkingPanel, { type ThinkingStep } from '@/components/ThinkingPanel';
import { motion, AnimatePresence } from 'framer-motion';
import type { FeaturedProject } from '@/types';
import React from 'react';

export default function Home() {
  const { mounted, personalization, setPersonalization } = useHydrateSession();
  const { data: portfolio } = usePortfolioData();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("hiring");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [apiCalls, setApiCalls] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  async function handlePersonalization(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setThinkingSteps([
      {
        id: 'init',
        label: 'Establishing secure uplink to LangGraph engine...',
        status: 'running',
      },
    ]);
    setApiCalls(0);
    setError(null);
    
    try {
      const response = await fetch("/api/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, company })
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let finalData = null;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.replace('data: ', '').trim();
              if (!jsonStr) continue;
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
                if (parsed.type === 'step') {
                  setThinkingSteps((prev) => {
                    const withoutInit =
                      parsed.id !== 'cache' && prev.length === 1 && prev[0].id === 'init'
                        ? prev.map((s) => ({ ...s, status: 'done' as const }))
                        : prev;
                    return applyStepEvent(withoutInit, parsed);
                  });
                } else if (parsed.status) {
                  setThinkingSteps((prev) => [
                    ...prev.map((s) =>
                      s.status === 'running' ? { ...s, status: 'done' as const } : s,
                    ),
                    { id: `legacy-${prev.length}`, label: parsed.status, status: 'running' },
                  ]);
                }
                if (parsed.api_calls !== undefined) {
                  setApiCalls(parsed.api_calls);
                }
                if (parsed.result) {
                  finalData = parsed.result;
                }
              } catch (e: any) {
                if (e.message !== "Unexpected end of JSON input") {
                  console.error("Failed to parse SSE JSON:", e);
                }
              }
            }
          }
        }
      }

      if (!finalData) {
        throw new Error("Pipeline disconnected before returning blueprints.");
      }

      const data = finalData;
      if (data.visitor_profile) {
        data.visitor_profile.email = email;
      }

      localStorage.setItem('user_profile_complete', JSON.stringify({
        timestamp: Date.now(),
        personalization: data
      }));
      setPersonalization(data);

      api.trackVisit({
        email,
        role,
        company,
        timestamp: new Date().toISOString(),
        referrer: document.referrer,
        user_agent: navigator.userAgent,
      });
    } catch (err: any) {
      console.error("Personalization failed:", err);
      setError(err.message || "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  }

  const allCloudTags = useMemo(() => {
    if (!portfolio?.projects) return [];
    return [...new Set(portfolio.projects.map(p => p.cloud))];
  }, [portfolio]);

  const toggleFilter = (tag: string) => {
    setActiveFilters(prev =>
      prev.includes(tag) ? prev.filter(f => f !== tag) : [...prev, tag]
    );
  };

  const filteredProjects = useMemo(() => {
    let projects: FeaturedProject[] = personalization?.website_config?.featured_projects || [];
    if (projects.length === 0) {
      projects = portfolio?.projects?.map(p => ({
        id: p.id,
        title: p.title,
        highlight: p.context || '',
        why_relevant: p.context || p.howItWorks?.substring(0, 100) + '...',
        metric: p.metric || '99.9%'
      })) || [];
    }

    if (activeFilters.length === 0) return projects;

    return projects.filter((fp: FeaturedProject) => {
      const fullProject = portfolio?.projects?.find(p => p.id === fp.id);
      if (!fullProject) return true;
      return activeFilters.some(f =>
        fullProject.cloud === f || fullProject.techStack?.includes(f)
      );
    });
  }, [personalization, activeFilters, portfolio]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen relative z-10 px-6 sm:px-12 md:px-24 pt-32 pb-24 flex flex-col">
      <main className="flex-1 w-full max-w-[1400px] mx-auto">

        <div className="mb-32">
          {!personalization ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              <h1 className="text-6xl sm:text-7xl md:text-[7rem] font-bold tracking-tighter leading-[0.9] text-foreground uppercase">
                {portfolio?.basics.name?.split(' ')[0] || 'Aditya'} <br />
                <span className="text-muted-foreground">Architect.</span>
              </h1>

              <div className="font-mono text-sm max-w-xl uppercase tracking-widest text-muted-foreground border-l border-foreground/20 pl-6 py-2">
                <p className="mb-8">Initiating session. Enter parameters to compile relevant architecture blueprints.</p>

                <form onSubmit={handlePersonalization} className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] text-foreground/50">EMAIL_ (FOR LINKEDIN SCRAPE)</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="hello@company.com"
                      className="bg-transparent border-b border-foreground/20 py-2 focus:outline-none focus:border-foreground text-foreground placeholder:text-foreground/20 transition-colors rounded-none"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] text-foreground/50">SELECT_VECTOR_</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { key: 'hiring', label: '[01] RECRUITER' },
                        { key: 'engineer', label: '[02] ENGINEER' },
                        { key: 'manager', label: '[03] MANAGER' },
                        { key: 'other', label: '[04] EXPLORER' },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setRole(opt.key)}
                          className={`text-left px-4 py-2 border ${role === opt.key ? 'bg-foreground text-background border-foreground' : 'border-foreground/20 hover:border-foreground/50'} transition-all`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] text-foreground/50">COMPANY_ (OPTIONAL)</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Acme Corp"
                      className="bg-transparent border-b border-foreground/20 py-2 focus:outline-none focus:border-foreground text-foreground placeholder:text-foreground/20 transition-colors rounded-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-8 bg-foreground text-background px-8 py-4 font-bold hover:bg-foreground/80 transition-colors disabled:opacity-50"
                  >
                    {loading ? "COMPILING PROFILE..." : "EXECUTE_ →"}
                  </button>
                </form>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, filter: 'blur(10px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 1 }} className="space-y-12">
              <h1 className="text-6xl sm:text-7xl md:text-[6rem] font-bold tracking-tighter leading-[0.9] text-foreground uppercase max-w-5xl">
                {personalization.website_config?.hero?.intro}
              </h1>
              <div className="font-mono text-sm max-w-md uppercase tracking-widest text-muted-foreground border-l border-foreground/20 pl-6 py-2">
                <p className="mb-4">Session Active. Vector: {personalization.visitor_profile?.role}.</p>
                <button
                  onClick={() => {
                    localStorage.removeItem('user_profile_complete');
                    setPersonalization(null);
                  }}
                  className="text-[10px] bg-foreground/10 hover:bg-foreground/20 text-foreground px-3 py-1 transition-colors"
                >
                  [ RESET_SESSION ]
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {(loading || personalization) && (
          <section className="relative border-t border-foreground/10 pt-16">
            {personalization && (
              <div className="transition-all duration-500 opacity-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-16 gap-4">
                  <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Index: Production Systems</h2>

                  {allCloudTags.length > 0 && (
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="font-mono text-[10px] text-foreground/30 uppercase tracking-widest mr-2">Filter:</span>
                      {allCloudTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleFilter(tag)}
                          className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1 border transition-all ${activeFilters.includes(tag)
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-500'
                              : 'border-foreground/10 text-foreground/40 hover:border-foreground/30'
                            }`}
                        >
                          {tag}
                        </button>
                      ))}
                      {activeFilters.length > 0 && (
                        <span className="font-mono text-[10px] text-amber-500/60 uppercase tracking-widest ml-2">
                          [{filteredProjects.length} of {personalization?.website_config?.featured_projects?.length || portfolio?.projects?.length || 0} MATCHING]
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {filteredProjects.map((project: FeaturedProject, idx: number) => (
                    <Link
                      href={`/projects/${project.id}`}
                      key={project.id}
                      className={`group relative flex flex-col justify-between border border-foreground/10 p-8 hover:bg-white/[0.04] bg-white/[0.01] backdrop-blur-sm transition-all duration-300 cursor-crosshair ${idx === 0 ? 'lg:col-span-2' : ''}`}
                    >
                      <div className="flex flex-col mb-16">
                        <h3 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase mb-6">
                          {project.title}
                        </h3>
                        <p className="font-mono text-sm text-foreground uppercase tracking-widest max-w-xl leading-relaxed mb-4">
                          {project.highlight}
                        </p>
                        <div className="font-mono text-[10px] text-amber-500/80 uppercase tracking-widest max-w-xl leading-relaxed border-l-2 border-amber-500/30 pl-4">
                          <span className="text-muted-foreground block mb-1">STRATEGIC ALIGNMENT_</span>
                          {project.why_relevant}
                        </div>
                      </div>

                      <div className="flex items-end justify-between border-t border-foreground/10 pt-8 mt-auto">
                        <div>
                          <div className="font-mono text-xs uppercase tracking-widest text-foreground bg-amber-500/20 px-3 py-1 mb-2 w-fit">
                            [██████░░░] 80%
                          </div>
                          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground block group-hover:text-foreground transition-colors">
                            Click to Compile Architecture →
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="block text-4xl md:text-5xl font-bold tracking-tighter text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.2)] group-hover:text-amber-400 group-hover:drop-shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all">
                            {project.metric || '99.9%'}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-2 block">
                            Core Metric
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <AnimatePresence>
        {(loading || (error && thinkingSteps.length > 0)) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-lg w-full flex flex-col gap-4 shadow-2xl"
            >
              <ThinkingPanel
                steps={thinkingSteps}
                title={error ? "Pipeline Error" : "Pipeline active"}
                subtitle={error ? "Process interrupted." : "LangGraph agents running in sequence"}
                apiCalls={apiCalls}
                maxApiCalls={5}
                defaultCollapsed={false}
              />
              {error && (
                <div className="p-4 border border-red-500 bg-red-500/10 text-red-500 font-mono text-xs uppercase tracking-widest flex justify-between items-start gap-4 shadow-lg">
                  <div>
                    <span className="font-bold block mb-2">[BACKEND CAUGHT IN ERROR]</span>
                    {error}
                  </div>
                  <button
                    onClick={() => {
                      setError(null);
                      setThinkingSteps([]);
                    }}
                    className="px-3 py-1 bg-red-500 text-black hover:bg-red-400 transition-colors font-bold"
                  >
                    CLOSE
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
