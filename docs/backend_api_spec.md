# Complete Frontend-to-Backend API Specification

This document outlines the entire user journey through the frontend, mapping every stage to the required backend API. The backend team can use this as the exact contract to build against. 

If the backend implements these endpoints with these exact JSON shapes, the frontend will integrate with zero code changes.

---

## Complete API Summary Table

| # | Method | Endpoint | Auth | Trigger |
|---|--------|----------|------|---------|
| 1 | `GET` | `/api/portfolio` | None | Initial page load (cached 60s). Fetches resume base data. |
| 2 | `POST` | `/api/personalize` | None | Landing page form submit. Triggers LinkedIn scrape & RAG personalization. |
| 3 | `GET` | `/api/architecture/:slug` | None | Project page mount. Fetches React Flow graph definitions. |
| 4 | `POST` | `/api/admin/auth` | None | Admin login form submission. |
| 5 | `GET` | `/api/admin/config` | JWT | Admin dashboard load. Fetches all RAG prompts and analytics. |
| 6 | `PUT` | `/api/admin/config` | JWT | Admin saves settings (RAG prompts, timeouts, etc.). |
| 7 | `POST` | `/api/admin/cache/clear` | JWT | Admin clicks "Terminate Cache" to reset active sessions. |
| 8 | `POST` | `/api/chat` | None | User sends a message via the floating Chat Widget. |
| 9 | `GET` | `/api/resume/pdf` | None | User clicks "Download Resume" on Journey page. |
| 10 | `POST` | `/api/analytics/visit` | None | Fires silently after successful personalization. |
| 11 | `GET` | `/api/admin/analytics` | JWT | Admin dashboard load. Fetches visitor stats. |

---

## Stage 0: App Bootstrap (Every Page Load)

**User Flow:** User visits any page. Frontend hydrates global state with base resume data.

### API: `GET /api/portfolio`

**Request:** None (public endpoint)

**Response:**
```json
{
  "basics": {
    "name": "Aditya Katkar",
    "label": "Full Stack GenAI Engineer",
    "email": "katkaraditya15@gmail.com",
    "phone": "+91-9082890889",
    "location": "Mumbai, India",
    "linkedin": "linkedin.com/in/aditya-katkar",
    "github": "github.com/masterchief2308",
    "summary": "Full Stack GenAI Engineer with 2 years of experience..."
  },
  "skills": {
    "generative_ai": ["LLM Orchestration", "Prompt Engineering", "RAG"],
    "backend": ["FastAPI", "Node.js"]
  },
  "experience": [
    {
      "company": "Valiance Solutions",
      "location": "Noida",
      "role": "Software Engineer",
      "startDate": "Jul 2024",
      "endDate": "Present",
      "highlights": ["Architected a 6-microservice platform..."]
    }
  ],
  "education": [
    {
      "institution": "MIT Pune",
      "degree": "B.Tech Computer Science",
      "startDate": "Oct 2020",
      "endDate": "May 2024",
      "cgpa": "9.2 / 10"
    }
  ],
  "certifications": [
    { "name": "Google Professional Cloud Developer", "date": "Dec 2024" }
  ],
  "projects": [
    {
      "id": "iocl-tender-evaluation",
      "title": "IOCL Tender Evaluation Platform",
      "client": "Indian Oil Corporation Ltd.",
      "date": "Jan 2025 – Present",
      "cloud": "GCP",
      "metric": "95% RELIABILITY",
      "context": "System context description...",
      "howItWorks": "Architectural implementation details...",
      "roi": ["Reduced manual evaluation cycle from 4 weeks to same-day."],
      "techStack": ["FastAPI", "React", "GCP"]
    }
  ]
}
```

---

## Stage 1: Landing Page — Visitor Form (`/`)

**User Flow:** User enters email, selects a role (e.g., Hiring), and submits the terminal form. Backend runs LangGraph + RAG and returns a personalized hero section.

### API: `POST /api/personalize`

**Request:**
```json
{
  "email": "recruiter@google.com",
  "role": "hiring",
  "company": "Google"
}
```

**Response:**
```json
{
  "email": "recruiter@google.com",
  "hero_intro": "Hey recruiter at Google! Here's what I've shipped...",
  "chat_opener": "What role are you hiring for?",
  "visitor_profile": {
    "name": "Jane Doe",
    "role": "hiring",
    "current_company": "Google",
    "years_experience": 8,
    "skills": ["Recruiting", "Engineering Management"],
    "seniority": "senior",
    "hiring_for": ["Senior Backend Engineer", "ML Engineer"]
  },
  "featured_projects": [
    {
      "id": "iocl-tender-evaluation",
      "title": "IOCL Tender Evaluation Platform",
      "why_relevant": "You're hiring for backend — I reduced P95 latency by 69% on a 6-microservice GKE platform.",
      "metric": "95% RELIABILITY"
    }
  ],
  "suggested_queries": [
    "Show me your resume",
    "What is your tech stack?"
  ]
}
```

---

## Stage 2: Silent Analytics Tracking

