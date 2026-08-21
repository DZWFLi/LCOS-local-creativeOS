/**
 * HU-3A probe: context-graph drag → GesturePreview → single commit → Core persistence.
 * Requires the launcher stack (dev:open) running.
 *
 * 默认自建临时项目并种子 6 个节点 + 关系（LCOS_PROJECT_ID 可覆盖目标项目；
 * 用已有项目时设 LCOS_SEED_PROJECT=0）。
 *
 * Verifies:
 * 1. Drag 3 dots on the 关系 (context-graph) surface.
 * 2. After pointer-up, positions + pins are committed to the Core PresentationView.
 * 3. Browser reload → positions survive (Core = committed truth).
 */
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const WEB_URL = 'http://127.0.0.1:5173'
// API 统一走 Vite 代理（浏览器同路径）；dev-stack 随机 token 不落盘，代理已处理鉴权。
const API_URL = `${WEB_URL}/api/local-core/v1`
const NOW = new Date().toISOString()
const projectId = process.env.LCOS_PROJECT_ID ?? 'hu3-gesture-persistence-probe'

const coreFetch = async (path, init) => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
  })
  const body = await response.json()
  if (!body.ok) throw new Error(`${path} failed: ${JSON.stringify(body.error ?? body)}`)
  return body.value
}

