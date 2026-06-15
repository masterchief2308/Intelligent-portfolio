import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, role, company } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // PDF PART 4 & 5: Mock the LangGraph scraping timeout/logic
    // Simulate a 1.5s delay to represent scraping LinkedIn and Company domain
    await new Promise(resolve => setTimeout(resolve, 1500));

    // PDF PART 6: Graceful Degradation / Fallback Content Per Role
    const fallbackData = getRoleBasedTemplate(role, company);

    return NextResponse.json({
      email,
      ...fallbackData
    });

  } catch (error) {
    console.error("Personalization failed:", error);
    // Absolute fallback
    return NextResponse.json(getRoleBasedTemplate('other', ''), { status: 200 });
  }
}

// PDF PART 6: Fallback Content Template Definitions
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
        personalization_id: 'mock-123',
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
        personalization_id: 'mock-123',
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
        personalization_id: 'mock-123',
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
        personalization_id: 'mock-123',
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
