import asyncio
import sys
import os
sys.path.append(os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
os.environ["QDRANT_URL"] = "https://de007058-12ec-4d2a-875a-c6c120dbcd95.eu-west-2-0.aws.cloud.qdrant.io"

from services.qdrant import get_qdrant

async def run():
    q = get_qdrant()
    # Try different search types
    chunks = await q.search(query="Python GenAI", use_case="chat")
    print("Chat chunks found:", len(chunks))
    
    chunks2 = await q.search(query="Python GenAI", use_case="resume_compare")
    print("Resume Compare chunks found:", len(chunks2))
    for c in chunks2:
        print(c.get("doc_type"), c.get("project_slug"))

if __name__ == "__main__":
    asyncio.run(run())
