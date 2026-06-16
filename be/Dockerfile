FROM python:3.12-slim

# Install system dependencies for Playwright and Qdrant/Transformers
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (chromium only for size)
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy application code
COPY . .

# Create non-root user (good practice, though Playwright sometimes needs careful permissions)
# Using root for now to avoid permission issues with Playwright in Docker
# RUN useradd -m appuser && chown -R appuser:appuser /app
# USER appuser

# Expose FastAPI port
EXPOSE 8000

# Start Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
