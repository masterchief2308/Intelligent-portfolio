import type {
  PortfolioData,
  PersonalizationRequest,
  PersonalizationData,
  ArchitectureData,
  AdminAuthResponse,
  AdminConfig,
  ChatRequest,
  ChatResponse,
  ResumeCompareResponse,
  AnalyticsVisit,
  AnalyticsDashboard,
  Project,
  JDMatchResponse,
  ResumePoolStats,
  ResumeUploadResponse,
} from '@/types';
import { consumeSseStream, type SseHandler } from '@/lib/sseClient';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://intelligent-portfolio-backend-7ubimlsttq-el.a.run.app';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${BASE}${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  getPortfolio: (email?: string) => {
    const url = email ? `/api/portfolio?email=${encodeURIComponent(email)}` : `/api/portfolio`;
    return request<PortfolioData>(url);
  },

  getProject: (slug: string, email?: string) => {
    const url = email ? `/api/project/${slug}?email=${encodeURIComponent(email)}` : `/api/project/${slug}`;
    return request<Project>(url);
  },

  personalize: (data: PersonalizationRequest) =>
    request<PersonalizationData>('/api/personalize', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getArchitecture: (slug: string, email?: string) => {
    const url = email ? `/api/architecture/${slug}?email=${encodeURIComponent(email)}` : `/api/architecture/${slug}`;
    return request<ArchitectureData>(url);
  },

  adminAuth: (passphrase: string) =>
    request<AdminAuthResponse>('/api/admin/auth', {
      method: 'POST',
      body: JSON.stringify({ passphrase }),
    }),

  getAdminConfig: (token: string) =>
    request<AdminConfig>('/api/admin/config', {
      headers: authHeaders(token),
    }),

  updateAdminConfig: (token: string, config: Partial<AdminConfig>) =>
    request<AdminConfig>('/api/admin/config', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(config),
    }),

  clearCache: (token: string) =>
    request<{ success: boolean; cleared_count: number }>('/api/admin/cache/clear', {
      method: 'POST',
      headers: authHeaders(token),
    }),

  chat: (data: ChatRequest) =>
    request<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  chatStream: async (data: ChatRequest, onEvent: SseHandler): Promise<ChatResponse> => {
    const res = await fetch(`${BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`Chat stream failed (${res.status})`);
    }

    let result: ChatResponse | null = null;
    await consumeSseStream(res, (event) => {
      onEvent(event);
      if (event.type === 'result' && event.data) {
        result = event.data as ChatResponse;
      }
    });

    if (!result) {
      throw new Error('Chat stream ended without a response');
    }
    return result;
  },

  compareResume: async (file: File): Promise<ResumeCompareResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/api/resume/compare`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || `Comparison failed (${res.status})`);
    }
    return res.json();
  },

  compareResumeStream: async (
    file: File,
    onEvent: SseHandler,
  ): Promise<ResumeCompareResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/api/resume/compare/stream`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || `Comparison failed (${res.status})`);
    }

    let result: ResumeCompareResponse | null = null;
    await consumeSseStream(res, (event) => {
      onEvent(event);
      if (event.type === 'error') {
        throw new Error(String(event.message || 'Comparison failed'));
      }
      if (event.type === 'result' && event.data) {
        result = event.data as ResumeCompareResponse;
      }
    });

    if (!result) {
      throw new Error('Comparison stream ended without a result');
    }
    return result;
  },

  getResumePdf: () => `${BASE}/api/resume/pdf`,

  trackVisit: (data: AnalyticsVisit) =>
    request<{ tracked: boolean }>('/api/analytics/visit', {
      method: 'POST',
      body: JSON.stringify(data),
    }).catch(() => {}),

  getAnalytics: (token: string) =>
    request<AnalyticsDashboard>('/api/admin/analytics', {
      headers: authHeaders(token),
    }),

  // ── Recruiter ───────────────────────────────────────────────

  uploadResumes: async (files: File[]): Promise<ResumeUploadResponse> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const res = await fetch(`${BASE}/api/recruiter/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || `Upload failed (${res.status})`);
    }
    return res.json();
  },

  matchJDStream: async (
    jobDescription: string,
    onEvent: SseHandler,
  ): Promise<JDMatchResponse> => {
    const res = await fetch(`${BASE}/api/recruiter/match/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_description: jobDescription }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || `Match failed (${res.status})`);
    }

    let result: JDMatchResponse | null = null;
    await consumeSseStream(res, (event) => {
      onEvent(event);
      if (event.type === 'error') {
        throw new Error(String(event.message || 'Matching failed'));
      }
      if (event.type === 'result' && event.data) {
        result = event.data as JDMatchResponse;
      }
    });

    if (!result) {
      throw new Error('Match stream ended without a result');
    }
    return result;
  },

  getResumePool: () => request<ResumePoolStats>('/api/recruiter/pool'),

  clearResumePool: async (): Promise<{ cleared: boolean }> => {
    const res = await fetch(`${BASE}/api/recruiter/pool`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(`Clear pool failed (${res.status})`);
    }
    return res.json();
  },
};
