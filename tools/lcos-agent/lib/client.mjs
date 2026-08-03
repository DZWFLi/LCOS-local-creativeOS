import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_CORE_URL = "http://127.0.0.1:43121";
const DEFAULT_BRIDGE_URL = "http://127.0.0.1:43122";

export function coreUrl() {
  return loopbackUrl(process.env.LCOS_CORE_URL || DEFAULT_CORE_URL);
}

export function bridgeUrl() {
  return loopbackUrl(process.env.LCOS_BRIDGE_URL || DEFAULT_BRIDGE_URL);
}

export async function coreRequest(path, init = {}) {
  const token = coreToken();
  return requestJson(new URL(path, `${coreUrl()}/`), {
    ...init,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

function coreToken() {
  if (process.env.LOCAL_CORE_API_TOKEN) return process.env.LOCAL_CORE_API_TOKEN;
  try {
    return readFileSync(join(process.cwd(), ".codex-runtime", "local-core-token"), "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function bridgeRequest(path, init = {}) {
  return requestJson(new URL(path, `${bridgeUrl()}/`), init);
}

export async function requestJson(url, init = {}) {
  const controller = new AbortController();
  const { timeoutMs = 10_000, ...requestInit } = init;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...requestInit,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(requestInit.body === undefined ? {} : requestInit.body instanceof FormData ? {} : { "content-type": "application/json" }),
        ...requestInit.headers,
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
