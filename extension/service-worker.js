importScripts('shared/capture-message.js', 'shared/localhost-client.js')

const { buildCaptureRequestV1, validateCaptureRequest } = globalThis.LCOSCaptureMessage
const { submitCapture } = globalThis.LCOSLocalhostClient

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'lcos-capture-image', title: '捕获图片到 LCOS', contexts: ['image'] }, () => void chrome.runtime.lastError)
  chrome.contextMenus.create({ id: 'lcos-capture-link', title: '捕获链接到 LCOS', contexts: ['link'] }, () => void chrome.runtime.lastError)
  chrome.contextMenus.create({ id: 'lcos-capture-selection', title: '捕获选区到 LCOS', contexts: ['selection'] }, () => void chrome.runtime.lastError)
})

async function captureFromTab({ kind, tabId, pageUrl, pageTitle, sourceUrl, text, dataUrl, mode }) {
  const tab = await chrome.tabs.get(tabId).catch(() => null)
  const request = buildCaptureRequestV1({
    kind,
    pageUrl: pageUrl ?? tab?.url,
    pageTitle: pageTitle ?? tab?.title,
    sourceUrl,
    text,
    dataUrl,
    mode,
  })
  const result = await submitCapture(request)
  return { ok: true, destinationLabel: result.destinationLabel, destination: result.destination }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'LCOS_CAPTURE_SUBMIT') return
  void (async () => {
    try {
      const payload = message.payload
      validateCaptureRequest(payload)
      const result = await submitCapture(payload)
      sendResponse({ ok: true, destinationLabel: result.destinationLabel, destination: result.destination })
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })()
  return true
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'LCOS_CAPTURE_TAB') return
  void (async () => {
    try {
      const tabId = sender.tab?.id ?? message.tabId
      if (message.kind === 'screenshot') {
        const windowId = message.windowId ?? sender.tab?.windowId ?? (await chrome.tabs.get(tabId)).windowId
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
        sendResponse(await captureFromTab({ kind: 'screenshot', tabId, dataUrl, mode: message.mode }))
        return
      }
      sendResponse(await captureFromTab({ kind: message.kind, tabId, pageUrl: message.pageUrl, pageTitle: message.pageTitle, sourceUrl: message.sourceUrl, text: message.text, dataUrl: message.dataUrl, mode: message.mode }))
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })()
  return true
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const kind = info.menuItemId === 'lcos-capture-image' ? 'image' : info.menuItemId === 'lcos-capture-link' ? 'link' : 'selection'
  const sourceUrl = kind === 'image' ? info.srcUrl : kind === 'link' ? info.linkUrl : undefined
  void captureFromTab({ kind, tabId: tab?.id, sourceUrl, text: kind === 'selection' ? info.selectionText : undefined, mode: 'staging' })
})
