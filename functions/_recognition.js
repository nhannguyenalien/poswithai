const RECOGNITION_TIMEOUT_MS = 25_000;

export async function createImageEmbedding(env, bytes, filename, mimeType) {
  if (!env.PRODUCT_RECOGNITION_URL || !env.PRODUCT_RECOGNITION_API_KEY) {
    throw new Error("PRODUCT_RECOGNITION_NOT_CONFIGURED");
  }
  const body = new FormData();
  body.set("image", new File([bytes], filename || "image.jpg", { type: mimeType }));
  const response = await fetch(`${String(env.PRODUCT_RECOGNITION_URL).replace(/\/$/, "")}/v1/embed`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.PRODUCT_RECOGNITION_API_KEY}` },
    body,
    signal: AbortSignal.timeout(RECOGNITION_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`PRODUCT_RECOGNITION_HTTP_${response.status}`);
  const result = await response.json();
  if (!Array.isArray(result.embedding) || result.embedding.length !== 768 || !result.embedding.every(Number.isFinite)) {
    throw new Error("PRODUCT_RECOGNITION_INVALID_EMBEDDING");
  }
  return { embedding: result.embedding, model: String(result.model || "") };
}

export function vectorLiteral(values) {
  if (!Array.isArray(values) || !values.length || !values.every(Number.isFinite)) {
    throw new TypeError("Embedding must contain only finite numbers");
  }
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}
