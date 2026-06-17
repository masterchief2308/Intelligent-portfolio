'use client';

import { useHydrateSession } from '@/hooks/useHydrateSession';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function JourneyPage() {
  const { mounted, personalization } = useHydrateSession();
  const { data: portfolio, isError, error } = usePortfolioData();
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);

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
    return (
      <div className="min-h-screen pt-32 px-6 sm:px-12 md:px-24 flex items-center justify-center font-mono">
        <p className="text-muted-foreground uppercase tracking-widest">[ERR] Session unauthorized. Return to Index.</p>
      </div>
    );
  }

  const experience = portfolio?.experience || [];
  const education = portfolio?.education || [];

  const timeline = [
    ...(experience?.map(exp => ({ ...exp, type: 'experience' as const })) || []),
    ...(education?.map(edu => ({
      company: edu.institution,
      role: edu.degree,
      startDate: edu.startDate,
      endDate: edu.endDate,
      highlights: [edu.cgpa],
      type: 'education' as const
    })) || [])
  ];

  const handleDownload = () => {
    setDownloading(true);
    // The backend /api/resume/pdf sends Content-Disposition: attachment
    // Navigating directly to it forces a download.
    window.location.href = api.getResumePdf();
    setTimeout(() => setDownloading(false), 2000);
  };

  return (
    <div className="min-h-screen relative z-10 px-6 sm:px-12 md:px-24 pt-32 pb-24 flex flex-col">
      <main className="flex-1 w-full max-w-[1000px] mx-auto">
        <button
          onClick={() => router.push('/')}
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8 block"
        >
          ← Return to Index
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <h1 className="text-5xl sm:text-6xl md:text-[5rem] font-bold tracking-tighter leading-[0.9] text-foreground uppercase max-w-4xl">
            Timeline / Journey
          </h1>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="font-mono text-xs uppercase tracking-widest border border-amber-500/50 text-amber-500 px-6 py-3 hover:bg-amber-500/10 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {downloading ? 'DOWNLOADING...' : '↓ DOWNLOAD RESUME'}
          </button>
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
                <ul className="space-y-4">
                  {item.highlights?.map((highlight, hIdx) => (
                    <li key={hIdx} className="flex gap-4 items-start">
                      <span className="font-mono text-foreground/40 mt-1">/</span>
                      <p className="text-sm md:text-base text-foreground font-light leading-relaxed">{highlight}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
