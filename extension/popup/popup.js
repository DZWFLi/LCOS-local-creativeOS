const { buildCaptureRequestV1 } = globalThis.LCOSCaptureMessage
const { submitCapture } = globalThis.LCOSLocalhostClient

let kind = 'page'
document.querySelectorAll('.kinds button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.kinds button').forEach((item) => item.classList.remove('active'))
    button.classList.add('active')
    kind = button.dataset.kind
  })
})

const status = document.getElementById('status')
const capture = document.getElementById('capture')

async function blobToDataUrl(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function readClipboardImage() {
  if (!navigator.clipboard?.read) return null
  const items = await navigator.clipboard.read()
  for (const item of items) {
    const type = item.types.find((entry) => entry.startsWith('image/'))
    if (!type) continue
    const blob = await item.getType(type)
    return await blobToDataUrl(blob)
  }
  return null
}

capture.addEventListener('click', async () => {
  capture.disabled = true
  status.textContent = '捕获中…'
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const mode = 'staging'
    if (kind === 'screenshot') {
      const response = await chrome.runtime.sendMessage({ type: 'LCOS_CAPTURE_TAB', kind: 'screenshot', mode, tabId: tab.id, windowId: tab.windowId })
      finish(response)
      return
    }
    if (kind === 'clipboard') {
      const dataUrl = await readClipboardImage()
      if (!dataUrl) {
        status.textContent = '剪贴板里没有图片（先用 Snipaste 截图）'
        capture.disabled = false
        return
      }
      const request = buildCaptureRequestV1({ kind: 'screenshot', dataUrl, mode, title: '剪贴板截图' })
      const result = await submitCapture(request)
      finish({ ok: true, destinationLabel: result.destinationLabel, destination: result.destination })
      return
    }
    if (kind === 'selection') {
      let reply
      try {
        reply = await chrome.tabs.sendMessage(tab.id, { type: 'LCOS_GET_SELECTION' })
      } catch {
        status.textContent = '扩展未注入：请先刷新网页（Ctrl+F5）再试'
        capture.disabled = false
        return
      }
      const selectionText = reply?.ok ? reply.text : ''
      if (!selectionText) {
        status.textContent = '先在页面上选中文字，再点捕获'
        capture.disabled = false
        return
      }
      const request = buildCaptureRequestV1({
        kind: 'selection',
        pageUrl: tab.url, pageTitle: tab.title,
        text: selectionText,
        mode,
      })
      const result = await submitCapture(request)
      finish({ ok: true, destinationLabel: result.destinationLabel, destination: result.destination })
      return
    }
    const request = buildCaptureRequestV1({
      kind: 'page',
      pageUrl: tab.url, pageTitle: tab.title,
      mode,
      title: tab.title,
    })
    const result = await submitCapture(request)
    finish({ ok: true, destinationLabel: result.destinationLabel, destination: result.destination })
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : '捕获失败'
    capture.disabled = false
  }
})

function finish(response) {
  capture.disabled = false
  if (!response?.ok) { status.textContent = response?.error ?? '捕获失败'; return }
  status.textContent = `已捕获 → ${response.destinationLabel}`
}
