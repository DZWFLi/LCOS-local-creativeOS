(function (root, factory) {
  const api = factory()
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.LCOSLocalhostClient = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CORE_URL = 'http://127.0.0.1:43121'

  async function getExtensionToken() {
    const response = await fetch(`${CORE_URL}/runtime/extension-token`, { method: 'POST' })
    if (!response.ok) throw new Error(`LCOS 扩展令牌获取失败：${response.status}`)
    const body = await response.json()
    if (!body?.ok) throw new Error(body?.error?.message ?? 'LCOS 扩展令牌获取失败')
    return body.value.token
  }

  async function submitCapture(request) {
    const token = await getExtensionToken()
    const response = await fetch(`${CORE_URL}/capture/v1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-lcos-token': token },
      body: JSON.stringify(request),
    })
    const body = await response.json().catch(() => ({ ok: false, error: { message: `HTTP ${response.status}` } }))
    if (!response.ok || !body?.ok) {
      throw new Error(body?.error?.message ?? `捕获失败：HTTP ${response.status}`)
    }
    return body.value
  }

  return { CORE_URL, getExtensionToken, submitCapture }
})
