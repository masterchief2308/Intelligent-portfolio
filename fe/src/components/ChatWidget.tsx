'use client';

import { useState, useRef, useEffect } from 'react';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { api } from '@/lib/api';
import type { ChatResponse } from '@/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { project: string; section: string }[];
  followups?: string[];
}

export default function ChatWidget() {
  const { personalization } = usePortfolioStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(`chat-${Date.now()}`);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!personalization) return null;

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response: ChatResponse = await api.chat({
        message: text,
        session_id: sessionId.current,
        personalization_id: personalization.personalization_id,
        visitor_profile: personalization.visitor_profile,
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.response,
        sources: response.sources,
        followups: response.suggested_followups,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Backend not connected. Chat will be available once the RAG pipeline is deployed.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-6 z-50 w-12 h-12 bg-amber-500 hover:bg-amber-400 transition-colors flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)] group"
      >
        <span className="font-mono text-background text-lg font-bold group-hover:scale-110 transition-transform">
          {isOpen ? '×' : '?'}
        </span>
        {!isOpen && messages.length === 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-foreground rounded-full animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-36 right-6 z-50 w-[380px] h-[500px] border border-foreground/20 bg-[#050505] shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col">
          <div className="px-4 py-3 border-b border-foreground/10 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber-500">Portfolio Assistant</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/30">RAG</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && personalization.website_config?.suggested_queries && (
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

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 font-mono text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-amber-500/10 border border-amber-500/30 text-foreground'
                    : 'bg-foreground/5 border border-foreground/10 text-foreground/90'
                }`}>
                  {msg.content}

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-foreground/10 space-y-1">
                      {msg.sources.map((s, j) => (
                        <a
                          key={j}
                          href={`/projects/${s.project}`}
                          className="block text-[10px] text-amber-500/70 hover:text-amber-500 uppercase tracking-widest transition-colors"
                        >
                          → {s.project} / {s.section}
                        </a>
                      ))}
                    </div>
                  )}

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
              <div className="flex justify-start">
                <div className="bg-foreground/5 border border-foreground/10 p-3 font-mono text-xs text-foreground/50 animate-pulse">
                  Retrieving context...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t border-foreground/10 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about my projects..."
              className="flex-1 bg-transparent border border-foreground/20 px-3 py-2 font-mono text-xs text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-amber-500 transition-colors"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-amber-500 text-background px-4 py-2 font-mono text-xs font-bold hover:bg-amber-400 transition-colors disabled:opacity-30"
            >
              →
            </button>
          </form>
        </div>
      )}
    </>
  );
}
