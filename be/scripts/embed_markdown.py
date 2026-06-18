import os
import sys
import uuid
import logging
from pathlib import Path
from dotenv import load_dotenv
import PyPDF2

try:
    from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
except ImportError:
    print("langchain-text-splitters not installed. Please run 'pip install langchain-text-splitters'.")
    sys.exit(1)

# Add the 'be' directory to Python path so we can import services
sys.path.append(str(Path(__file__).parent.parent))

from services.qdrant import get_qdrant

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables from .env
load_dotenv(Path(__file__).parent.parent / ".env")

def extract_pdf_text(pdf_path: Path) -> str:
    """Extract all text from a PDF file."""
    text = ""
    try:
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"Failed to read PDF {pdf_path}: {e}")
        return ""

async def seed_data():
    qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = os.getenv("QDRANT_API_KEY", "")
    
    logger.info(f"Connecting to Qdrant at {qdrant_url}")
    qdrant = get_qdrant(url=qdrant_url, api_key=qdrant_api_key)
    qdrant.ensure_collection()

    embedding_data_dir = Path("E:/personal/data")
    if not embedding_data_dir.exists():
        logger.error(f"Directory {embedding_data_dir} not found!")
        return

    # 1. Setup Semantic Splitters
    headers_to_split_on = [
        ("#", "Header 1"),
        ("##", "Header 2"),
        ("###", "Header 3"),
        ("####", "Header 4"),
    ]
    markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
    
    # 2. Setup Token-Aware Sub-splitter (800 chars ~= 200 tokens)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        length_function=len,
    )

    all_documents = []
    all_metadata = []
    all_ids = []
    
    # Process all markdown and pdf files
    for file_path in embedding_data_dir.iterdir():
        if file_path.suffix not in [".md", ".pdf"]:
            continue
            
        logger.info(f"Processing {file_path.name}...")
        try:
            if file_path.suffix == ".md":
                content = file_path.read_text(encoding="utf-8")
                # Step 1: Split by markdown headers
                initial_splits = markdown_splitter.split_text(content)
            else:
                # For PDFs, extract text and treat as a single document without markdown headers
                content = extract_pdf_text(file_path)
                from langchain_core.documents import Document
                initial_splits = [Document(page_content=content, metadata={})]

            # Step 2: Ensure chunks fit token limit
            final_splits = text_splitter.split_documents(initial_splits)
            
            for split in final_splits:
                chunk_text = split.page_content
                metadata = split.metadata
                
                # Combine headers into a context string for the embedding
                context_str = " | ".join([f"{k}: {v}" for k, v in metadata.items()])
                embed_text = f"[{context_str}]\n{chunk_text}" if context_str else chunk_text
                
                payload = {
                    "doc_type": "markdown" if file_path.suffix == ".md" else "pdf",
                    "source_file": file_path.name,
                    **metadata
                }
                
                # Use deterministic UUIDs based on the exact text content so re-running overwrites safely
                point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, embed_text))
                
                all_documents.append(embed_text)
                all_metadata.append(payload)
                all_ids.append(point_id)
        except Exception as e:
            logger.error(f"Failed to process {file_path.name}: {e}")

    # Upsert all points
    if all_documents:
        logger.info(f"Successfully chunked into {len(all_documents)} heavily optimized semantic pieces.")
        # Batch upsert to avoid memory exhaustion (Qdrant cloud limits payload sizes)
        batch_size = 25
        for i in range(0, len(all_documents), batch_size):
            qdrant.upsert_documents(
                documents=all_documents[i:i + batch_size],
                metadata=all_metadata[i:i + batch_size],
                ids=all_ids[i:i + batch_size]
            )
            logger.info(f"Upserted batch {i//batch_size + 1}/{(len(all_documents) + batch_size - 1)//batch_size}")
            
        logger.info("Semantic Seeding complete! ✨")
    else:
        logger.warning("No data found to seed.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(seed_data())
