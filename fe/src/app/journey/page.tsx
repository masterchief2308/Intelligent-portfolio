'use client';

import { useHydrateSession } from '@/hooks/useHydrateSession';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import SessionGate from '@/components/SessionGate';
import { useRouter } from 'next/navigation';

export default function JourneyPage() {
  const { mounted, personalization } = useHydrateSession();
  const { data: portfolio, isError, error } = usePortfolioData();
  const router = useRouter();

  if (!mounted) return null;
  
  if (isError) {
    return (
      <div className="min-h-screen pt-32 px-6 sm:px-12 md:px-24 flex items-center justify-center font-mono">
        <div className="p-6 border border-red-500 bg-red-500/10 text-red-500 max-w-2xl">
          <p className="uppercase tracking-widest font-bold mb-4">[BACKEND CAUGHT IN ERROR]</p>
          <p className="text-sm">{(error as Error)?.message || "Failed to load data"}</p>
        </div>
      </div>
    );
  }

  if (!personalization) {
    return <SessionGate title="Journey requires a session" />;
  }

  const experience = portfolio?.experience || [];
  const education = portfolio?.education || [];

  const generatedTimeline = personalization?.website_config?.timeline;
  let timeline = [];

  if (generatedTimeline && generatedTimeline.length > 0) {
    // Primary Path: Use 100% LLM generated timeline
    timeline = generatedTimeline;
  } else {
    // Fallback Path: Use static portfolio.json
    timeline = [
      ...(experience?.map(exp => ({
        ...exp,
        type: 'experience' as const,
        relevance: undefined
      })) || []),
      ...(education?.map(edu => ({
        company: edu.institution,
        role: edu.degree,
        startDate: edu.startDate,
        endDate: edu.endDate,
        highlights: [edu.cgpa],
        type: 'education' as const,
        relevance: undefined
      })) || [])
    ];
  }

  return (
    <div className="min-h-screen relative z-10 px-6 sm:px-12 md:px-24 pt-32 pb-24 flex flex-col">
      <main className="flex-1 w-full max-w-[1000px] mx-auto">
        <button
          onClick={() => router.push('/')}
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8 block"
        >
          ← Return to Index
        </button>

        <div className="mb-16">
          <h1 className="text-5xl sm:text-6xl md:text-[5rem] font-bold tracking-tighter leading-[0.9] text-foreground uppercase max-w-4xl">
            Timeline / Journey
          </h1>
        </div>

        <div className="relative border-l border-foreground/20 ml-4 md:ml-8 pl-8 md:pl-16 space-y-24">
          {timeline.map((item, idx) => (
            <div key={idx} className="relative group">
              <div className="absolute -left-[37px] md:-left-[69px] top-2 w-3 h-3 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)] group-hover:scale-150 transition-transform" />

              <div className="flex flex-col md:flex-row gap-4 md:gap-12 md:items-baseline mb-6">
                <div className="font-mono text-xs uppercase tracking-widest text-amber-500 min-w-[120px]">
                  {item.startDate} — {item.endDate}
                </div>
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tighter uppercase text-foreground">{item.role}</h2>
                  <h3 className="font-mono text-sm uppercase tracking-widest text-muted-foreground mt-2">
                    {item.company} {item.type === 'experience' && 'location' in item ? `| ${(item as any).location}` : ''}
                  </h3>
                </div>
              </div>

              <div className="md:ml-[168px] border border-foreground/10 bg-white/[0.01] backdrop-blur-sm p-6 hover:bg-white/[0.04] transition-colors">
                {item.relevance && (
                  <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-sm">
                    <p className="text-amber-500 font-mono text-sm tracking-wide leading-relaxed">
                      <span className="font-bold uppercase">Why this matters to you:</span> {item.relevance}
                    </p>
                  </div>
                )}
                <ul className="space-y-4">
                  {item.highlights?.map((highlight, hIdx) => (
                    <li key={hIdx} className="flex gap-4 items-start">
                      <span className="font-mono text-foreground/40 mt-1">/</span>
                      <p className="text-sm md:text-base text-foreground font-light leading-relaxed">{highlight}</p>
                    </li>
                  ))}
                </ul>

                {item.type === 'experience' && (portfolio?.projects?.filter(p => p.company === item.company)?.length ?? 0) > 0 && (
                  <div className="mt-8 border-t border-foreground/10 pt-6">
                    <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Projects Built Here</h4>
                    <div className="grid gap-4">
                      {portfolio?.projects?.filter(p => p.company === item.company).map(p => (
                        <div key={p.id} className="p-4 border border-foreground/10 bg-black/20 hover:border-amber-500/30 transition-colors cursor-pointer" onClick={() => router.push(`/projects/${p.id}`)}>
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <h5 className="font-bold text-foreground">{p.title}</h5>
                            <span className="font-mono text-[10px] uppercase text-amber-500 border border-amber-500/30 px-2 py-0.5 whitespace-nowrap">{p.metric}</span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{p.context}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
