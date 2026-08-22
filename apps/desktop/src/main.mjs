import { app, BrowserWindow, Menu, Tray, dialog, ipcMain, shell, nativeImage, screen } from 'electron'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import squirrelStartup from 'electron-squirrel-startup'

import { DesktopRuntimeSupervisor } from './runtime-supervisor.mjs'
import { startDesktopWebHost } from './static-host.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
if (process.platform === 'win32' && squirrelStartup) app.quit()

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

app.setName('LCOS')
if (process.platform === 'win32') app.setAppUserModelId('com.squirrel.LCOS.LCOS')

let windowRef
let captureWindowRef
let trayRef
let runtime
let webHost
let quitting = false
let trayUpdate = () => {}
let captureBoundsSaveTimer

function runtimeBundleRoot() {
  if (app.isPackaged) return join(process.resourcesPath, 'runtime')
  return resolve(__dirname, '..', 'resources', 'runtime')
}

function iconPath() {
  const candidates = [
    join(__dirname, '..', 'assets', 'lcos.ico'),
    join(__dirname, '..', 'assets', 'lcos.png'),
    join(__dirname, '..', 'assets', 'lcos.svg'),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

function captureWindowStatePath() {
  return join(app.getPath('userData'), 'capture-window-state-v1.json')
}

function defaultCaptureBounds(width, height) {
  const workArea = screen.getPrimaryDisplay().workArea
  return {
    x: Math.max(workArea.x, workArea.x + workArea.width - width - 22),
    y: Math.max(workArea.y, workArea.y + workArea.height - height - 22),
    width,
    height,
  }
}

function captureBoundsVisible(bounds) {
  const minimumVisible = 48
  return screen.getAllDisplays().some(({ workArea }) => {
    const overlapX = Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x)
    const overlapY = Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y)
    return overlapX >= minimumVisible && overlapY >= minimumVisible
  })
}

function initialCaptureBounds(width, height) {
  try {
    const stored = JSON.parse(readFileSync(captureWindowStatePath(), 'utf8'))
    const bounds = { x: Number(stored?.x), y: Number(stored?.y), width, height }
    if (Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && captureBoundsVisible(bounds)) return bounds
  } catch {}
  return defaultCaptureBounds(width, height)
}

function scheduleCaptureBoundsSave() {
  if (!captureWindowRef || captureWindowRef.isDestroyed()) return
  clearTimeout(captureBoundsSaveTimer)
  captureBoundsSaveTimer = setTimeout(() => {
    if (!captureWindowRef || captureWindowRef.isDestroyed()) return
    const { x, y } = captureWindowRef.getBounds()
    try { writeFileSync(captureWindowStatePath(), `${JSON.stringify({ schemaVersion: 1, x, y }, null, 2)}\n`, 'utf8') } catch {}
  }, 160)
}

function broadcastRuntimeStatus(value) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('desktop:runtime-status', value)
}

function broadcastCaptureReceived(value) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('desktop:capture-received', value)
}

function broadcastCaptureError(message) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('desktop:capture-error', { message })
}

function captureRequestFromDrop(item) {
  const capturedAt = new Date().toISOString()
  const operationId = `desktop-capture-${randomUUID()}`
  if (item?.kind === 'file' && typeof item.path === 'string' && item.path.trim()) {
    return {
      schemaVersion: 1, operationId, capturedAt,
      source: { kind: 'file', localPath: item.path, pageTitle: basename(item.path) },
      target: { mode: 'staging' },
      hints: { title: basename(item.path) },
    }
  }
  if (item?.kind === 'url' && typeof item.url === 'string' && /^https?:\/\//i.test(item.url.trim())) {
    const url = item.url.trim()
    return {
      schemaVersion: 1, operationId, capturedAt,
      source: { kind: 'link', sourceUrl: url, pageUrl: url, pageTitle: typeof item.title === 'string' ? item.title : url },
      target: { mode: 'staging' },
      hints: { title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : url },
    }
  }
  if (item?.kind === 'text' && typeof item.text === 'string' && item.text.trim()) {
    const text = item.text.trim()
    return {
      schemaVersion: 1, operationId, capturedAt,
      source: { kind: 'text', pageTitle: typeof item.title === 'string' ? item.title : '桌面捕获文字' },
      content: { text },
      target: { mode: 'staging' },
      hints: { title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : text.split(/\r?\n/).find(Boolean)?.slice(0, 72) ?? '桌面捕获文字' },
    }
  }
  throw new Error('Unsupported Capture Float payload.')
}