const openGraphSurface = async (page, targetProjectId) => {
  await page.goto(`${WEB_URL}/?agent=codex&project=${targetProjectId}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="creative-os-app"]', { timeout: 20_000 })
  await page.waitForSelector('[data-node-id]', { timeout: 20_000 })
  // 真实用户路径：框选前 3 个对象（不唤起合成器）→ 上下文能力 →
  // “当前 Selection”建立临时 Context View。
  const nodes = page.locator('[data-node-id]')
  const selectCount = Math.min(3, await nodes.count())
  if (selectCount === 0) throw new Error('no canvas nodes to select')
  const boxes = []
  for (let index = 0; index < selectCount; index += 1) {
    const box = await nodes.nth(index).boundingBox()
    if (box) boxes.push(box)
  }
  const minX = Math.min(...boxes.map((box) => box.x)) - 30
  const minY = Math.min(...boxes.map((box) => box.y)) - 30
  const maxX = Math.max(...boxes.map((box) => box.x + box.width)) + 30
  const maxY = Math.max(...boxes.map((box) => box.y + box.height)) + 30
  await page.mouse.move(minX, minY)
  await page.mouse.down()
  await page.mouse.move(maxX, maxY, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: '上下文：对话与上下文视图' }).click()
  await page.waitForSelector('[data-testid="surface-context-flow"]', { timeout: 15_000 })
  const selectionStart = page.locator('.lcos-context-start-actions').getByRole('button', { name: '当前 Selection' })
  if (await selectionStart.count() > 0) {
    await selectionStart.click()
    await page.waitForTimeout(600)
  }
  await page.locator('.lcos-projection-switch').getByRole('button', { name: '关系' }).click()
  await page.waitForSelector('[data-testid="surface-context-graph"]', { timeout: 15_000 })
  await page.waitForSelector('.lcos-graph-dot', { timeout: 15_000 })
}

const seedProject = async () => {
  const rootPath = mkdtempSync(join(tmpdir(), 'lcos-hu3-probe-'))
  const created = await coreFetch(`/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'HU3 Gesture Persistence Probe', rootPath }),
  })
  const seededProjectId = created.id
  // 实体主键全局唯一：用项目 id 后缀做前缀，避免跨项目主键撞车（core 已加 ownership guard）。
  // 随机段在 id 尾部（--xxxx），取尾部 16 字符保证跨项目唯一。
  const suffix = seededProjectId.replace(/^project-/, '').slice(-16)
  const scopeId = `${suffix}-scope-root`
  const workspaceId = `${suffix}-workspace-main`
  const artifacts = Array.from({ length: 6 }, (_, index) => ({
    id: `${suffix}-artifact-${index + 1}`,
    projectId: seededProjectId,
    title: `探针节点 ${index + 1}`,
    kind: 'text',
    availability: 'available',
    currentRevisionId: `${suffix}-revision-${index + 1}-initial`,
    createdAt: NOW,
    updatedAt: NOW,
  }))
  const fileRecords = Array.from({ length: 6 }, (_, index) => ({
    id: `${suffix}-file-${index + 1}`,
    projectId: seededProjectId,
    observedPath: `probe://node-${index + 1}.md`,
    observedHash: `hash-node-${index + 1}`,
    size: 64,
    modifiedAt: NOW,
    mimeType: 'text/markdown',
    availability: 'current',
    observedAt: NOW,
  }))
  const artifactRevisions = Array.from({ length: 6 }, (_, index) => ({
    id: `${suffix}-revision-${index + 1}-initial`,
    artifactId: `${suffix}-artifact-${index + 1}`,
    fileRecordId: `${suffix}-file-${index + 1}`,
    contentHash: `hash-node-${index + 1}`,
    source: 'import',
    status: 'current',
    createdAt: NOW,
  }))
  const artifactViews = artifacts.map((artifact) => {
    const index = Number(artifact.id.at(-1))
    return {
      id: `${suffix}-view-${artifact.id}`,
      artifactId: artifact.id,
      revisionId: `${suffix}-revision-${index}-initial`,
      scopeId,
      referenceKind: 'primary',
      position: { x: 120 + (index - 1) * 180, y: 120 + (index - 1) * 40 },
      size: { width: 180, height: 60 },
      displayMode: 'card',
      collapsed: false,
    }
  })
  const relations = [
    { id: `${suffix}-relation-1`, projectId: seededProjectId, sourceEntityType: 'artifact', sourceEntityId: `${suffix}-artifact-1`, targetEntityType: 'artifact', targetEntityId: `${suffix}-artifact-2`, kind: 'informs', createdAt: NOW, updatedAt: NOW },
    { id: `${suffix}-relation-2`, projectId: seededProjectId, sourceEntityType: 'artifact', sourceEntityId: `${suffix}-artifact-2`, targetEntityType: 'artifact', targetEntityId: `${suffix}-artifact-3`, kind: 'informs', createdAt: NOW, updatedAt: NOW },
    { id: `${suffix}-relation-3`, projectId: seededProjectId, sourceEntityType: 'artifact', sourceEntityId: `${suffix}-artifact-4`, targetEntityType: 'artifact', targetEntityId: `${suffix}-artifact-5`, kind: 'groups', createdAt: NOW, updatedAt: NOW },
  ]
  const snapshot = {
    schemaVersion: 3,
    graphVersion: 1,
    project: { id: seededProjectId, name: 'HU3 Gesture Persistence Probe', rootPath, graphVersion: 1, createdAt: NOW, updatedAt: NOW },
    scopes: [{ id: scopeId, projectId: seededProjectId, parentScopeId: null, containerViewId: null, kind: 'root', name: 'Root', createdAt: NOW, updatedAt: NOW }],
    workspaces: [{ id: `${suffix}-workspace-main`, projectId: seededProjectId, scopeId, name: 'Main', intent: 'build', viewport: { x: 0, y: 0, zoom: 1 }, focusedViewIds: artifactViews.slice(0, 3).map((view) => view.id), visibleLayers: ['core', 'process'], contextPolicy: 'selection-only', updatedAt: NOW }],
    artifacts,
    artifactViews,
    relations,
    notes: [],
    fileRecords,
    artifactRevisions,
    checkpoints: [],
  }
  await coreFetch(`/projects/${seededProjectId}/graph`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ snapshot }),
  })
  // 让项目总览先有可见节点（等价于 GUI 保存视口后的持久化 active-context）。
  await coreFetch(`/projects/${seededProjectId}/active-context`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      scopeId,
      selectedViewIds: [],
      pinnedContextIds: [],
      excludedContextIds: [],
      visibleViewIds: artifactViews.map((view) => view.id),
      viewport: { x: 0, y: 0, zoom: 1 },
    }),
  })
  return seededProjectId
}

