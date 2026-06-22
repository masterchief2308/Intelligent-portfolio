import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from services.firestore import get_firestore

async def main():
    project_id = os.getenv("FIRESTORE_PROJECT_ID", "gen-lang-client-0511428447")
    print(f"Connecting to Firestore project: {project_id}...")
    
    # We force use_firestore=True here to ensure we clean the cloud DB, 
    # even if local .env has it set to False
    db = get_firestore(use_firestore=True, project_id=project_id)
    
    print("Clearing all personalizations, caches, and visits...")
    count = await db.clear_all()
    print(f"Successfully deleted {count} documents from Firestore!")

if __name__ == "__main__":
    asyncio.run(main())
