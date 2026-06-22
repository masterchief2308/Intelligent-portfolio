export interface Basics {
  name: string;
  label: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  summary: string;
}

export interface Skills {
  [category: string]: string[];
}

export interface Experience {
  company: string;
  location: string;
  role: string;
  startDate: string;
  endDate: string;
  highlights: string[];
}

export interface Education {
  institution: string;
  degree: string;
  startDate: string;
  endDate: string;
  cgpa: string;
}

export interface Certification {
  name: string;
  date: string;
}

export interface Project {
  id: string;
  title: string;
  client: string;
  company?: string;
  date: string;
  cloud: string;
  metric: string;
  context: string;
  howItWorks: string;
  roi: string[];
  techStack: string[];
}

export interface PortfolioData {
  basics: Basics;
  skills: Skills;
  experience: Experience[];
  education: Education[];
  certifications: Certification[];
  projects: Project[];
}

export interface ArchNode {
  id: string;
  type: 'custom' | 'group';
  x?: number;
  y?: number;
  label: string;
  badge?: string;
  parentId?: string;
  isExternal?: boolean;
  width?: number;
  height?: number;
  /** Vertical ordering hint for the FE Dagre layout engine (0=external … 4=data). */
  layer?: number;
}

export interface ArchEdge {
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  dashed?: boolean;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface ArchitectureData {
  slug: string;
  nodes: ArchNode[];
  edges: ArchEdge[];
}

export interface VisitorProfile {
  name?: string;
  email?: string;
  role?: string;
  current_company?: string;
  years_experience?: number;
  skills?: string[];
  seniority?: 'junior' | 'mid' | 'senior' | 'lead' | 'manager';
  hiring_for?: string[];
}

export interface FeaturedProject {
  id: string;
  title: string;
  why_relevant: string;
  metric?: string;
}

export interface PersonalizationRequest {
  email: string;
  role: string;
  company?: string;
}

export interface SkillPriority {
  skill: string;
  priority: number;
  proof: string;
}

export interface JourneyHighlight {
  milestone: string;
  relevance: string;
}

export interface WebsiteConfig {
  hero: any;
  featured_projects: FeaturedProject[];
  skills_priority: SkillPriority[];
  journey_highlights: JourneyHighlight[];
  chat_context: any;
  suggested_queries: string[];
}

export interface PersonalizationData {
  personalization_id: string;
  visitor_profile: VisitorProfile;
  website_config: WebsiteConfig;
}

export interface RagPrompt {
  id: string;
  name: string;
  template: string;
  model: string;
  temperature: number;
  max_tokens: number;
  description: string;
  updated_at: string;
}

export interface AdminConfig {
  scraping_timeout_ms: number;
  fallback_enabled: boolean;
  rag_prompts: RagPrompt[];
  api_keys: {
    openai: string;
    langchain: string;
    gemini: string;
  };
  backend_version: string;
  last_sync: string;
}

export interface AdminAuthRequest {
  passphrase: string;
}

export interface AdminAuthResponse {
  token: string;
  expires_at: string;
}

export interface ChatRequest {
  message: string;
  session_id: string;
  personalization_id: string;
  visitor_profile: VisitorProfile;
}

export interface ChatResponse {
  response: string;
  sources: { project: string; section: string }[];
  suggested_followups: string[];
}

export interface AnalyticsVisit {
  email: string;
  role: string;
  company?: string;
  timestamp: string;
  referrer?: string;
  user_agent?: string;
}

export interface AnalyticsDashboard {
  total_visitors: number;
  visitors_this_week: number;
  by_role: Record<string, number>;
  recent_visitors: {
    email: string;
    role: string;
    company?: string;
    timestamp: string;
  }[];
  top_projects_viewed: {
    slug: string;
    views: number;
  }[];
}
