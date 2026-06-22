'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { api } from '@/lib/api';
import { applyStepEvent } from '@/lib/thinkingSteps';
import ThinkingPanel, { type ThinkingStep } from '@/components/ThinkingPanel';
import { usePortfolioStore } from '@/store/usePortfolioStore';

export default function ResumeComparePage() {
  const router = useRouter();
  const setIsStreamingLLM = usePortfolioStore((state) => state.setIsStreamingLLM);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt']
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024 // 5MB
  });

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setIsStreamingLLM(true);
    setError('');
    setThinkingSteps([]);

    try {
      const data = await api.compareResumeStream(file, (event) => {
        if (event.type === 'step') {
          setThinkingSteps((prev) => applyStepEvent(prev, event as Parameters<typeof applyStepEvent>[1]));
        }
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred during comparison.');
    } finally {
      setLoading(false);
      setIsStreamingLLM(false);
      setThinkingSteps([]);
    }
  };

  return (
    <div className="min-h-screen relative z-10 px-6 sm:px-12 md:px-24 pt-32 pb-24 flex flex-col">
      <main className="flex-1 w-full max-w-[900px] mx-auto">
        <button
          onClick={() => router.push('/explore')}
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8 block"
        >
          ← Return to Explore
        </button>

        <div className="mb-16">
          <h1 className="text-5xl sm:text-6xl md:text-[5rem] font-bold tracking-tighter leading-[0.9] text-foreground uppercase max-w-4xl mb-4">
            Resume Matcher
          </h1>
          <p className="font-mono text-sm uppercase tracking-widest text-amber-500">
            Compare your experience against the portfolio
          </p>
        </div>

        {!result ? (
          <div className="space-y-8">
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed p-12 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-amber-500 bg-amber-500/10' : 'border-foreground/20 hover:border-amber-500/50 hover:bg-white/[0.02]'}
              `}
            >
              <input {...getInputProps()} />
              {file ? (
                <div>
                  <p className="font-mono text-amber-500 mb-2">[ FILE SELECTED ]</p>
                  <p className="font-bold text-lg">{file.name}</p>
                  <p className="font-mono text-xs text-muted-foreground mt-2">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <div className="w-12 h-12 mx-auto border border-foreground/20 rounded-full flex items-center justify-center mb-4">
                    <span className="text-xl">📄</span>
                  </div>
                  <p className="font-mono text-sm uppercase tracking-widest mb-2">Drag & Drop Resume</p>
                  <p className="font-mono text-xs text-muted-foreground">Supported formats: PDF, TXT (Max 5MB)</p>
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 border border-red-900/50 bg-red-900/10 text-red-500 font-mono text-xs">
                {error}
              </div>
            )}

            {loading && thinkingSteps.length > 0 && (
              <ThinkingPanel
                steps={thinkingSteps}
                title="Resume analysis"
                subtitle="Extract → search → score"
                defaultCollapsed={false}
              />
            )}

            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className={`w-full py-4 font-bold uppercase tracking-widest transition-colors
                ${!file || loading 
                  ? 'bg-foreground/10 text-foreground/30 cursor-not-allowed' 
                  : 'bg-foreground text-background hover:bg-amber-500'}
              `}
            >
              {loading ? 'ANALYZING...' : 'RUN COMPARISON_'}
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            <div className="border border-foreground/10 bg-white/[0.01] p-8 text-center">
              <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Overall Match Score</h2>
              <div className="text-7xl font-bold tracking-tighter text-amber-500 mb-4">
                {Math.round(result.overall_score * 100)}%
              </div>
              <p className="font-mono text-sm text-foreground max-w-2xl mx-auto leading-relaxed">
                {result.summary}
              </p>
            </div>

            {result.extracted_skills?.length > 0 && (
              <div className="border border-foreground/10 bg-white/[0.01] p-8">
                <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-6">Extracted Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {result.extracted_skills.map((skill: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-foreground/5 border border-foreground/10 font-mono text-xs">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Project Matches</h2>
              {result.matches.map((match: any, i: number) => (
                <div key={i} className="border border-foreground/10 bg-foreground/5 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-xl">{match.project_title}</h3>
                    <span className="font-mono text-amber-500 border border-amber-500/30 px-2 py-1">
                      {Math.round(match.relevancy_score * 100)}% Match
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    {match.explanation}
                  </p>
                  
                  {match.matching_skills?.length > 0 && (
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/50 mb-2">Overlapping Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {match.matching_skills.map((skill: string, j: number) => (
                          <span key={j} className="text-xs text-amber-500 bg-amber-500/10 px-2 py-1">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => { setResult(null); setFile(null); }}
              className="w-full py-4 border border-foreground/20 font-bold uppercase tracking-widest hover:bg-foreground/5 transition-colors"
            >
              [ COMPARE ANOTHER RESUME ]
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
