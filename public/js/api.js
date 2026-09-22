import { getAuthHeaders, clearSession } from "./auth.js";

const BASE = "";

async function request(method, path, body, extraHeaders = {}) {
  const opts = { method, headers: { ...getAuthHeaders(), ...extraHeaders } };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);

  if (res.status === 401) {
    clearSession();
    window.location.href = "/login.html";
    return;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail = Array.isArray(data.details)
      ? data.details.map(item => item?.message).filter(Boolean).join("; ")
      : "";
    throw new Error([data.error || `Lỗi ${res.status}`, detail].filter(Boolean).join(": "));
  }

  return data;
}

async function upload(path, formData) {
  const res = await fetch(BASE + path, { method: "POST", headers: getAuthHeaders(), body: formData });
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login.html";
    return;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Lỗi ${res.status}`);
  return data;
}

const pendingMutationKeys = new Map();

async function idempotentPost(path, body) {
  if (path !== "/api/orders" && path !== "/api/payments" && path !== "/api/inventory") {
    return request("POST", path, body);
  }
  const fingerprint = `${path}:${JSON.stringify(body)}`;
  const key = pendingMutationKeys.get(fingerprint) || crypto.randomUUID();
  pendingMutationKeys.set(fingerprint, key);
  try {
    const result = await request("POST", path, body, { "Idempotency-Key": key });
    pendingMutationKeys.delete(fingerprint);
    return result;
  } catch (error) {
    // HTTP errors are definitive; only retain the key when fetch itself failed so a retry
    // can safely retrieve the already-committed response from the server.
    if (!(error instanceof TypeError)) pendingMutationKeys.delete(fingerprint);
    throw error;
  }
}

export const api = {
  get:    (path)        => request("GET",    path),
  post:   (path, body)  => idempotentPost(path, body),
  put:    (path, body)  => request("PUT",    path, body),
  delete: (path)        => request("DELETE", path),
  upload,
};
