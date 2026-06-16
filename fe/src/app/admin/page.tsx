'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { api } from '@/lib/api';
import type { RagPrompt, AdminConfig, AnalyticsDashboard } from '@/types';

export default function AdminDashboard() {
  const { personalization, setPersonalization } = usePortfolioStore();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Auth
  const { adminToken, setAdminToken } = usePortfolioStore();
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Config
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [isSaved, setIsSaved] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);

  // Token Config
  const [globalTokenLimit, setGlobalTokenLimit] = useState(50000);
  const [maxLinksToScrape, setMaxLinksToScrape] = useState(2);
  const [highBudget, setHighBudget] = useState(15000);
  const [mediumBudget, setMediumBudget] = useState(8000);
  const [lowBudget, setLowBudget] = useState(3000);

  // Prompts
  const [prompts, setPrompts] = useState<RagPrompt[]>([]);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    const cached = localStorage.getItem('user_profile_complete');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setPersonalization(parsed.personalization);
      } catch { /* ignore */ }
    }
  }, [setPersonalization]);

  // Load real data when authenticated
  const loadAdminData = useCallback(async (token: string) => {
    setConfigLoading(true);
    setAnalyticsLoading(true);

    try {
      const config = await api.getAdminConfig(token);
      setTimeoutMs(config.scraping_timeout_ms);
      setPrompts(config.rag_prompts || []);
    } catch (e) {
      console.warn('Failed to load admin config:', e);
    } finally {
      setConfigLoading(false);
    }

    try {
      const stats = await api.getAnalytics(token);
      setAnalytics(stats);
    } catch (e) {
      console.warn('Failed to load analytics:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminToken) {
      loadAdminData(adminToken);
    }
  }, [adminToken, loadAdminData]);

  if (!mounted) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      const resp = await api.adminAuth(passwordInput);
      setAdminToken(resp.token);
    } catch {
      setAuthError('ACCESS DENIED: Invalid passphrase or backend unreachable.');
      setPasswordInput('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;

    try {
      await api.updateAdminConfig(adminToken, {
        scraping_timeout_ms: timeoutMs,
        rag_prompts: prompts,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save config:', e);
      alert('Failed to save. Check backend connection.');
    }
  };

  const handleClearCache = async () => {
    if (!adminToken) return;
    try {
      const result = await api.clearCache(adminToken);
      alert(`Cleared ${result.cleared_count || 0} cached personalizations.`);
    } catch {
      alert('Failed to clear cache.');
    }
  };

  const clearSession = () => {
    localStorage.removeItem('user_profile_complete');
    setPersonalization(null);
    router.push('/');
  };

  const handleLogout = () => {
    setAdminToken(null);
  };

  const updatePrompt = (id: string, field: keyof RagPrompt, value: any) => {
    setPrompts(prev => prev.map(p =>
      p.id === id ? { ...p, [field]: value, updated_at: new Date().toISOString() } : p
    ));
  };

  if (!adminToken) {
    return (
      <div className="min-h-screen relative z-10 px-6 sm:px-12 md:px-24 pt-32 pb-24 flex flex-col items-center justify-center">
        <button
          onClick={() => router.push('/')}
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8 block absolute top-32 left-6 sm:left-12 md:left-24"
        >
          ← Return to Index
        </button>

        <form onSubmit={handleLogin} className="w-full max-w-md border border-red-900/50 bg-[#050505] p-8 md:p-12 shadow-[0_0_30px_rgba(220,38,38,0.1)]">
          <h1 className="font-mono text-xl text-red-500 uppercase tracking-widest mb-2 border-b border-red-900/50 pb-4">
            [ RESTRICTED AREA ]
          </h1>
          <p className="font-mono text-xs text-muted-foreground mb-8">
            Admin console requires authorization via backend JWT.
          </p>

          {authError && (
            <div className="text-red-500 font-mono text-xs mb-4 p-3 border border-red-900/50 bg-red-900/10">
              {authError}
            </div>
          )}

          <div className="flex flex-col gap-2 mb-8">
            <label className="text-[10px] text-foreground/50 font-mono uppercase tracking-widest">PASSPHRASE_</label>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="bg-transparent border-b border-foreground/20 py-2 focus:outline-none focus:border-red-500 font-mono text-foreground transition-colors"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="w-full bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/40 px-6 py-4 font-mono text-sm uppercase tracking-widest transition-colors"
          >
            AUTHORIZE ACCESS
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative z-10 px-6 sm:px-12 md:px-24 pt-32 pb-24 flex flex-col">
      <main className="flex-1 w-full max-w-[900px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/')}
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Return to Index
          </button>
          <button
            onClick={handleLogout}
            className="font-mono text-[10px] uppercase tracking-widest text-red-500 border border-red-900/30 px-3 py-1 hover:bg-red-900/20 transition-colors"
          >
            [ LOGOUT ]
          </button>
        </div>

        <div className="mb-16">
          <h1 className="text-5xl sm:text-6xl md:text-[5rem] font-bold tracking-tighter leading-[0.9] text-foreground uppercase max-w-4xl mb-4">
            Admin System
          </h1>
          <p className="font-mono text-sm uppercase tracking-widest text-amber-500">
            Override Controls & Agent Configuration
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-12">

          {/* Section 1: Session Management */}
          <div className="border border-foreground/10 bg-white/[0.01] backdrop-blur-sm p-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-b border-foreground/10 pb-2 mb-6">
              01 // Active Session Management
            </h2>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-foreground/5 border border-foreground/10">
              <div>
                <p className="text-foreground font-bold uppercase tracking-tighter text-xl">Current Identity Vector</p>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  {personalization ? `Active: ${personalization.visitor_profile?.role}` : 'No active session parameters found.'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearSession}
                  className="bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/40 px-4 py-3 font-mono text-xs uppercase tracking-widest transition-colors whitespace-nowrap"
                >
                  [ RESET SESSION ]
                </button>
                <button
                  type="button"
                  onClick={handleClearCache}
                  className="bg-amber-900/20 text-amber-500 border border-amber-900/50 hover:bg-amber-900/40 px-4 py-3 font-mono text-xs uppercase tracking-widest transition-colors whitespace-nowrap"
                >
                  [ CLEAR ALL CACHE ]
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Scraping Thresholds */}
          <div className="border border-foreground/10 bg-white/[0.01] backdrop-blur-sm p-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-b border-foreground/10 pb-2 mb-6">
              02 // Scraping Engine Thresholds
            </h2>
            <div className="space-y-6 p-6 bg-foreground/5 border border-foreground/10">
              <div className="flex flex-col gap-4">
                <label className="text-[10px] text-foreground/50 font-mono uppercase tracking-widest">
                  Playwright Fallback Timeout (ms) : [{timeoutMs}]
                </label>
                <input
                  type="range"
                  min="1000"
                  max="15000"
                  step="500"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Token Budget Configuration */}
          <div className="border border-foreground/10 bg-white/[0.01] backdrop-blur-sm p-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-b border-foreground/10 pb-2 mb-6">
              03 // Token Budget Configuration
            </h2>
            <div className="space-y-6 p-6 bg-foreground/5 border border-foreground/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-foreground/50 font-mono uppercase tracking-widest">GLOBAL_LLM_CALL_LIMIT_</label>
                  <input
                    type="number"
                    value={globalTokenLimit}
                    onChange={(e) => setGlobalTokenLimit(Number(e.target.value))}
                    className="bg-transparent border border-foreground/20 p-2 font-mono text-xs text-foreground focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-foreground/50 font-mono uppercase tracking-widest">MAX_LINKS_TO_SCRAPE_</label>
                  <input
                    type="number"
                    value={maxLinksToScrape}
                    onChange={(e) => setMaxLinksToScrape(Number(e.target.value))}
                    min={1}
                    max={5}
                    className="bg-transparent border border-foreground/20 p-2 font-mono text-xs text-foreground focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'HIGH_BUDGET_', value: highBudget, set: setHighBudget },
                  { label: 'MEDIUM_BUDGET_', value: mediumBudget, set: setMediumBudget },
                  { label: 'LOW_BUDGET_', value: lowBudget, set: setLowBudget },
                ].map(field => (
                  <div key={field.label} className="flex flex-col gap-2">
                    <label className="text-[10px] text-foreground/50 font-mono uppercase tracking-widest">{field.label}</label>
                    <input
                      type="number"
                      value={field.value}
                      onChange={(e) => field.set(Number(e.target.value))}
                      className="bg-transparent border border-foreground/20 p-2 font-mono text-xs text-foreground focus:outline-none focus:border-amber-500"
                    />
                  </div>
                ))}
              </div>
              <p className="font-mono text-[10px] text-foreground/30">
                Token budgets control how much scraped content is sent per LLM call. High = engineering/tech data. Low = basic company info.
              </p>
            </div>
          </div>

          {/* Section 4: RAG Prompt Templates */}
          <div className="border border-foreground/10 bg-white/[0.01] backdrop-blur-sm p-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-b border-foreground/10 pb-2 mb-6">
              04 // RAG Prompt Templates
            </h2>
            {configLoading ? (
              <div className="flex items-center gap-3 p-6 text-muted-foreground font-mono text-xs">
                <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                Loading from backend...
              </div>
            ) : (
              <div className="space-y-4">
                {prompts.map(prompt => (
                  <div key={prompt.id} className="border border-foreground/10 bg-foreground/5 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-foreground font-bold uppercase tracking-tighter">{prompt.name}</h3>
                        <p className="font-mono text-[10px] text-muted-foreground mt-1">{prompt.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPromptId(editingPromptId === prompt.id ? null : prompt.id)}
                        className="font-mono text-[10px] uppercase tracking-widest text-amber-500 border border-amber-500/30 px-3 py-1 hover:bg-amber-500/10 transition-colors"
                      >
                        {editingPromptId === prompt.id ? '[ CLOSE ]' : '[ EDIT ]'}
                      </button>
                    </div>

                    {editingPromptId === prompt.id && (
                      <div className="space-y-4 mt-4 pt-4 border-t border-foreground/10">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] text-foreground/50 font-mono uppercase tracking-widest">TEMPLATE_</label>
                          <textarea
                            value={prompt.template}
                            onChange={(e) => updatePrompt(prompt.id, 'template', e.target.value)}
                            rows={4}
                            className="bg-transparent border border-foreground/20 p-3 focus:outline-none focus:border-amber-500 font-mono text-xs text-foreground transition-colors resize-none"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] text-foreground/50 font-mono uppercase tracking-widest">MODEL_</label>
                            <select
                              value={prompt.model}
                              onChange={(e) => updatePrompt(prompt.id, 'model', e.target.value)}
                              className="bg-[#050505] border border-foreground/20 p-2 font-mono text-xs text-foreground focus:outline-none focus:border-amber-500"
                            >
                              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] text-foreground/50 font-mono uppercase tracking-widest">TEMP_ [{prompt.temperature}]</label>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={prompt.temperature}
                              onChange={(e) => updatePrompt(prompt.id, 'temperature', Number(e.target.value))}
                              className="w-full accent-amber-500"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] text-foreground/50 font-mono uppercase tracking-widest">MAX_TOKENS_</label>
                            <input
                              type="number"
                              value={prompt.max_tokens}
                              onChange={(e) => updatePrompt(prompt.id, 'max_tokens', Number(e.target.value))}
                              className="bg-transparent border border-foreground/20 p-2 font-mono text-xs text-foreground focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {prompts.length === 0 && (
                  <p className="font-mono text-xs text-muted-foreground p-6 border border-foreground/10">
                    No prompts loaded. Backend may be unavailable.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section 5: Analytics */}
          <div className="border border-foreground/10 bg-white/[0.01] backdrop-blur-sm p-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-b border-foreground/10 pb-2 mb-6">
              05 // Visitor Analytics
            </h2>
            {analyticsLoading ? (
              <div className="flex items-center gap-3 p-6 text-muted-foreground font-mono text-xs">
                <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                Loading analytics...
              </div>
            ) : analytics ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="border border-foreground/10 bg-foreground/5 p-4 text-center">
                    <span className="block text-3xl font-bold tracking-tighter text-amber-500">{analytics.total_visitors}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Total</span>
                  </div>
                  <div className="border border-foreground/10 bg-foreground/5 p-4 text-center">
                    <span className="block text-3xl font-bold tracking-tighter text-amber-500">{analytics.visitors_this_week}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">This Week</span>
                  </div>
                  {Object.entries(analytics.by_role).map(([role, count]) => (
                    <div key={role} className="border border-foreground/10 bg-foreground/5 p-4 text-center">
                      <span className="block text-2xl font-bold tracking-tighter text-foreground">{count}</span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{role}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-foreground/50 mb-3">Recent Visitors</h3>
                  {analytics.recent_visitors.map((v, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-foreground/5 border border-foreground/10 font-mono text-xs">
                      <span className="text-foreground">{v.email}</span>
                      <span className="text-amber-500 uppercase">{v.role}</span>
                      <span className="text-muted-foreground">{v.company}</span>
                    </div>
                  ))}
                  {analytics.recent_visitors.length === 0 && (
                    <p className="font-mono text-xs text-muted-foreground">No visitors yet.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="font-mono text-xs text-muted-foreground p-6">Analytics unavailable.</p>
            )}
          </div>

          {/* Section 6: Backend Health */}
          <div className="border border-foreground/10 bg-white/[0.01] backdrop-blur-sm p-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-b border-foreground/10 pb-2 mb-6">
              06 // Backend Health
            </h2>
            <div className="flex items-center gap-4 p-6 bg-foreground/5 border border-foreground/10">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
              <div>
                <p className="text-foreground font-bold uppercase tracking-tighter">System Online</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-1">
                  JWT authenticated | Session TTL: 5 days
                </p>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-foreground/10 flex items-center gap-6">
            <button
              type="submit"
              className="bg-foreground text-background px-8 py-4 font-bold uppercase tracking-widest hover:bg-amber-500 transition-colors"
            >
              DEPLOY CONFIGURATION_
            </button>
            {isSaved && (
              <span className="font-mono text-amber-500 text-xs uppercase tracking-widest animate-pulse">
                Configuration saved to backend
              </span>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
