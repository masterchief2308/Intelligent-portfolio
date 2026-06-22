'use client';

import { useState, useRef, useEffect } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { api } from '@/lib/api';
import { formatResumeCompareMarkdown } from '@/lib/formatResumeCompare';
import { applyStepEvent } from '@/lib/thinkingSteps';
import ThinkingPanel, { type ThinkingStep } from '@/components/ThinkingPanel';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

import { MessageCircle, X, FileUp } from 'lucide-react';

type ChatMode = 'chat' | 'resume';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { project: string; section: string; title?: string }[];
  followups?: string[];
  matchProjects?: { project_id: string; project_title: string }[];
}

const ACCEPTED_RESUME = '.pdf,.txt,application/pdf,text/plain';

export default function ChatWidget() {
  const { personalization, setIsStreamingLLM } = usePortfolioStore();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef(`chat-${Date.now()}`);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, mode, thinkingSteps, streamingContent]);

  if (!personalization) return null;

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setIsStreamingLLM(true);
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
      setIsStreamingLLM(false);
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
    setIsStreamingLLM(true);
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
      setIsStreamingLLM(false);
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
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-6 z-50 w-12 h-12 bg-amber-500 hover:bg-amber-400 transition-colors flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)] group"
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
          className={`fixed z-50 flex flex-col border border-foreground/20 bg-[#050505] shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all duration-300 ${isFullScreen ? 'inset-4 md:inset-12 bottom-36 md:bottom-12' : 'bottom-36 right-6 w-[380px] h-[500px]'}`}
        >
          <div className="px-4 py-3 border-b border-foreground/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-widest text-amber-500 shrink-0">
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
                >
                  Resume
                </button>
              </div>
            </div>
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="font-mono text-[10px] uppercase tracking-widest text-foreground/50 hover:text-amber-500 transition-colors shrink-0"
            >
              {isFullScreen ? '[ MIN ]' : '[ MAX ]'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  Compare your resume against Aditya&apos;s portfolio projects
                </p>
                <p className="font-mono text-[10px] text-foreground/30 leading-relaxed">
                  Upload a PDF or TXT (max 5MB). You can compare multiple resumes — upload another file anytime.
                </p>
                <Link
                  href="/explore/resume"
                  className="inline-block font-mono text-[10px] uppercase tracking-widest text-amber-500/70 hover:text-amber-500"
                >
                  Open full resume matcher →
                </Link>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`${isFullScreen ? 'max-w-[70%]' : 'max-w-[85%]'} p-4 ${
                    msg.role === 'user'
                      ? 'bg-amber-500/10 border border-amber-500/30 text-foreground font-mono text-xs'
                      : 'bg-foreground/5 border border-foreground/10'
                  }`}
                >
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <div className="prose prose-invert prose-amber max-w-none prose-sm font-mono text-xs prose-p:leading-relaxed prose-pre:bg-foreground/10 prose-pre:border prose-pre:border-foreground/20 prose-a:text-amber-500 hover:prose-a:text-amber-400 prose-headings:text-foreground prose-strong:text-amber-500">
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
                <div className={`space-y-2 ${isFullScreen ? 'max-w-[70%]' : 'max-w-[85%]'} w-full`}>
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
                <div className="flex gap-2 items-center">
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
                    className="flex-1 flex items-center justify-center gap-2 border border-foreground/20 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-foreground/70 hover:border-amber-500/50 hover:text-amber-500 transition-colors disabled:opacity-30"
                  >
                    <FileUp size={14} />
                    {resumeFile ? resumeFile.name : 'Choose PDF or TXT'}
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !resumeFile}
                    className="bg-amber-500 text-background px-4 py-2 font-mono text-xs font-bold hover:bg-amber-400 transition-colors disabled:opacity-30 shrink-0"
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about my projects..."
                  className="flex-1 bg-transparent border border-foreground/20 px-3 py-2 font-mono text-xs text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-amber-500 transition-colors"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setMode('resume')}
                  title="Compare a resume"
                  className="border border-foreground/20 px-3 py-2 text-foreground/50 hover:text-amber-500 hover:border-amber-500/50 transition-colors disabled:opacity-30"
                  disabled={loading}
                >
                  <FileUp size={16} />
                </button>
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="bg-amber-500 text-background px-4 py-2 font-mono text-xs font-bold hover:bg-amber-400 transition-colors disabled:opacity-30"
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
