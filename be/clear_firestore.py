import asyncio
import os
from dotenv import load_dotenv

# Force firestore usage for the script
os.environ["USE_FIRESTORE"] = "True"
os.environ["FIRESTORE_PROJECT_ID"] = "gen-lang-client-0511428447"

from services.firestore import FirestoreService

async def wipe():
    print("Connecting to Firestore...")
    fs = FirestoreService(use_firestore=True, project_id="gen-lang-client-0511428447")
    if not fs._db:
        print("Failed to initialize Firestore DB.")
        return
    
    print("Clearing all data from Firestore except Qdrant...")
    count = await fs.clear_all()
    print(f"Success! Cleared {count} documents from Firestore.")

if __name__ == "__main__":
    asyncio.run(wipe())
