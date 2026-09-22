const base = process.env.BASE_URL;
if (!base) throw new Error("Set BASE_URL to dev/staging API origin");
const headers = process.env.API_TOKEN ? { Authorization: `Bearer ${process.env.API_TOKEN}` } : {};
const checks = [["/api/health", 200], ["/api/products?limit=1", process.env.API_TOKEN ? 200 : 401]];
for (const [path, expected] of checks) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const response = await fetch(base + path, { headers, signal: controller.signal });
  clearTimeout(timeout);
  if (response.status !== expected) throw new Error(`${path}: expected ${expected}, got ${response.status}`);
  if (!response.headers.get("x-request-id")) throw new Error(`${path}: missing X-Request-ID`);
  console.log(`PASS ${path} ${response.status}`);
}
