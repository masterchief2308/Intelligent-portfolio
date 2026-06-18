import type {
  PortfolioData,
  PersonalizationRequest,
  PersonalizationData,
  ArchitectureData,
  AdminAuthResponse,
  AdminConfig,
  ChatRequest,
  ChatResponse,
  AnalyticsVisit,
  AnalyticsDashboard,
  Project,
} from '@/types';

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
};
