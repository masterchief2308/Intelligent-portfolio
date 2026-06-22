import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(os.path.dirname(__file__))

load_dotenv(Path(__file__).parent / ".env")
os.environ["USE_FIRESTORE"] = "True"

from services.firestore import get_firestore

async def clean():
    project = os.getenv("FIRESTORE_PROJECT_ID", "gen-lang-client-0511428447")
    print(f"Connecting to Firestore Project: {project}...")
    try:
        db = get_firestore(use_firestore=True, project_id=project)
        count = await db.clear_all()
        print(f"Successfully deleted {count} documents from Firestore.")
    except Exception as e:
        print(f"Failed to clean Firestore: {e}")

if __name__ == "__main__":
    asyncio.run(clean())
