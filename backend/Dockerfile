# PINKEY backend — FastAPI on Cloud Run.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies first so the layer caches across code-only deploys.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py firebase_client.py ./

# Cloud Run requires listening on $PORT; 8080 is its default.
ENV PORT=8080

# Run unprivileged.
RUN useradd --create-home --uid 1001 appuser && chown -R appuser /app
USER appuser

# Single uvicorn process; Cloud Run scales by adding instances, not threads.
CMD exec uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 1 --timeout-keep-alive 65
