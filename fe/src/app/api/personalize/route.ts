import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://intelligent-portfolio-backend-702455616797.asia-south1.run.app';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, role, company } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Try real backend first
    if (BACKEND_URL) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const backendResponse = await fetch(`${BACKEND_URL}/api/personalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role, company }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (backendResponse.ok) {
          const data = await backendResponse.json();
          return NextResponse.json(data);
        }

        console.warn(`Backend returned ${backendResponse.status}, falling back to mock`);
      } catch (backendError) {
        console.warn("Backend unreachable, using fallback:", backendError);
      }
    }

    // Fallback: mock data when backend is unavailable
    await new Promise(resolve => setTimeout(resolve, 800));
    const fallbackData = getRoleBasedTemplate(role, company);

    return NextResponse.json({
      email,
      ...fallbackData
    });

  } catch (error) {
    console.error("Personalization failed:", error);
    return NextResponse.json(getRoleBasedTemplate('other', ''), { status: 200 });
  }
}

// Fallback templates when backend is unreachable
function getRoleBasedTemplate(role: string, company?: string) {
  const compStr = company ? ` at ${company}` : '';
  
  const baseProjects = [
    {
      id: 'iocl-tender-evaluation',
      title: 'IOCL Tender Evaluation Platform',
      why_relevant: 'Architected 6-microservice GKE platform to automate procurement.',
      metric: "95% RELIABILITY"
    },
    {
      id: 'km-tech-int-forensics',
      title: 'KM-Tech-Int Digital Forensics',
      why_relevant: 'Integrated Gemini 2.5 Flash for forensic extraction into Neo4j.',
      metric: "10X FASTER"
    },
    {
      id: 'azolla-casper',
      title: 'Azolla CASPER SaaS',
      why_relevant: 'Built ML-powered EU ETS carbon penalty exposure calculator.',
      metric: "<50K EUR ERROR"
    }
  ];

  switch (role) {
    case 'hiring':
      return {
        personalization_id: 'fallback-hiring',
        visitor_profile: { role: 'hiring', seniority: 'senior', skills: ['Recruiting'] },
        website_config: {
          hero: { intro: `Hey recruiter${compStr}! Here's what I've shipped...` },
          featured_projects: baseProjects.map(p => ({
            ...p,
            why_relevant: p.id === 'iocl-tender-evaluation' ? 'Reduced tender evaluation from 4 weeks to same-day.' : p.why_relevant
          })),
          chat_context: { opener: "What role are you hiring for?" },
          suggested_queries: ["Show me your resume", "What is your tech stack?"]
        }
      };
    
    case 'engineer':
      return {
        personalization_id: 'fallback-engineer',
        visitor_profile: { role: 'engineer', seniority: 'mid', skills: ['System Design', 'React'] },
        website_config: {
          hero: { intro: "Here's my work. Code-first, metrics-driven." },
          featured_projects: baseProjects.map(p => ({
            ...p,
            why_relevant: p.id === 'iocl-tender-evaluation' ? 'Built tiered OCR pipeline with Qwen2-VL, LangChain, and Celery.' : p.why_relevant
          })),
          chat_context: { opener: "Ask me anything about my projects." },
          suggested_queries: ["Show me the architecture diagram", "How did you handle rate limits?"]
        }
      };
      
    case 'manager':
      return {
        personalization_id: 'fallback-manager',
        visitor_profile: { role: 'manager', seniority: 'senior', skills: ['Leadership', 'System Design'] },
        website_config: {
          hero: { intro: `Here's what I've built${compStr} and how I think about impact.` },
          featured_projects: baseProjects.map(p => ({
            ...p,
            why_relevant: p.id === 'iocl-tender-evaluation' ? 'Led architecture reducing P95 latency by 69% and GCP spend by 22%.' : p.why_relevant
          })),
          chat_context: { opener: "Let me walk you through my approach." },
          suggested_queries: ["How do you lead a team?", "Explain a system failure you recovered from"]
        }
      };
      
    default:
      return {
        personalization_id: 'fallback-default',
        visitor_profile: { role: 'other', seniority: 'junior', skills: [] },
        website_config: {
          hero: { intro: "Welcome to my portfolio." },
          featured_projects: baseProjects,
          chat_context: { opener: "Feel free to explore." },
          suggested_queries: ["Tell me about yourself"]
        }
      };
  }
}
