const DEFAULT_CORE_URL = "http://127.0.0.1:43121";
const DEFAULT_BRIDGE_URL = "http://127.0.0.1:43122";

export function coreUrl() {
  return loopbackUrl(process.env.LCOS_CORE_URL || DEFAULT_CORE_URL);
}

export function bridgeUrl() {
  return loopbackUrl(process.env.LCOS_BRIDGE_URL || DEFAULT_BRIDGE_URL);
}

export async function coreRequest(path, init = {}) {
  return requestJson(new URL(path, `${coreUrl()}/`), init);
}

export async function bridgeRequest(path, init = {}) {
  return requestJson(new URL(path, `${bridgeUrl()}/`), init);
}

export async function requestJson(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(init.body === undefined ? {} : init.body instanceof FormData ? {} : { "content-type": "application/json" }),
        ...init.headers,
      },
    });
    const value = await response.json().catch(() => ({ ok: false, error: { message: `HTTP ${response.status}` } }));
    if (!response.ok || value?.ok === false) {
      throw new Error(value?.error?.message || `HTTP ${response.status}`);
    }
    return value?.ok === true && "value" in value ? value.value : value;
  } finally {
    clearTimeout(timeout);
  }
}

export function jsonBody(value) {
  return { body: JSON.stringify(value) };
}

function loopbackUrl(value) {
  const url = new URL(value);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("LCOS agent tools only connect to loopback services.");
  }
  return url.origin;
}
