'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import SessionGate from '@/components/SessionGate';

const TOOLS = [
  {
    id: 'topology',
    href: '/explore/topology',
    badge: '01',
    title: 'Skill Topology',
    subtitle: 'Interactive project ↔ tech graph',
    description: 'Pan and click nodes to isolate how portfolio projects connect to skills and stacks.',
    requiresSession: true,
  },
  {
    id: 'portfolio-resume',
    href: '/explore/resume',
    badge: '02',
    title: 'Portfolio Resume Match',
    subtitle: 'Your CV vs Aditya\'s projects',
    description: 'Upload your resume (PDF/TXT). Scores alignment against Aditya\'s portfolio — not other candidates.',
    requiresSession: false,
    highlight: 'amber',
  },
  {
    id: 'jd-recruiter',
    href: '/explore/recruiter',
    badge: '03',
    title: 'JD Candidate Match',
    subtitle: 'Recruiter: many resumes + one JD',
    description: 'Upload multiple candidate resumes, paste a job description, and rank who fits best for that role.',
    requiresSession: false,
    highlight: 'amber',
  },
] as const;

export default function ExploreHubPage() {
  const router = useRouter();
  const { mounted, personalization } = useHydrateSession();

  if (!mounted) return null;

  if (!personalization) {
    return <SessionGate title="Explore requires a session" />;
  }

  return (
    <div className="min-h-[100dvh] relative z-10 px-6 sm:px-12 md:px-24 pt-24 sm:pt-28 pb-16">
      <main className="max-w-[1100px] mx-auto">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8 block"
        >
          ← Return to Index
        </button>

        <header className="mb-12 sm:mb-16">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-500 mb-3">Interactive Explore</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter uppercase leading-[0.95] mb-4">
            Tools &<br />
            <span className="text-muted-foreground">Matchers</span>
          </h1>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest max-w-xl leading-relaxed">
            Two different resume flows — pick the one that matches your goal.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TOOLS.map((tool) => {
            const locked = tool.requiresSession && !personalization;
            if (locked) {
              return (
                <div
                  key={tool.id}
                  className="flex flex-col border border-foreground/15 bg-white/[0.02] p-6 opacity-40 min-h-[220px]"
                >
                  <span className="font-mono text-[10px] text-foreground/30 mb-4">[{tool.badge}]</span>
                  <h2 className="text-xl font-bold uppercase tracking-tight mb-1">{tool.title}</h2>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-amber-500/80 mb-3">{tool.subtitle}</p>
                  <p className="font-mono text-[11px] text-muted-foreground leading-relaxed normal-case tracking-normal flex-1">
                    {tool.description}
                  </p>
                </div>
              );
            }
            return (
              <Link
                key={tool.id}
                href={tool.href}
                className="group flex flex-col border border-foreground/15 bg-white/[0.02] p-6 hover:bg-white/[0.05] hover:border-amber-500/40 transition-all duration-300 min-h-[220px] cursor-pointer"
              >
                <span className="font-mono text-[10px] text-foreground/30 mb-4">[{tool.badge}]</span>
                <h2 className="text-xl font-bold uppercase tracking-tight mb-1 group-hover:text-amber-500 transition-colors">
                  {tool.title}
                </h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-amber-500/80 mb-3">
                  {tool.subtitle}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground leading-relaxed normal-case tracking-normal flex-1">
                  {tool.description}
                </p>
                <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 group-hover:text-amber-500 mt-4 transition-colors">
                  Open →
                </span>
              </Link>
            );
          })}
        </div>

        <section className="mt-12 border border-dashed border-foreground/15 p-6 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/40">Which matcher should I use?</p>
          <ul className="font-mono text-xs text-muted-foreground space-y-2 normal-case tracking-normal leading-relaxed">
            <li>
              <strong className="text-foreground">Portfolio Resume Match</strong> — You are a candidate or visitor comparing{' '}
              <em>your</em> resume to Aditya&apos;s project work.
            </li>
            <li>
              <strong className="text-foreground">JD Candidate Match</strong> — You are a recruiter with{' '}
              <em>several candidate CVs</em> and a job description; find the best fit.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
