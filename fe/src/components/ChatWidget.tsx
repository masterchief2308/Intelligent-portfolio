'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { api } from '@/lib/api';
import { formatResumeCompareMarkdown } from '@/lib/formatResumeCompare';
import { applyStepEvent } from '@/lib/thinkingSteps';
import ThinkingPanel, { type ThinkingStep } from '@/components/ThinkingPanel';
import { useBodyScrollLock, useEscapeKey } from '@/hooks/useBodyScrollLock';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

import { MessageCircle, X, FileUp } from 'lucide-react';

type ChatMode = 'chat' | 'resume';

const MATCHER_LINKS = [
  {
    href: '/explore/resume',
    label: 'Portfolio match',
    hint: 'Your CV vs Aditya\'s projects',
  },
  {
    href: '/explore/recruiter',
    label: 'JD match',
    hint: 'Candidate pool + job description',
  },
] as const;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { project: string; section: string; title?: string }[];
  followups?: string[];
  matchProjects?: { project_id: string; project_title: string }[];
}

const ACCEPTED_RESUME = '.pdf,.txt,application/pdf,text/plain';

export default function ChatWidget() {
  const { personalization } = usePortfolioStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mode, setMode] = useState<ChatMode>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef(`chat-${Date.now()}`);
  const isMobile = useMediaQuery('(max-width: 639px)');

  useBodyScrollLock(isOpen);
  const closeChat = useCallback(() => {
    setIsOpen(false);
    setIsFullScreen(false);
  }, []);
  const openChat = useCallback(() => {
    setIsOpen(true);
    if (isMobile) setIsFullScreen(true);
  }, [isMobile]);
  useEscapeKey(closeChat, isOpen);

  useEffect(() => {
    const container = messagesContainerRef.current;
    const anchor = messagesEndRef.current;
    if (!container || !anchor) return;
    anchor.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [messages, loading, mode, thinkingSteps, streamingContent]);

  if (!personalization) return null;

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setThinkingSteps([]);
    setStreamingContent('');

    try {
      const response = await api.chatStream(
        {
          message: text,
          session_id: sessionId.current,
          personalization_id: personalization.personalization_id,
          visitor_profile: personalization.visitor_profile,
        },
        (event) => {
          if (event.type === 'step') {
            setThinkingSteps((prev) => applyStepEvent(prev, event as Parameters<typeof applyStepEvent>[1]));
          } else if (event.type === 'token' && typeof event.content === 'string') {
            setStreamingContent((prev) => prev + event.content);
          }
        },
      );

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.response,
          sources: response.sources,
          followups: response.suggested_followups,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Backend not connected. Chat will be available once the RAG pipeline is deployed.',
        },
      ]);
    } finally {
      setLoading(false);
      setThinkingSteps([]);
      setStreamingContent('');
    }
  };

  const compareResume = async (file: File) => {
    if (loading) return;

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: `[Uploaded resume] ${file.name}` },
    ]);
    setLoading(true);
    setThinkingSteps([]);
    setResumeFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      const sessionId = personalization?.visitor_profile?.email || 'anonymous';
      const result = await api.compareResumeStream(file, (event) => {
        if (event.type === 'step') {
          setThinkingSteps((prev) => applyStepEvent(prev, event as Parameters<typeof applyStepEvent>[1]));
        }
      }, sessionId);

      const matchProjects = result.matches?.map((m) => ({
        project_id: m.project_id,
        project_title: m.project_title,
      }));

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: formatResumeCompareMarkdown(result),
          matchProjects,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Comparison failed.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Could not compare that resume. ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
      setThinkingSteps([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'resume') {
      if (resumeFile) compareResume(resumeFile);
      return;
    }
    sendMessage(input);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'File too large. Please upload a PDF or TXT under 5MB.' },
      ]);
      return;
    }
    setResumeFile(file);
  };

  const thinkingTitle = mode === 'resume' ? 'Resume analysis' : 'Retrieval pipeline';

  return (
    <>
      <button
        type="button"
        onClick={() => (isOpen ? closeChat() : openChat())}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        className="fixed bottom-safe right-4 sm:right-6 z-[60] w-12 h-12 bg-amber-500 hover:bg-amber-400 transition-colors flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)] group"
      >
        <span className="font-mono text-background text-lg font-bold group-hover:scale-110 transition-transform flex items-center justify-center">
          {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        </span>
        {!isOpen && messages.length === 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-foreground rounded-full animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Portfolio assistant"
          className={`fixed z-[60] flex flex-col border border-foreground/20 bg-[#050505] shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all duration-300 max-w-full ${
            isFullScreen
              ? 'inset-2 sm:inset-6 md:inset-10'
              : 'bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 sm:right-6 left-4 sm:left-auto w-full sm:w-[min(380px,calc(100%-2rem))] h-[min(500px,calc(100svh-7rem))]'
          }`}
        >
          <div className="px-3 sm:px-4 py-3 border-b border-foreground/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-amber-500 shrink-0 truncate max-w-[7rem] sm:max-w-none">
                Portfolio Assistant
              </span>
              <div className="flex border border-foreground/20 shrink-0">
                <button
                  type="button"
                  onClick={() => setMode('chat')}
                  className={`px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                    mode === 'chat' ? 'bg-amber-500 text-background' : 'text-foreground/50 hover:text-foreground'
                  }`}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setMode('resume')}
                  className={`px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                    mode === 'resume' ? 'bg-amber-500 text-background' : 'text-foreground/50 hover:text-foreground'
                  }`}
                  title="Compare your resume to portfolio projects"
                >
                  Vs Portfolio
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              aria-label={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="hidden sm:block font-mono text-[10px] uppercase tracking-widest text-foreground/50 hover:text-amber-500 transition-colors shrink-0"
            >
              {isFullScreen ? '[ MIN ]' : '[ MAX ]'}
            </button>
          </div>

          <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
            {messages.length === 0 && mode === 'chat' && personalization.website_config?.suggested_queries && (
              <div className="space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/40">
                  {personalization.website_config?.chat_context?.opener || 'Ask me anything'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {personalization.website_config.suggested_queries.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="font-mono text-[10px] uppercase tracking-widest text-amber-500 border border-amber-500/30 px-3 py-2 hover:bg-amber-500/10 transition-colors text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.length === 0 && mode === 'resume' && (
              <div className="space-y-3 border border-dashed border-foreground/20 p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/40">
                  Portfolio resume match (quick)
                </p>
                <p className="font-mono text-[10px] text-foreground/30 leading-relaxed">
                  Upload your PDF or TXT here to score against Aditya&apos;s projects. For recruiter JD matching (many candidates + job description), use the full tool below.
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  {MATCHER_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="font-mono text-[10px] uppercase tracking-widest border border-foreground/20 px-3 py-2 hover:border-amber-500/50 hover:text-amber-500 transition-colors"
                    >
                      <span className="block text-foreground/80">{link.label}</span>
                      <span className="block text-[9px] text-foreground/35 normal-case tracking-normal mt-0.5">{link.hint}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`${isFullScreen ? 'max-w-[85%] sm:max-w-[70%]' : 'max-w-[92%] sm:max-w-[85%]'} p-3 sm:p-4 ${
                    msg.role === 'user'
                      ? 'bg-amber-500/10 border border-amber-500/30 text-foreground font-mono text-xs'
                      : 'bg-foreground/5 border border-foreground/10'
                  }`}
                >
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <div className="prose prose-invert prose-amber max-w-none prose-sm font-mono text-xs prose-p:leading-relaxed prose-pre:bg-foreground/10 prose-pre:border prose-pre:border-foreground/20 prose-pre:overflow-x-auto prose-a:text-amber-500 hover:prose-a:text-amber-400 prose-headings:text-foreground prose-strong:text-amber-500 break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Removed selectable project links (sources and matchProjects) per user request. Details are now integrated directly into the LLM text response. */}
                  {msg.followups && msg.followups.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-foreground/10 flex flex-wrap gap-1">
                      {msg.followups.map((f, j) => (
                        <button
                          key={j}
                          onClick={() => sendMessage(f)}
                          className="text-[10px] text-amber-500/50 hover:text-amber-500 uppercase tracking-widest transition-colors"
                        >
                          [{f}]
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start w-full">
                <div className={`space-y-2 ${isFullScreen ? 'max-w-[85%] sm:max-w-[70%]' : 'max-w-[92%] sm:max-w-[85%]'} w-full`}>
                  {thinkingSteps.length > 0 && (
                    <ThinkingPanel
                      steps={thinkingSteps}
                      title={thinkingTitle}
                      defaultCollapsed
                      className="rounded-sm"
                    />
                  )}
                  {streamingContent && mode === 'chat' && (
                    <div className="bg-foreground/5 border border-foreground/10 p-4">
                      <div className="prose prose-invert prose-amber max-w-none prose-sm font-mono text-xs prose-p:leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                          {streamingContent}
                        </ReactMarkdown>
                      </div>
                      <span className="inline-block w-2 h-3 bg-amber-500/80 animate-pulse ml-0.5 align-middle" />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t border-foreground/10 flex flex-col gap-2">
            {mode === 'resume' ? (
              <>
                <div className="flex gap-2 items-center min-w-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_RESUME}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="flex-1 min-w-0 flex items-center justify-center gap-2 border border-foreground/20 px-3 py-2.5 font-mono text-[10px] uppercase tracking-widest text-foreground/70 hover:border-amber-500/50 hover:text-amber-500 transition-colors disabled:opacity-30"
                  >
                    <FileUp size={14} className="shrink-0" />
                    <span className="truncate">{resumeFile ? resumeFile.name : 'Choose PDF or TXT'}</span>
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !resumeFile}
                    className="bg-amber-500 text-background px-4 py-2.5 font-mono text-xs font-bold hover:bg-amber-400 transition-colors disabled:opacity-30 shrink-0 min-h-[44px]"
                  >
                    Compare
                  </button>
                </div>
                {resumeFile && (
                  <p className="font-mono text-[9px] text-foreground/30 uppercase tracking-widest">
                    Upload another file after this comparison to try a different resume
                  </p>
                )}
              </>
            ) : (
              <div className="flex gap-2 min-w-0">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about my projects..."
                  className="flex-1 min-w-0 bg-transparent border border-foreground/20 px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-amber-500 transition-colors"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setMode('resume')}
                  title="Resume matchers"
                  className="border border-foreground/20 px-3 py-2.5 text-foreground/50 hover:text-amber-500 hover:border-amber-500/50 transition-colors disabled:opacity-30 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  disabled={loading}
                >
                  <FileUp size={16} />
                </button>
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="bg-amber-500 text-background px-4 py-2.5 font-mono text-xs font-bold hover:bg-amber-400 transition-colors disabled:opacity-30 shrink-0 min-h-[44px] min-w-[44px]"
                >
                  →
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </>
  );
}