async function enqueueCaptureDrop(input) {
  if (!runtime?.token) throw new Error('LCOS Runtime is not ready.')
  const items = Array.isArray(input?.items) ? input.items.slice(0, 64) : []
  if (!items.length) throw new Error('Capture Float did not receive any usable material.')
  const results = []
  for (const item of items) {
    const request = captureRequestFromDrop(item)
    const response = await fetch('http://127.0.0.1:43121/runtime/capture-space/enqueue', {
      method: 'POST',
      headers: { authorization: `Bearer ${runtime.token}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(request),
    })
    const body = await response.json().catch(() => undefined)
    if (!response.ok || !body?.ok) throw new Error(body?.error?.message ?? `Capture failed with HTTP ${response.status}.`)
    results.push(body.value)
  }
  const value = { count: results.length, capturedAt: new Date().toISOString(), results }
  broadcastCaptureReceived(value)
  return value
}

function createTray() {
  const icon = iconPath()
  const image = icon ? nativeImage.createFromPath(icon) : nativeImage.createEmpty()
  trayRef = new Tray(image)
  trayRef.setToolTip('LCOS')
  const update = () => {
    const status = runtime?.status()
    const menu = Menu.buildFromTemplate([
      { label: '打开 LCOS', click: () => showMainWindow() },
      { label: '打开 Capture Space', click: () => openCaptureSpace() },
      { label: captureWindowRef?.isVisible() ? '隐藏 Capture 悬浮窗' : '显示 Capture 悬浮窗', click: () => toggleCaptureWindow() },
      { label: `Runtime · Core ${status?.core ?? 'unknown'} / Bridge ${status?.bridge ?? 'unknown'}`, enabled: false },
      { label: `Codex · ${status?.codexIntegration === 'configured' ? '已连接' : '待连接'}`, enabled: false },
      { type: 'separator' },
      { label: status?.codexIntegration === 'configured' ? '修复 Codex 连接' : '连接 Codex', click: async () => {
        try {
          await runtime?.installCodexIntegration()
          dialog.showMessageBox(windowRef, { type: 'info', title: 'LCOS', message: 'Codex 连接已配置。', detail: 'LCOS 已备份并更新受管理的 MCP / Skill 配置。' })
        } catch (error) {
          dialog.showErrorBox('Codex 连接失败', error instanceof Error ? error.message : String(error))
        }
      } },
      { label: '重启 Runtime', click: async () => {
        try { await runtime?.restart() } catch (error) { dialog.showErrorBox('LCOS Runtime 重启失败', error instanceof Error ? error.message : String(error)) }
      } },
      { label: '打开日志目录', click: () => shell.openPath(join(app.getPath('userData'), 'logs')) },
      { type: 'separator' },
      { label: '完全退出', click: async () => {
        quitting = true
        await runtime?.stop().catch(() => {})
        await webHost?.close().catch(() => {})
        app.quit()
      } },
    ])
    trayRef?.setContextMenu(menu)
  }
  trayRef.on('double-click', () => showMainWindow())
  update()
  return update
}

function createMainWindow(url) {
  const win = new BrowserWindow({
    title: 'LCOS',
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: '#f7f7f6',
    ...(iconPath() ? { icon: iconPath() } : {}),
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  })
  win.setMenuBarVisibility(false)
  win.once('ready-to-show', () => win.show())
  win.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    win.hide()
  })
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/i.test(target)) void shell.openExternal(target)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(url)) {
      event.preventDefault()
      if (/^https?:/i.test(target)) void shell.openExternal(target)
    }
  })
  windowRef = win
  return win.loadURL(url)
}

function createCaptureWindow(url) {
  const width = 304
  const height = 150
  const bounds = initialCaptureBounds(width, height)
  const win = new BrowserWindow({
    title: 'LCOS Capture',
    width, height, minWidth: width, minHeight: height,
    x: bounds.x,
    y: bounds.y,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#f8f8f7',
    ...(iconPath() ? { icon: iconPath() } : {}),
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  })
  win.setMenuBarVisibility(false)
  win.setAlwaysOnTop(true, 'floating')
  win.once('ready-to-show', () => win.showInactive())
  win.on('moved', scheduleCaptureBoundsSave)
  win.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    win.hide()
    trayUpdate()
  })
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/i.test(target)) void shell.openExternal(target)
    return { action: 'deny' }
  })
  const target = new URL(url)
  target.searchParams.set('surface', 'capture-float')
  captureWindowRef = win
  return win.loadURL(target.toString())
}

function showCaptureWindow() {
  if (!captureWindowRef || captureWindowRef.isDestroyed()) return
  captureWindowRef.showInactive()
  trayUpdate()
}

function hideCaptureWindow() {
  if (!captureWindowRef || captureWindowRef.isDestroyed()) return
  captureWindowRef.hide()
  trayUpdate()
}

function toggleCaptureWindow() {
  if (captureWindowRef?.isVisible()) hideCaptureWindow()
  else showCaptureWindow()
}

function openCaptureSpace() {
  showMainWindow()
  windowRef?.webContents.send('desktop:open-capture-space')
}

function showMainWindow() {
  if (!windowRef || windowRef.isDestroyed()) return
  if (windowRef.isMinimized()) windowRef.restore()
  windowRef.show()
  windowRef.focus()
}

app.on('second-instance', () => showMainWindow())
app.on('activate', () => showMainWindow())
app.on('before-quit', () => { quitting = true })
app.on('window-all-closed', (event) => {
  event?.preventDefault?.()
})

ipcMain.handle('desktop:get-app-info', () => ({
  name: app.getName(),
  version: app.getVersion(),
  packaged: app.isPackaged,
  platform: process.platform,
}))
ipcMain.handle('desktop:get-runtime-status', () => runtime?.status() ?? null)
ipcMain.handle('desktop:restart-runtime', async () => runtime?.restart())
ipcMain.handle('desktop:install-codex-integration', async () => runtime?.installCodexIntegration())
ipcMain.handle('desktop:select-directory', async (_event, input) => {
  const result = await dialog.showOpenDialog(windowRef, {
    title: typeof input?.title === 'string' ? input.title : '选择文件夹',
    properties: ['openDirectory', 'createDirectory'],
  })
  return result.canceled || !result.filePaths[0] ? { cancelled: true } : { cancelled: false, path: result.filePaths[0] }
})
ipcMain.handle('desktop:show-item-in-folder', (_event, input) => {
  if (typeof input?.path !== 'string' || !input.path) return false
  shell.showItemInFolder(input.path)
  return true
})
ipcMain.handle('desktop:capture-drop', async (_event, input) => enqueueCaptureDrop(input))
ipcMain.on('desktop:capture-drop-error', (_event, message) => broadcastCaptureError(typeof message === 'string' ? message : 'Capture failed.'))
ipcMain.handle('desktop:open-capture-space', async () => { openCaptureSpace() })
ipcMain.handle('desktop:show-capture-float', async () => { showCaptureWindow() })
ipcMain.handle('desktop:hide-capture-float', async () => { hideCaptureWindow() })

void app.whenReady().then(async () => {
  try {
  const userData = app.getPath('userData')
  runtime = new DesktopRuntimeSupervisor({
    runtimeBundleRoot: runtimeBundleRoot(),
    userDataRoot: join(userData, 'runtime'),
    logRoot: join(userData, 'logs'),
    onStatus: (value) => {
      broadcastRuntimeStatus(value)
      trayUpdate()
    },
  })
  await runtime.start()
  webHost = await startDesktopWebHost({
    webRoot: join(runtimeBundleRoot(), 'web'),
    corePort: 43121,
    token: runtime.token,
  })
  await createMainWindow(webHost.url)
  await createCaptureWindow(webHost.url)
  trayUpdate = createTray()
  const setupPromptMarker = join(userData, 'codex-setup-prompted-v1')
  if (runtime.status().codexIntegration !== 'configured' && !existsSync(setupPromptMarker)) {
    const response = await dialog.showMessageBox(windowRef, {
      type: 'info',
      title: '连接 Codex',
      message: '让 LCOS 接管本地 Agent 执行？',
      detail: 'LCOS 会先备份 Codex 配置，再安装自己管理的 MCP 与 Skills。你也可以稍后从托盘菜单执行。',
      buttons: ['连接 Codex', '稍后'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    })
    writeFileSync(setupPromptMarker, `${new Date().toISOString()}\n`, 'utf8')
    if (response.response === 0) {
      try { await runtime.installCodexIntegration() }
      catch (setupError) { dialog.showErrorBox('Codex 连接失败', setupError instanceof Error ? setupError.message : String(setupError)) }
    }
  }
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    dialog.showErrorBox('LCOS 启动失败', message)
    quitting = true
    await runtime?.stop().catch(() => {})
    await webHost?.close().catch(() => {})
    app.quit()
  }
})
