FROM python:3.12-slim

# Install system dependencies for Playwright and Qdrant/Transformers
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Embedding model cache — baked into the image (avoids HF downloads on cold start)
ENV HF_HOME=/app/.cache/huggingface
ENV FASTEMBED_CACHE_PATH=/app/.cache/fastembed
ENV HF_HUB_DISABLE_TELEMETRY=1

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies quietly to prevent massive logs
RUN pip install --no-cache-dir -q --progress-bar off -r requirements.txt

# Pre-download hybrid retrieval models (MiniLM + BM25) at build time
COPY scripts/warmup_embed_models.py scripts/warmup_embed_models.py
RUN python scripts/warmup_embed_models.py

# Install Playwright browsers silently
RUN playwright install chromium > /dev/null 2>&1
RUN playwright install-deps chromium > /dev/null 2>&1

# Copy application code
COPY . .

# Create non-root user (good practice, though Playwright sometimes needs careful permissions)
# Using root for now to avoid permission issues with Playwright in Docker
# RUN useradd -m appuser && chown -R appuser:appuser /app
# USER appuser

# Expose Cloud Run default port
EXPOSE 8080
ENV PORT=8080

# Start Uvicorn — Cloud Run injects PORT; default 8080 (not 8000)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
