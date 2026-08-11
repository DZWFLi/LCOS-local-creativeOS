/**
 * LCOS Capture client：把 CaptureRequest 发到 Local Core（loopback only）。
 * token 来自 popup 配对（存 chrome.storage.local），Core 只接受 loopback + Bearer。
 */
const CORE_URL = "http://127.0.0.1:43121";
const CAPTURE_PATH = "/capture";

export async function getExtensionToken() {
  const stored = await chrome.storage.local.get({ lcosToken: "" });
  return stored.lcosToken;
}

export async function setExtensionToken(token) {
  await chrome.storage.local.set({ lcosToken: token });
}

export async function sendCapture(payload) {
  const token = await getExtensionToken();
  if (!token) throw new Error("LCOS 未配对：请打开扩展弹窗粘贴配对码");
  const response = await fetch(`${CORE_URL}${CAPTURE_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const value = await response.json().catch(() => ({ ok: false }));
  if (!response.ok || value?.ok === false) {
    throw new Error(value?.error?.message ?? `LCOS capture failed: ${response.status}`);
  }
  return value.value;
}

export function captureRequest({ kind, tab, payload, hints, sessionId }) {
  return {
    schemaVersion: 0,
    operationId: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    source: {
      app: "lcos-browser-extension",
      ...(tab?.url ? { url: tab.url } : {}),
      ...(tab?.title ? { title: tab.title } : {}),
      capturedAt: new Date().toISOString(),
      ...(sessionId ? { sessionId } : {}),
      ...(tab?.id !== undefined ? { browserProfileId: "default", browserTabId: tab.id } : {}),
    },
    payload,
    ...(hints && Object.keys(hints).length ? { hints } : {}),
  };
}
