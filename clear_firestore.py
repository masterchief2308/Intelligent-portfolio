import asyncio
import os
from google.cloud import firestore
from dotenv import load_dotenv

load_dotenv("be/.env")

def clear_all():
    db = firestore.Client()
    docs = list(db.collection("personalizations").stream())
    count = 0
    sub_count = 0
    for doc in docs:
        print(f"Deleting {doc.id}...")
        
        # Delete subcollections
        for sub_name in ["projects", "architectures", "portfolio"]:
            sub_docs = list(doc.reference.collection(sub_name).stream())
            for sub_doc in sub_docs:
                print(f"  Deleting sub {sub_name}/{sub_doc.id}")
                sub_doc.reference.delete()
                sub_count += 1
                
        doc.reference.delete()
        count += 1
        
    print(f"Done! Deleted {count} personalizations and {sub_count} sub-documents.")

if __name__ == "__main__":
    clear_all()
