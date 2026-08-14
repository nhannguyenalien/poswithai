import asyncio
import hashlib
import hmac
import io
import json
import os
from collections import OrderedDict
from urllib.parse import urlparse

import httpx
import numpy as np
import torch
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small

MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))
MAX_CATALOG_SIZE = int(os.getenv("MAX_CATALOG_SIZE", "500"))
MAX_CACHE_SIZE = int(os.getenv("MAX_CACHE_SIZE", "2000"))
MIN_SCORE = float(os.getenv("MIN_SCORE", "0.35"))
API_KEY = os.getenv("RECOGNITION_API_KEY", "")
ALLOWED_IMAGE_HOSTS = {
    value.strip().lower()
    for value in os.getenv("ALLOWED_IMAGE_HOSTS", "s3a.schoolsai.work").split(",")
    if value.strip()
}

weights = MobileNet_V3_Small_Weights.DEFAULT
model = mobilenet_v3_small(weights=weights)
model.classifier = torch.nn.Identity()
model.eval()
preprocess = weights.transforms()
embedding_cache: OrderedDict[str, np.ndarray] = OrderedDict()
model_lock = asyncio.Lock()

app = FastAPI(title="POS Product Recognition", version="1.0.0")


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


async def embed(image: Image.Image) -> np.ndarray:
    tensor = preprocess(image).unsqueeze(0)
    async with model_lock:
        with torch.inference_mode():
            vector = model(tensor).squeeze(0).cpu().numpy().astype(np.float32)
    norm = float(np.linalg.norm(vector))
    return vector / norm if norm else vector


def validate_catalog(raw: str) -> list[dict]:
    try:
        catalog = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail={"code": "INVALID_CATALOG", "message": "Catalog must be valid JSON", "details": None}) from exc
    if not isinstance(catalog, list) or len(catalog) > MAX_CATALOG_SIZE:
        raise HTTPException(status_code=422, detail={"code": "INVALID_CATALOG", "message": "Catalog size is invalid", "details": {"max_items": MAX_CATALOG_SIZE}})
    clean = []
    for item in catalog:
        if not isinstance(item, dict) or not item.get("product_id") or not item.get("image_url"):
            continue
        parsed = urlparse(str(item["image_url"]))
        if parsed.scheme != "https" or parsed.hostname not in ALLOWED_IMAGE_HOSTS:
            continue
        clean.append({"product_id": str(item["product_id"]), "image_url": str(item["image_url"])})
    return clean


async def catalog_embedding(client: httpx.AsyncClient, item: dict) -> np.ndarray | None:
    cache_key = hashlib.sha256(item["image_url"].encode()).hexdigest()
    cached = embedding_cache.get(cache_key)
    if cached is not None:
        embedding_cache.move_to_end(cache_key)
        return cached
    try:
        response = await client.get(item["image_url"])
        response.raise_for_status()
        if len(response.content) > MAX_IMAGE_BYTES:
            return None
        vector = await embed(decode_image(response.content))
    except (httpx.HTTPError, HTTPException):
        return None
    embedding_cache[cache_key] = vector
    embedding_cache.move_to_end(cache_key)
    while len(embedding_cache) > MAX_CACHE_SIZE:
        embedding_cache.popitem(last=False)
    return vector


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "model": "mobilenet_v3_small", "cache_items": len(embedding_cache)}


@app.post("/v1/recognize")
async def recognize(
    image: UploadFile = File(...),
    tenant_id: str = Form(...),
    catalog: str = Form(...),
    top_k: int = Form(5),
    authorization: str | None = Header(default=None),
) -> dict:
    require_api_key(authorization)
    if not tenant_id.strip():
        raise HTTPException(status_code=422, detail={"code": "INVALID_TENANT", "message": "tenant_id is required", "details": None})
    items = validate_catalog(catalog)
    query_vector = await embed(decode_image(await image.read(MAX_IMAGE_BYTES + 1)))
    timeout = httpx.Timeout(10.0, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        vectors = await asyncio.gather(*(catalog_embedding(client, item) for item in items))
    candidates = []
    for item, vector in zip(items, vectors):
        if vector is None:
            continue
        score = float(np.dot(query_vector, vector))
        if score >= MIN_SCORE:
            candidates.append({"product_id": item["product_id"], "score": round(score, 6)})
    candidates.sort(key=lambda value: value["score"], reverse=True)
    return {"tenant_id": tenant_id, "candidates": candidates[: max(1, min(top_k, 10))], "model": "mobilenet_v3_small"}
