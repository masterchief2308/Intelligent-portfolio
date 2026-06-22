'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { api } from '@/lib/api';
import { applyStepEvent } from '@/lib/thinkingSteps';
import ThinkingPanel, { type ThinkingStep } from '@/components/ThinkingPanel';
import type { CandidateMatch, JDMatchResponse, ResumePoolStats } from '@/types';

export default function RecruiterPage() {
  const router = useRouter();

  // ── Pool state ────────────────────────────────────────────────
  const [poolStats, setPoolStats] = useState<ResumePoolStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // ── Match state ───────────────────────────────────────────────
  const [jdText, setJdText] = useState('');
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [matchResult, setMatchResult] = useState<JDMatchResponse | null>(null);

  // ── Load pool stats on mount ──────────────────────────────────
  const refreshPool = useCallback(async () => {
    try {
      const stats = await api.getResumePool();
      setPoolStats(stats);
    } catch {
      setPoolStats({ count: 0, filenames: [], candidates: [], ttl_hours: 24 });
    }
  }, []);

  useEffect(() => {
    refreshPool();
  }, [refreshPool]);

  // ── File drop ─────────────────────────────────────────────────
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles((prev) => [...prev, ...acceptedFiles]);
    setUploadError('');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 10 * 1024 * 1024,
  });

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Upload ────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setUploadError('');
    try {
      const result = await api.uploadResumes(selectedFiles);
      if (result.failed.length > 0) {
        setUploadError(`Failed: ${result.failed.join(', ')}`);
      }
      if (result.warnings.length > 0) {
        setUploadError((prev) => prev ? `${prev} | ${result.warnings.join(', ')}` : result.warnings.join(', '));
      }
      setSelectedFiles([]);
      await refreshPool();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // ── Clear pool ────────────────────────────────────────────────
  const handleClearPool = async () => {
    try {
      await api.clearResumePool();
      await refreshPool();
      setMatchResult(null);
    } catch (err: any) {
      setUploadError(err.message || 'Clear failed.');
    }
  };

  // ── Match JD ──────────────────────────────────────────────────
  const handleMatch = async () => {
    if (!jdText.trim()) return;
    setMatching(true);
    setMatchError('');
    setThinkingSteps([]);
    setMatchResult(null);

    try {
      const data = await api.matchJDStream(jdText, (event) => {
        if (event.type === 'step') {
          setThinkingSteps((prev) =>
            applyStepEvent(prev, event as Parameters<typeof applyStepEvent>[1])
          );
        }
      });
      setMatchResult(data);
    } catch (err: any) {
      setMatchError(err.message || 'Matching failed.');
    } finally {
      setMatching(false);
      setThinkingSteps([]);
    }
  };

  // ── Score color helper ────────────────────────────────────────
  const scoreColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
    if (score >= 0.6) return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
    if (score >= 0.4) return 'text-orange-400 border-orange-400/30 bg-orange-400/10';
    return 'text-red-400 border-red-400/30 bg-red-400/10';
  };

  const scoreBar = (score: number) => {
    if (score >= 0.8) return 'bg-emerald-500';
    if (score >= 0.6) return 'bg-amber-500';
    if (score >= 0.4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen relative z-10 px-6 sm:px-12 md:px-24 pt-32 pb-24 flex flex-col">
      <main className="flex-1 w-full max-w-[1400px] mx-auto">
        {/* Header */}
        <button
          onClick={() => router.push('/explore')}
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8 block"
        >
          ← Return to Explore
        </button>

        <div className="mb-16">
          <h1 className="text-5xl sm:text-6xl md:text-[5rem] font-bold tracking-tighter leading-[0.9] text-foreground uppercase max-w-4xl mb-4">
            Recruiter<br />
            <span className="text-amber-500">Match_</span>
          </h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
            Upload candidate resumes → Paste JD → Find best matches
          </p>
        </div>

        {/* TTL Warning Banner */}
        {poolStats && poolStats.count > 0 && (
          <div className="mb-8 p-4 border border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-amber-500 text-lg">⏱</span>
              <p className="font-mono text-xs text-amber-500/80 uppercase tracking-widest">
                Resumes auto-purge after {poolStats.ttl_hours}h for privacy
              </p>
            </div>
            <span className="font-mono text-[10px] text-foreground/40">
              {poolStats.count} chunks stored
            </span>
          </div>
        )}

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── LEFT PANEL: Resume Pool ─────────────────────────── */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                [ Resume Pool ]
              </h2>
              {poolStats && poolStats.count > 0 && (
                <span className="font-mono text-xs text-amber-500">
                  {poolStats.filenames.length} resumes loaded
                </span>
              )}
            </div>

            {/* Drop zone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300
                ${isDragActive
                  ? 'border-amber-500 bg-amber-500/10 scale-[1.01]'
                  : 'border-foreground/20 hover:border-amber-500/50 hover:bg-white/[0.02]'
                }
              `}
            >
              <input {...getInputProps()} />
              <div className="w-12 h-12 mx-auto border border-foreground/20 rounded-full flex items-center justify-center mb-4">
                <span className="text-xl">📄</span>
              </div>
              <p className="font-mono text-sm uppercase tracking-widest mb-2">
                {isDragActive ? 'Drop Resumes Here' : 'Drag & Drop Resumes'}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                PDF, TXT, DOCX — Max 10MB each — Multiple files allowed
              </p>
            </div>

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <div className="border border-foreground/10 bg-white/[0.01] divide-y divide-foreground/5">
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-widest text-amber-500">
                    {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                  </span>
                </div>
                {selectedFiles.map((file, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-foreground/30 font-mono text-xs">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="font-mono text-xs truncate">{file.name}</span>
                      <span className="font-mono text-[10px] text-foreground/30">
                        {(file.size / 1024).toFixed(0)}KB
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="font-mono text-xs text-red-500/50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploading}
              className={`w-full py-4 font-bold uppercase tracking-widest transition-all duration-300
                ${selectedFiles.length === 0 || uploading
                  ? 'bg-foreground/10 text-foreground/30 cursor-not-allowed'
                  : 'bg-foreground text-background hover:bg-amber-500 hover:scale-[1.01] active:scale-[0.99]'
                }
              `}
            >
              {uploading ? 'UPLOADING...' : `UPLOAD ${selectedFiles.length} RESUME${selectedFiles.length !== 1 ? 'S' : ''}_`}
            </button>

            {uploadError && (
              <div className="p-4 border border-red-900/50 bg-red-900/10 text-red-500 font-mono text-xs">
                {uploadError}
              </div>
            )}

            {/* Pool status */}
            {poolStats && poolStats.filenames.length > 0 && (
              <div className="border border-foreground/10 bg-white/[0.01]">
                <div className="px-4 py-3 border-b border-foreground/5 flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Loaded Resumes
                  </span>
                  <button
                    onClick={handleClearPool}
                    className="font-mono text-[10px] uppercase tracking-widest text-red-500/60 hover:text-red-500 transition-colors"
                  >
                    [ Clear All ]
                  </button>
                </div>
                <div className="divide-y divide-foreground/5 max-h-[300px] overflow-y-auto">
                  {poolStats.filenames.map((fname, i) => (
                    <div key={i} className="px-4 py-2 flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
                      <span className="font-mono text-xs text-foreground/70 truncate">{fname}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL: JD Matcher ────────────────────────── */}
          <div className="space-y-6">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              [ Job Description Matcher ]
            </h2>

            {!matchResult ? (
              <div className="space-y-6">
                {/* JD textarea */}
                <div className="relative">
                  <textarea
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="Paste the job description here..."
                    rows={14}
                    className="w-full bg-white/[0.02] border border-foreground/20 p-4 font-mono text-sm text-foreground placeholder:text-foreground/20 resize-none focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                  {jdText.length > 0 && (
                    <span className="absolute bottom-3 right-3 font-mono text-[10px] text-foreground/20">
                      {jdText.length} chars
                    </span>
                  )}
                </div>

                {/* Thinking panel */}
                {matching && thinkingSteps.length > 0 && (
                  <ThinkingPanel
                    steps={thinkingSteps}
                    title="Candidate matching"
                    subtitle="Search → rank → score"
                    defaultCollapsed={false}
                  />
                )}

                {matchError && (
                  <div className="p-4 border border-red-900/50 bg-red-900/10 text-red-500 font-mono text-xs">
                    {matchError}
                  </div>
                )}

                {/* Match button */}
                <button
                  onClick={handleMatch}
                  disabled={!jdText.trim() || matching || !poolStats || poolStats.count === 0}
                  className={`w-full py-4 font-bold uppercase tracking-widest transition-all duration-300
                    ${!jdText.trim() || matching || !poolStats || poolStats.count === 0
                      ? 'bg-foreground/10 text-foreground/30 cursor-not-allowed'
                      : 'bg-foreground text-background hover:bg-amber-500 hover:scale-[1.01] active:scale-[0.99]'
                    }
                  `}
                >
                  {matching
                    ? 'MATCHING...'
                    : poolStats && poolStats.count === 0
                      ? 'UPLOAD RESUMES FIRST'
                      : 'FIND BEST CANDIDATES_'
                  }
                </button>

                {poolStats && poolStats.count === 0 && (
                  <p className="font-mono text-xs text-center text-foreground/30">
                    ← Upload resumes to the pool first
                  </p>
                )}
              </div>
            ) : (
              /* ── Match Results ──────────────────────────────── */
              <div className="space-y-8">
                {/* Summary card */}
                <div className="border border-foreground/10 bg-white/[0.01] p-6">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
                    Match Summary
                  </h3>
                  <p className="font-mono text-sm text-foreground leading-relaxed">
                    {matchResult.summary}
                  </p>
                </div>

                {/* JD Skills */}
                {matchResult.jd_skills_extracted.length > 0 && (
                  <div className="border border-foreground/10 bg-white/[0.01] p-6">
                    <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
                      JD Skills Extracted
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {matchResult.jd_skills_extracted.map((skill, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-foreground/5 border border-foreground/10 font-mono text-xs"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Candidate cards */}
                <div className="space-y-4">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Ranked Candidates ({matchResult.matches.length})
                  </h3>
                  {matchResult.matches.map((candidate: CandidateMatch, i: number) => (
                    <div
                      key={i}
                      className="border border-foreground/10 bg-foreground/[0.02] p-6 hover:border-foreground/20 transition-all duration-300"
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-mono text-foreground/20 text-xs">
                              #{String(i + 1).padStart(2, '0')}
                            </span>
                            <h4 className="font-bold text-lg tracking-tight">
                              {candidate.candidate_name}
                            </h4>
                          </div>
                          <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">
                            {candidate.filename}
                          </p>
                        </div>
                        <span
                          className={`font-mono text-sm font-bold border px-3 py-1 ${scoreColor(candidate.relevancy_score)}`}
                        >
                          {Math.round(candidate.relevancy_score * 100)}%
                        </span>
                      </div>

                      {/* Score bar */}
                      <div className="h-1 w-full bg-foreground/5 mb-4">
                        <div
                          className={`h-full transition-all duration-700 ${scoreBar(candidate.relevancy_score)}`}
                          style={{ width: `${Math.round(candidate.relevancy_score * 100)}%` }}
                        />
                      </div>

                      {/* Explanation */}
                      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                        {candidate.explanation}
                      </p>

                      {/* Matching skills */}
                      {candidate.matching_skills.length > 0 && (
                        <div className="mb-3">
                          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-500/60 mb-2">
                            Matching Skills
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {candidate.matching_skills.map((skill, j) => (
                              <span
                                key={j}
                                className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-mono"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Missing skills */}
                      {candidate.missing_skills.length > 0 && (
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-red-500/60 mb-2">
                            Missing Skills
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {candidate.missing_skills.map((skill, j) => (
                              <span
                                key={j}
                                className="text-xs text-red-400/70 bg-red-500/10 border border-red-500/20 px-2 py-0.5 font-mono"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Reset button */}
                <button
                  onClick={() => setMatchResult(null)}
                  className="w-full py-4 border border-foreground/20 font-bold uppercase tracking-widest hover:bg-foreground/5 transition-all duration-300"
                >
                  [ NEW MATCH ]
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
