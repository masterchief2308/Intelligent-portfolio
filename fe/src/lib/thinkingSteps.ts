import type { ThinkingStep, ThinkingStepStatus } from '@/components/ThinkingPanel';

type StepEvent = {
  type?: string;
  id?: string;
  label?: string;
  status?: string;
};

export function applyStepEvent(steps: ThinkingStep[], event: StepEvent): ThinkingStep[] {
  if (event.type !== 'step' || !event.id) return steps;

  const id = event.id;
  const status = (event.status as ThinkingStepStatus) || 'running';
  const idx = steps.findIndex((s) => s.id === id);
  const label = event.label ?? (idx >= 0 ? steps[idx].label : id);

  if (idx >= 0) {
    const next = [...steps];
    next[idx] = { ...next[idx], label, status };
    return next;
  }
  return [...steps, { id, label, status }];
}

export function isThinkingComplete(steps: ThinkingStep[]): boolean {
  return steps.length > 0 && steps.every((s) => s.status === 'done' || s.status === 'error');
}
