'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import type { RagPrompt, AdminConfig, AnalyticsDashboard } from '@/types';

const MOCK_PROMPTS: RagPrompt[] = [
  { id: 'recruiter_personalization', name: 'Recruiter Personalization', template: 'You are personalizing a portfolio for a recruiter at {company}. Based on their LinkedIn profile: {linkedin_data}. Highlight projects relevant to their open roles: {hiring_for}.', model: 'gemini-2.5-flash', temperature: 0.7, max_tokens: 1024, description: 'Generates personalized landing page content for recruiters', updated_at: new Date().toISOString() },
  { id: 'engineer_personalization', name: 'Engineer Personalization', template: 'You are personalizing a portfolio for a fellow engineer. Focus on technical depth, architecture decisions, and code-level details.', model: 'gemini-2.5-flash', temperature: 0.5, max_tokens: 1024, description: 'Generates tech-focused content for visiting engineers', updated_at: new Date().toISOString() },
  { id: 'manager_personalization', name: 'Manager Personalization', template: 'You are personalizing for an engineering manager. Highlight ROI, cost savings, team leadership, and business impact metrics.', model: 'gemini-2.5-flash', temperature: 0.6, max_tokens: 1024, description: 'Generates impact-focused content for managers', updated_at: new Date().toISOString() },
  { id: 'chat_response', name: 'Chat Response', template: 'You are Aditya\'s portfolio assistant. Answer the visitor\'s question using the following retrieved context: {rag_context}. Be concise, technical, and direct.', model: 'gemini-2.5-flash', temperature: 0.3, max_tokens: 512, description: 'Powers the chat-with-portfolio RAG interface', updated_at: new Date().toISOString() },
  { id: 'project_summary', name: 'Project Summary Generator', template: 'Generate a concise system context and architectural implementation summary for project: {project_title}. Include cloud services, ML models, and data flow.', model: 'gemini-2.5-flash', temperature: 0.4, max_tokens: 768, description: 'Auto-generates project context fields', updated_at: new Date().toISOString() },
];

const MOCK_ANALYTICS: AnalyticsDashboard = {
  total_visitors: 142,
  visitors_this_week: 23,
  by_role: { hiring: 67, engineer: 45, manager: 18, other: 12 },
  recent_visitors: [
    { email: 'recruiter@google.com', role: 'hiring', company: 'Google', timestamp: '2026-06-15T18:10:00Z' },
    { email: 'dev@meta.com', role: 'engineer', company: 'Meta', timestamp: '2026-06-15T16:30:00Z' },
    { email: 'mgr@amazon.com', role: 'manager', company: 'Amazon', timestamp: '2026-06-15T14:00:00Z' },
  ],
  top_projects_viewed: [
    { slug: 'iocl-tender-evaluation', views: 89 },
    { slug: 'km-tech-int-forensics', views: 34 },
    { slug: 'azolla-casper', views: 19 },
  ],
};

