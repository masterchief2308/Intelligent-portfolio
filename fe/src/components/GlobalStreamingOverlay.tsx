'use client';

import { usePortfolioStore } from '@/store/usePortfolioStore';

export default function GlobalStreamingOverlay() {
  const isStreamingLLM = usePortfolioStore((state) => state.isStreamingLLM);

  if (!isStreamingLLM) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto cursor-wait bg-transparent" />
  );
}
