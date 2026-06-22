import json
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage
from services.gemini import (
    build_dynamic_chain_with_fallbacks,
    PRIMARY_MODEL,
    FALLBACK_MODEL,
    FALLBACK_LITE_MODEL,
)

logger = logging.getLogger(__name__)

class JDAnalysisResult(BaseModel):
    match_score: float = Field(description="A score between 0.0 and 1.0 representing how well the portfolio matches the JD.")
    strong_skills: list[str] = Field(description="List of required skills from the JD that are strongly present in the portfolio.")
    missing_skills: list[str] = Field(description="List of required skills from the JD that are entirely missing or extremely weak in the portfolio.")
    summary: str = Field(description="A concise 1-2 sentence explanation of the match.")

async def analyze_jd(jd_text: str) -> JDAnalysisResult:
    """Analyze a Job Description against Aditya's Portfolio to generate a match score."""
    # 1. Load Portfolio Data as the Ground Truth Context
    portfolio_path = Path(__file__).parent.parent / "data" / "portfolio.json"
    portfolio_content = ""
    try:
        if portfolio_path.exists():
            portfolio_data = json.loads(portfolio_path.read_text(encoding="utf-8"))
            # Format portfolio data into a compressed string representation
            basics = portfolio_data.get("basics", {})
            skills = portfolio_data.get("skills", {})
            exp = portfolio_data.get("experience", [])
            
            portfolio_content = f"Name: {basics.get('name')}\nRole: {basics.get('label')}\n"
            portfolio_content += "SKILLS:\n"
            for k, v in skills.items():
                portfolio_content += f"- {k}: {', '.join(v)}\n"
            
            portfolio_content += "EXPERIENCE:\n"
            for e in exp:
                portfolio_content += f"- {e.get('role')} at {e.get('company')} ({e.get('startDate')}-{e.get('endDate')})\n"
                
            portfolio_content += "PROJECTS:\n"
            for p in portfolio_data.get("projects", []):
                portfolio_content += f"- {p.get('title')}: {p.get('context')} (Stack: {', '.join(p.get('techStack', []))})\n"
    except Exception as e:
        logger.error(f"Failed to load portfolio.json for JD Analyzer: {e}")
        portfolio_content = "Portfolio data unavailable."

    # 2. Construct Messages
    system_prompt = SystemMessage(content=(
        "You are an expert Technical Recruiter evaluating a candidate (Aditya Katkar) for a role based on a Job Description (JD). "
        "Analyze the provided JD against Aditya's Portfolio Context. Be objective and strict. "
        "Output a structured JSON response with exactly: "
        "'match_score' (float 0.0-1.0), 'strong_skills' (list of strings), 'missing_skills' (list of strings), and 'summary'. "
        "Do not hallucinate skills he does not have. If a JD requirement is missing, explicitly list it in 'missing_skills'."
    ))
    
    human_prompt = HumanMessage(content=(
        f"--- ADITYA'S PORTFOLIO CONTEXT ---\n{portfolio_content}\n\n"
        f"--- JOB DESCRIPTION ---\n{jd_text}\n\n"
        "Generate the JDAnalysisResult."
    ))

    # 3. Dynamic Model Chain
    configs = [
        {
            "model_name": PRIMARY_MODEL,
            "api_key_env": "GEMINI_API_KEY",
            "messages": [system_prompt, human_prompt]
        },
        {
            "model_name": FALLBACK_MODEL,
            "api_key_env": "GEMINI_API_KEY_FALLBACK",
            "messages": [system_prompt, human_prompt]
        },
        {
            "model_name": FALLBACK_LITE_MODEL,
            "api_key_env": "GEMINI_API_KEY_FALLBACK_2",
            "messages": [system_prompt, human_prompt]
        }
    ]

    try:
        chain = build_dynamic_chain_with_fallbacks(JDAnalysisResult, configs)
        result = await chain.ainvoke({})
        return result
    except Exception as e:
        logger.error(f"JD Analyzer failed: {e}")
        return JDAnalysisResult(
            match_score=0.0,
            strong_skills=[],
            missing_skills=["Analysis failed due to API quota."],
            summary="Failed to analyze JD. Please try again."
        )
