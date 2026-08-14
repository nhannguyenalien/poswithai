# Product recognition service

CPU image-embedding service used by the POS API to match a captured image against
the tenant's existing product-image catalog. It is industry-neutral: results are
restricted to products supplied in the request rather than fixed retail classes.

Required environment variables:

- `RECOGNITION_API_KEY`: shared secret used only between the POS API and this service.
- `ALLOWED_IMAGE_HOSTS`: comma-separated HTTPS hosts from which catalog images may be fetched.

Run locally:

```sh
docker build -t pos-product-recognition services/product-recognition
docker run --rm -p 8080:8080 \
  -e RECOGNITION_API_KEY=replace-me \
  -e ALLOWED_IMAGE_HOSTS=s3a.schoolsai.work \
  pos-product-recognition
```