export default function AdminDashboard() {
  const { personalization, setPersonalization } = usePortfolioStore();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [openaiKey, setOpenaiKey] = useState('');
  const [langchainKey, setLangchainKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const [prompts, setPrompts] = useState<RagPrompt[]>(MOCK_PROMPTS);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [analytics] = useState<AnalyticsDashboard>(MOCK_ANALYTICS);

  useEffect(() => {
    setMounted(true);
    const cached = localStorage.getItem('user_profile_complete');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setPersonalization(parsed.personalization);
      } catch { /* ignore */ }
    }
    if (sessionStorage.getItem('admin_auth')) {
      setIsAuthenticated(true);
    }
  }, [setPersonalization]);

  if (!mounted) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'admin2026') {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_auth', 'true');
    } else {
      alert('ACCESS DENIED: Incorrect Passphrase');
      setPasswordInput('');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const clearSession = () => {
    localStorage.removeItem('user_profile_complete');
    setPersonalization(null);
    router.push('/');
  };

  const updatePrompt = (id: string, field: keyof RagPrompt, value: any) => {
    setPrompts(prev => prev.map(p =>
      p.id === id ? { ...p, [field]: value, updated_at: new Date().toISOString() } : p
    ));
  };

  if (!isAuthenticated) {
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
            Admin console requires authorization passphrase.
          </p>

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
        <button
          onClick={() => router.push('/')}
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8 block"
        >
          ← Return to Index
        </button>

        <div className="mb-16">
          <h1 className="text-5xl sm:text-6xl md:text-[5rem] font-bold tracking-tighter leading-[0.9] text-foreground uppercase max-w-4xl mb-4">
            Admin System
          </h1>
          <p className="font-mono text-sm uppercase tracking-widest text-amber-500">
            Override Controls & Agent Configuration
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-12">

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
              <button
                type="button"
                onClick={clearSession}
                className="bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/40 px-6 py-3 font-mono text-xs uppercase tracking-widest transition-colors whitespace-nowrap"
              >
                [ TERMINATE CACHE ]
              </button>
            </div>
          </div>

          <div className="border border-foreground/10 bg-white/[0.01] backdrop-blur-sm p-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-b border-foreground/10 pb-2 mb-6">
              02 // Scraping Engine Thresholds
            </h2>
            <div className="space-y-6 p-6 bg-foreground/5 border border-foreground/10">
              <div className="flex flex-col gap-4">
                <label className="text-[10px] text-foreground/50 font-mono uppercase tracking-widest">
                  LangGraph Fallback Timeout (ms) : [{timeoutMs}]
                </label>
                <input
                  type="range"
                  min="1000"
                  max="10000"
                  step="500"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                  If the Playwright agent fails to scrape within {timeoutMs}ms, Graceful Degradation serves static fallback content.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-foreground/10 bg-white/[0.01] backdrop-blur-sm p-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-b border-foreground/10 pb-2 mb-6">
              03 // Environment Variables
            </h2>
            <div className="space-y-6 p-6 bg-foreground/5 border border-foreground/10">
              {[
                { label: 'OPENAI_API_KEY_', value: openaiKey, set: setOpenaiKey, placeholder: 'sk-...' },
                { label: 'LANGCHAIN_API_KEY_', value: langchainKey, set: setLangchainKey, placeholder: 'ls__...' },
                { label: 'GEMINI_API_KEY_', value: geminiKey, set: setGeminiKey, placeholder: 'AIza...' },
              ].map(field => (
                <div key={field.label} className="flex flex-col gap-2">
                  <label className="text-[10px] text-foreground/50 font-mono uppercase tracking-widest">{field.label}</label>
                  <input
                    type="password"
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                    placeholder={field.placeholder}
                    className="bg-transparent border-b border-foreground/20 py-2 focus:outline-none focus:border-amber-500 font-mono text-foreground placeholder:text-foreground/20 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border border-foreground/10 bg-white/[0.01] backdrop-blur-sm p-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-b border-foreground/10 pb-2 mb-6">
              04 // RAG Prompt Templates
            </h2>
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
                            <option value="gpt-4o">GPT-4o</option>
                            <option value="claude-opus-4">Claude Opus 4</option>
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
                      <p className="font-mono text-[10px] text-foreground/30">
                        Last updated: {new Date(prompt.updated_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border border-foreground/10 bg-white/[0.01] backdrop-blur-sm p-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-b border-foreground/10 pb-2 mb-6">
              05 // Visitor Analytics
            </h2>
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
            </div>
          </div>

          <div className="border border-foreground/10 bg-white/[0.01] backdrop-blur-sm p-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-b border-foreground/10 pb-2 mb-6">
              06 // Backend Health
            </h2>
            <div className="flex items-center gap-4 p-6 bg-foreground/5 border border-foreground/10">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
              <div>
                <p className="text-foreground font-bold uppercase tracking-tighter">System Online</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-1">
                  Version: 1.0.0-dev | Last Sync: Awaiting backend connection
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
                Variables synced to KV Store
              </span>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
