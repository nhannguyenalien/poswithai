import asyncio
import hmac
import io
import os

import numpy as np
import torch
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from transformers import AutoModel, AutoProcessor

MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))
API_KEY = os.getenv("RECOGNITION_API_KEY", "")
MODEL_ID = os.getenv("MODEL_ID", "google/siglip-base-patch16-224")
MODEL_VERSION = os.getenv("MODEL_VERSION", MODEL_ID)

processor = AutoProcessor.from_pretrained(MODEL_ID)
model = AutoModel.from_pretrained(MODEL_ID)
model.eval()
model_lock = asyncio.Lock()

app = FastAPI(title="POS Product Recognition", version="2.0.0")


def require_api_key(authorization: str | None) -> None:
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    if not API_KEY or not hmac.compare_digest(supplied, API_KEY):
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Invalid service credential", "details": None})


def decode_image(data: bytes) -> Image.Image:
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=422, detail={"code": "INVALID_IMAGE", "message": "Image is empty or too large", "details": {"max_bytes": MAX_IMAGE_BYTES}})
    try:
        image = Image.open(io.BytesIO(data))
        image.verify()
        return Image.open(io.BytesIO(data)).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=422, detail={"code": "INVALID_IMAGE", "message": "Unsupported or corrupt image", "details": None}) from exc


async def embed(image: Image.Image) -> list[float]:
    inputs = processor(images=image, return_tensors="pt")
    async with model_lock:
        with torch.inference_mode():
            vector = model.get_image_features(**inputs).squeeze(0).cpu().numpy().astype(np.float32)
    norm = float(np.linalg.norm(vector))
    if norm:
        vector /= norm
    return vector.tolist()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "model": MODEL_VERSION, "embedding_dimensions": 768}


@app.post("/v1/embed")
async def create_embedding(
    image: UploadFile = File(...),
    authorization: str | None = Header(default=None),
) -> dict:
    require_api_key(authorization)
    vector = await embed(decode_image(await image.read(MAX_IMAGE_BYTES + 1)))
    return {"embedding": vector, "dimensions": len(vector), "model": MODEL_VERSION}
