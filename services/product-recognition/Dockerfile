FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TORCH_HOME=/models

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Bake model and processor into the image so production never downloads weights.
ARG MODEL_ID=google/siglip-base-patch16-224
ENV MODEL_ID=${MODEL_ID}
RUN python -c "from transformers import AutoModel, AutoProcessor; AutoProcessor.from_pretrained('${MODEL_ID}'); AutoModel.from_pretrained('${MODEL_ID}')"

RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /data \
    && chown -R appuser:appuser /app /data /models
USER appuser

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
