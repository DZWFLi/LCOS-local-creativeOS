#!/usr/bin/env node
// S0 census-desktop：机器提取 Desktop（Electron）能力面。
// 锚点（S0-1 摸底实测）：apps/desktop/src/main.mjs（BrowserWindow/Tray/ipcMain.handle）
//   + preload.mjs（ipcRenderer.invoke 桥面）+ runtime-supervisor.mjs（运行时托管）。
// Floating Companion 正式 Runtime Projection contract 缺口（S4）由「无 projection 契约文件」如实登记。
import { existsSync } from 'node:fs'
import { listFiles, readText, repoPath } from './census-shared.mjs'

const DESKTOP_MAIN = 'apps/desktop/src/main.mjs'
const DESKTOP_PRELOAD = 'apps/desktop/src/preload.mjs'
const RUNTIME_SUPERVISOR = 'apps/desktop/src/runtime-supervisor.mjs'

export function censusDesktop() {
  const mainSource = readText(DESKTOP_MAIN)
  const preloadSource = readText(DESKTOP_PRELOAD)
  const supervisorPresent = existsSync(repoPath(RUNTIME_SUPERVISOR))

  // 窗口：提取包含 new BrowserWindow 的函数名（源码顺序）
  const windows = []
  const functionPattern = /(?:async )?function (\w+)\(/g
  const functions = []
  let match
  while ((match = functionPattern.exec(mainSource)) !== null) {
    functions.push({ name: match[1], index: match.index })
  }
  for (const match of mainSource.matchAll(/new BrowserWindow\(/g)) {
    const owner = [...functions].reverse().find((fn) => fn.index < match.index)
    windows.push({ creationSite: owner?.name ?? null })
  }

  // IPC 面：主进程 handle 通道 + preload invoke 通道
  const mainChannels = [...mainSource.matchAll(/ipcMain\.handle\(['"]([^'"]+)['"]/g)].map((m) => m[1])
  const preloadChannels = [...preloadSource.matchAll(/ipcRenderer\.invoke\(['"]([^'"]+)['"]/g)].map((m) => m[1])

  // 主进程向 renderer 推送的事件面
  const pushEvents = [...mainSource.matchAll(/send\(['"]([^'"]+)['"]/g)].map((m) => m[1])

  const projectionContractFiles = listFiles('apps/desktop/src', { recursive: true, extension: '.ts' })
    .filter((file) => file.toLowerCase().includes('projection'))

  return {
    source: {
      main: DESKTOP_MAIN,
      preload: DESKTOP_PRELOAD,
      runtimeSupervisor: RUNTIME_SUPERVISOR,
    },
    windows: {
      browserWindowCreationSites: windows,
      trayPresent: /new Tray\(/.test(mainSource),
    },
    ipc: {
      mainHandleChannels: [...new Set(mainChannels)].sort(),
      preloadInvokeChannels: [...new Set(preloadChannels)].sort(),
      mainPushEvents: [...new Set(pushEvents)].sort(),
    },
    runtimeSupervisor: {
      present: supervisorPresent,
    },
    companionRuntimeProjection: {
      contractFiles: projectionContractFiles,
      note: projectionContractFiles.length === 0
        ? 'desktop 无独立 Runtime Projection 契约文件——S4 Companion Runtime Projection 缺口如实登记'
        : '存在 projection 契约文件',
    },
  }
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('census-desktop.mjs')) {
  console.log(JSON.stringify(censusDesktop(), null, 2))
}
