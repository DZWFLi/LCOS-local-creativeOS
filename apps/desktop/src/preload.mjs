import { contextBridge, ipcRenderer, webUtils } from 'electron'

function isCaptureFloatSurface() {
  try { return new URLSearchParams(globalThis.location?.search ?? '').get('surface') === 'capture-float' }
  catch { return false }
}

function textDropItem(dataTransfer) {
  const uriList = dataTransfer.getData('text/uri-list')
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value && !value.startsWith('#'))
  if (uriList && /^https?:\/\//i.test(uriList)) return { kind: 'url', url: uriList }
  const text = dataTransfer.getData('text/plain').trim()
  if (!text) return null
  if (/^https?:\/\/\S+$/i.test(text)) return { kind: 'url', url: text }
  return { kind: 'text', text }
}

if (isCaptureFloatSurface()) {
  globalThis.addEventListener('dragover', (event) => {
    event.preventDefault()
  }, true)
  globalThis.addEventListener('drop', (event) => {
    event.preventDefault()
    const dataTransfer = event.dataTransfer
    if (!dataTransfer) return
    const files = [...dataTransfer.files]
      .map((file) => {
        try {
          const path = webUtils.getPathForFile(file)
          return path ? { kind: 'file', path } : null
        } catch {
          return null
        }
      })
      .filter(Boolean)
    const items = files.length ? files : [textDropItem(dataTransfer)].filter(Boolean)
    if (!items.length) return
    void ipcRenderer.invoke('desktop:capture-drop', { items }).catch((error) => {
      ipcRenderer.send('desktop:capture-drop-error', error instanceof Error ? error.message : String(error))
    })
  }, true)
}

const api = Object.freeze({
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke('desktop:get-app-info'),
  getRuntimeStatus: () => ipcRenderer.invoke('desktop:get-runtime-status'),
  restartRuntime: () => ipcRenderer.invoke('desktop:restart-runtime'),
  installCodexIntegration: () => ipcRenderer.invoke('desktop:install-codex-integration'),
  selectDirectory: (title) => ipcRenderer.invoke('desktop:select-directory', { title }),
  showItemInFolder: (path) => ipcRenderer.invoke('desktop:show-item-in-folder', { path }),
  openCaptureSpace: () => ipcRenderer.invoke('desktop:open-capture-space'),
  showCaptureFloat: () => ipcRenderer.invoke('desktop:show-capture-float'),
  hideCaptureFloat: () => ipcRenderer.invoke('desktop:hide-capture-float'),
  onCaptureReceived: (listener) => {
    const handler = (_event, value) => listener(value)
    ipcRenderer.on('desktop:capture-received', handler)
    return () => ipcRenderer.removeListener('desktop:capture-received', handler)
  },
  onCaptureError: (listener) => {
    const handler = (_event, value) => listener(value)
    ipcRenderer.on('desktop:capture-error', handler)
    return () => ipcRenderer.removeListener('desktop:capture-error', handler)
  },
  onOpenCaptureSpace: (listener) => {
    const handler = () => listener()
    ipcRenderer.on('desktop:open-capture-space', handler)
    return () => ipcRenderer.removeListener('desktop:open-capture-space', handler)
  },
  onRuntimeStatus: (listener) => {
    const handler = (_event, value) => listener(value)
    ipcRenderer.on('desktop:runtime-status', handler)
    return () => ipcRenderer.removeListener('desktop:runtime-status', handler)
  },
})

contextBridge.exposeInMainWorld('lcosDesktop', api)