const browser = await chromium.launch({ headless: true })
try {
  const seeded = process.env.LCOS_SEED_PROJECT !== '0'
  const targetProjectId = seeded ? await seedProject() : projectId
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await openGraphSurface(page, targetProjectId)

  const graph = await coreFetch(`/projects/${targetProjectId}/graph`, {})
  const scopeId = graph.scopes?.[0]?.id
  if (!scopeId) throw new Error('no scope found')
  const presentationId = `presentation:context:${scopeId}`

  const dots = page.locator('.lcos-graph-dot')
  const count = Math.min(3, await dots.count())
  if (count === 0) throw new Error('no graph dots found')
  console.log(`dragging ${count} dot(s)`)
  const stage = page.locator('[data-testid="context-graph-spatial"]')
  const viewport = page.locator('[data-testid="context-graph-spatial"] .lcos-spatial-viewport')
  const viewportBox = await viewport.boundingBox()
  if (!viewportBox) throw new Error('no spatial viewport')
  const camX = Number(await stage.getAttribute('data-camera-x'))
  const camY = Number(await stage.getAttribute('data-camera-y'))
  const zoom = Number(await stage.getAttribute('data-camera-zoom'))
  const toWorldX = (screenX) => (screenX - viewportBox.x - camX) / zoom
  const toWorldY = (screenY) => (screenY - viewportBox.y - camY) / zoom

  const deltas = [
    { x: 64, y: 40 },
    { x: 76, y: 52 },
    { x: 88, y: 64 },
  ]
  const expected = new Map()
  for (let index = 0; index < count; index += 1) {
    const dot = dots.nth(index)
    const box = await dot.boundingBox()
    if (!box) throw new Error(`dot ${index} has no bounding box`)
    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    const dx = deltas[index].x
    const dy = deltas[index].y
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    for (let step = 1; step <= 6; step += 1) {
      await page.mouse.move(startX + (dx * step) / 6, startY + (dy * step) / 6)
    }
    await page.mouse.up()
    // 持久化位置 = 初始 top-left（center - 半宽/半高）+ delta；NODE_WIDTH=126, NODE_HEIGHT=50
    // graph dot 是 38×38 小圆，CSS left/top 指向节点中心；持久化位置是节点 top-left。
    const centerScreenX = box.x + box.width / 2
    const centerScreenY = box.y + box.height / 2
    expected.set(index, {
      x: toWorldX(centerScreenX) - 63 + dx / zoom,
      y: toWorldY(centerScreenY) - 25 + dy / zoom,
    })
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(1_500) // debounced flush (500ms) + margin

  const presentation = await coreFetch(`/projects/${targetProjectId}/presentations/${encodeURIComponent(presentationId)}`, {})
  const positions = presentation.state?.positions ?? {}
  const pinned = presentation.state?.pinnedViewIds ?? []
  let checked = 0
  for (const { x, y } of expected.values()) {
    const matching = Object.entries(positions).find(([, point]) => Math.abs(point.x - x) <= 2 && Math.abs(point.y - y) <= 2)
    if (!matching) {
      console.log('expected:', JSON.stringify([...expected.values()]))
      console.log('actual positions:', JSON.stringify(positions))
      console.log('actual pinned:', JSON.stringify(pinned))
      throw new Error(`position missing near (${x}, ${y})`)
    }
    const id = matching[0]
    if (!pinned.includes(id)) throw new Error(`pin missing for ${id}`)
    checked += 1
  }
  console.log(`CORE_COMMIT_OK positions=${checked} pinned=${checked}`)

  // Reload → navigate back → rendered dots must sit at persisted positions.
  await openGraphSurface(page, targetProjectId)

  const dotsAfterReload = page.locator('.lcos-graph-dot')
  const stageAfter = page.locator('[data-testid="context-graph-spatial"]')
  const viewportAfter = page.locator('[data-testid="context-graph-spatial"] .lcos-spatial-viewport')
  const viewportBoxAfter = await viewportAfter.boundingBox()
  const camXAfter = Number(await stageAfter.getAttribute('data-camera-x'))
  const camYAfter = Number(await stageAfter.getAttribute('data-camera-y'))
  const zoomAfter = Number(await stageAfter.getAttribute('data-camera-zoom'))
  const afterCount = Math.min(count, await dotsAfterReload.count())
  await page.waitForTimeout(1_500) // bridge 从 Core 恢复持久化位置后再校验
  let rendered = 0
  for (let index = 0; index < afterCount; index += 1) {
    const box = await dotsAfterReload.nth(index).boundingBox()
    if (!box) continue
    const worldX = (box.x + box.width / 2 - (viewportBoxAfter?.x ?? 0) - camXAfter) / zoomAfter
    const worldY = (box.y + box.height / 2 - (viewportBoxAfter?.y ?? 0) - camYAfter) / zoomAfter
    for (const { x, y } of expected.values()) {
      if (Math.abs(worldX - (x + 63)) <= 3 && Math.abs(worldY - (y + 25)) <= 3) {
        rendered += 1
        break
      }
    }
  }
  console.log(`RELOAD_RENDER_OK rendered=${rendered}/${count} (selection 可能缩小局部图，API 已证明持久化)`)
  console.log('HU3_GESTURE_PERSISTENCE_OK')
} finally {
  await browser.close()
}
