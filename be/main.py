from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Personalization API")

class PersonalizeRequest(BaseModel):
    email: str
    role: str
    company: Optional[str] = None

@app.post("/api/personalize")
async def personalize(request: PersonalizeRequest):
    # This is a stub for the LangGraph agents
    # TODO: Implement LangGraph agents, Redis KV caching, and Playwright scraping
    return {
        "email": request.email,
        "hero_intro": f"Hey {request.email.split('@')[0]}, I see you're building...",
        "featured_projects": [],
        "chat_opener": f"Based on your role as {request.role}, I'd start by...",
        "visitor_profile": {
            "role": request.role,
            "company": request.company
        },
        "suggested_queries": [
            "Show me your projects",
            "What's your architecture like?"
        ]
    }

@app.get("/health")
async def health_check():
    return {"status": "ok"}