**User Flow:** Immediately after personalization succeeds, the frontend silently fires this endpoint to track the visitor.

### API: `POST /api/analytics/visit`

**Request:**
```json
{
  "email": "recruiter@google.com",
  "role": "hiring",
  "company": "Google",
  "timestamp": "2026-06-15T18:10:00Z",
  "referrer": "https://linkedin.com",
  "user_agent": "Mozilla/5.0..."
}
```

**Response:**
```json
{
  "tracked": true
}
```

---

## Stage 3: Project Detail Page (`/projects/[slug]`)

**User Flow:** User clicks on a project card. The frontend fetches the React Flow architecture graph definitions for that specific project.

### API: `GET /api/architecture/{slug}`

**Request:** None (slug is in URL)

**Response:**
```json
{
  "slug": "iocl-tender-evaluation",
  "nodes": [
    {
      "id": "plugin",
      "type": "custom",
      "x": -300,
      "y": -50,
      "label": "GeM Portal Plugin",
      "isExternal": true
    },
    {
      "id": "gcp",
      "type": "group",
      "x": 0,
      "y": -150,
      "width": 1200,
      "height": 1000,
      "label": "Google Cloud Platform",
      "badge": "GCP"
    },
    {
      "id": "frontend",
      "type": "custom",
      "x": 50,
      "y": 350,
      "label": "React Frontend",
      "badge": "RUN",
      "parentId": "gcp"
    }
  ],
  "edges": [
    {
      "source": "user",
      "target": "plugin",
      "animated": true,
      "dashed": false
    },
    {
      "source": "backend",
      "target": "ocr",
      "animated": false,
      "dashed": true,
      "label": "Pub/Sub",
      "sourceHandle": "s-bottom",
      "targetHandle": "t-top"
    }
  ]
}
```

---

## Stage 4: Chat Widget RAG Interaction

**User Flow:** User opens the floating chat bubble and types a question. The backend retrieves context and streams the response.

### API: `POST /api/chat`

**Request:**
```json
{
  "message": "How did you handle rate limits?",
  "session_id": "abc-123",
  "visitor_profile": {
    "role": "engineer",
    "seniority": "senior"
  }
}
```

**Response (Server-Sent Events / Streamed):**
```json
{
  "response": "For the IOCL platform, I implemented a multi-layered rate limiting strategy...",
  "sources": [
    { "project": "iocl-tender-evaluation", "section": "howItWorks" }
  ],
  "suggested_followups": [
    "What about dead-letter queues?"
  ]
}
```

---

## Stage 5: Resume PDF Download

**User Flow:** User clicks "Download Resume" on the Journey page.

### API: `GET /api/resume/pdf`

**Request:** None

**Response:** Binary PDF file
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="Aditya_Katkar_Resume.pdf"`

---

## Stage 6: Admin Authentication (`/admin`)

**User Flow:** Admin enters passphrase to access the dashboard.

### API: `POST /api/admin/auth`

**Request:**
```json
{
  "passphrase": "admin_password"
}
```

**Response (Success):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_at": "2026-06-16T18:00:00Z"
}
```

---

## Stage 7: Admin Configuration Sync

**User Flow:** Admin dashboard loads, fetching system health, configuration, and RAG prompts.

### API: `GET /api/admin/config`
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "scraping_timeout_ms": 5000,
  "fallback_enabled": true,
  "api_keys": {
    "openai": "sk-****",
    "langchain": "ls__****",
    "gemini": "AIza****"
  },
  "backend_version": "1.2.0",
  "last_sync": "2026-06-15T17:30:00Z",
  "rag_prompts": [
    {
      "id": "recruiter_personalization",
      "name": "Recruiter Personalization",
      "template": "You are personalizing a portfolio for a recruiter...",
      "model": "gemini-2.5-flash",
      "temperature": 0.7,
      "max_tokens": 1024,
      "description": "Generates personalized landing page content for recruiters",
      "updated_at": "2026-06-15T12:00:00Z"
    }
  ]
}
```

### API: `PUT /api/admin/config`
**Headers:** `Authorization: Bearer <token>`

**Request (Partial updates allowed):**
```json
{
  "scraping_timeout_ms": 7000,
  "rag_prompts": [
    {
      "id": "recruiter_personalization",
      "template": "Updated template text here...",
      "temperature": 0.8
    }
  ]
}
```

**Response:** Returns the full updated `AdminConfig` object.

---

## Stage 8: Admin Analytics Dashboard

**User Flow:** Admin dashboard loads visitor statistics.

### API: `GET /api/admin/analytics`
**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "total_visitors": 142,
  "visitors_this_week": 23,
  "by_role": {
    "hiring": 67,
    "engineer": 45,
    "manager": 18,
    "other": 12
  },
  "recent_visitors": [
    {
      "email": "recruiter@google.com",
      "role": "hiring",
      "company": "Google",
      "timestamp": "2026-06-15T18:10:00Z"
    }
  ],
  "top_projects_viewed": [
    { "slug": "iocl-tender-evaluation", "views": 89 }
  ]
}
```
