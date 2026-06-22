'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Check, Circle, AlertCircle } from 'lucide-react';

export type ThinkingStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface ThinkingStep {
  id: string;
  label: string;
  status: ThinkingStepStatus;
}

interface ThinkingPanelProps {
  steps: ThinkingStep[];
  title?: string;
  subtitle?: string;
  apiCalls?: number;
  maxApiCalls?: number;
  /** Start collapsed to save space (chat widget) */
  defaultCollapsed?: boolean;
  className?: string;
}

function StepIcon({ status }: { status: ThinkingStepStatus }) {
  if (status === 'running') {
    return <Loader2 size={12} className="text-amber-500 animate-spin shrink-0" />;
  }
  if (status === 'done') {
    return <Check size={12} className="text-emerald-500/80 shrink-0" />;
  }
  if (status === 'error') {
    return <AlertCircle size={12} className="text-red-500 shrink-0" />;
  }
  return <Circle size={10} className="text-foreground/20 shrink-0" />;
}

export default function ThinkingPanel({
  steps,
  title = 'Processing',
  subtitle,
  apiCalls,
  maxApiCalls,
  defaultCollapsed = true,
  className = '',
}: ThinkingPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (!steps.length) return null;

  const running = steps.find((s) => s.status === 'running');
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const allDone = steps.length > 0 && steps.every((s) => s.status === 'done' || s.status === 'error');
  const currentLabel = running?.label ?? steps[steps.length - 1]?.label ?? title;

  return (
    <div
      className={`border border-amber-500/30 bg-amber-500/[0.04] font-mono text-[10px] uppercase tracking-widest ${className}`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-amber-500/[0.06] transition-colors text-left"
      >
        {collapsed ? (
          <ChevronRight size={14} className="text-amber-500/70 shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-amber-500/70 shrink-0" />
        )}
        {allDone ? (
          <Check size={12} className="text-emerald-500/80 shrink-0" />
        ) : (
          <Loader2 size={12} className="text-amber-500 animate-spin shrink-0" />
        )}
        <span className="text-amber-500 font-bold truncate flex-1">{title}</span>
        <span className="text-foreground/30 shrink-0">
          {doneCount}/{steps.length}
        </span>
        {apiCalls !== undefined && maxApiCalls !== undefined && (
          <span className="text-amber-500/50 shrink-0 hidden sm:inline">
            API {apiCalls}/{maxApiCalls}
          </span>
        )}
      </button>

      {collapsed ? (
        <div className="px-3 pb-2 pt-0">
          <p
            className={`text-foreground/45 normal-case tracking-normal text-[11px] leading-snug truncate ${
              running ? 'animate-pulse' : ''
            }`}
          >
            {currentLabel}
          </p>
        </div>
      ) : (
        <div className="px-3 pb-3 space-y-1.5 max-h-36 overflow-y-auto border-t border-amber-500/10">
          {subtitle && (
            <p className="text-foreground/35 normal-case tracking-normal text-[10px] pt-2 pb-1">
              {subtitle}
            </p>
          )}
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className={`flex items-start gap-2 py-0.5 transition-colors duration-300 ${
                step.status === 'running'
                  ? 'text-amber-500'
                  : step.status === 'done'
                    ? 'text-foreground/40'
                    : step.status === 'error'
                      ? 'text-red-400'
                      : 'text-foreground/25'
              }`}
            >
              <span className="text-foreground/20 w-4 shrink-0 pt-0.5">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <StepIcon status={step.status} />
              <span
                className={`normal-case tracking-normal text-[11px] leading-snug ${
                  step.status === 'running' ? 'font-bold animate-pulse' : ''
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
