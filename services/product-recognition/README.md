# Product recognition service

CPU SigLIP image-embedding service. The POS API stores normalized 768-dimension
embeddings in PostgreSQL/pgvector and performs tenant-scoped cosine search. The
service is stateless and never receives database credentials or the product catalog.

Required environment variables:

- `RECOGNITION_API_KEY`: shared secret used only between the POS API and this service.
- `MODEL_ID`: optional Hugging Face model id; defaults to `google/siglip-base-patch16-224`.
- `MODEL_VERSION`: optional stored version label used to re-index safely after model changes.

Run locally:

```sh
docker build -t pos-product-recognition services/product-recognition
docker run --rm -p 8080:8080 \
  -e RECOGNITION_API_KEY=replace-me \
  pos-product-recognition
```

`POST /v1/embed` accepts a JPEG/PNG/WebP multipart `image` and returns a unit
embedding. Keep the service private behind the shared bearer credential.
