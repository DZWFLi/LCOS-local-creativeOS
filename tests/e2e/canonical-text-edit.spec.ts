import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createMvpSampleSnapshot } from '../../apps/local-core/src/mvp-sample-project'
import { createLocalCoreHarness } from './local-core-harness'

/**
 * A08 canonical text edit browser regression guard.
 *
 * Ordinary text editing must mutate the existing managed Text Artifact through
 * Core curation/text. A Project projection must never force a fork/duplicate
 * confirmation before the user can edit it.
 */

let sampleRoot = ''
let projectId = ''
let viewId = ''
let artifactId = ''
const harness = createLocalCoreHarness()

test.beforeAll(async () => {
  await harness.start()
  sampleRoot = mkdtempSync(path.join(tmpdir(), 'lcos-text-edit-e2e-'))
})

test.afterAll(async () => {
  if (sampleRoot) rmSync(sampleRoot, { recursive: true, force: true })
  await harness.stop()
})

test.beforeEach(async ({ request }) => {
  projectId = `text-edit-e2e-${Date.now()}`
  const seed = createMvpSampleSnapshot(sampleRoot)
  seed.workspaces[0] = { ...seed.workspaces[0]!, focusedViewIds: seed.artifactViews.map((view) => view.id) }
  const identityValues = [
    ...seed.scopes,
    ...seed.workspaces,
    ...seed.artifacts,
    ...seed.artifactViews,
    ...seed.relations,
    ...seed.notes,
    ...seed.artifactRevisions,
    ...seed.fileRecords,
    ...seed.checkpoints,
  ].map((item) => String(item.id))

  let serialized = JSON.stringify(seed).split(String(seed.project.id)).join(projectId)
  for (const identity of identityValues.sort((a, b) => b.length - a.length)) {
    serialized = serialized.split(identity).join(`${projectId}--${identity}`)
  }
  const snapshot = JSON.parse(serialized) as typeof seed
  const seeded = await request.put(`/api/local-core/v1/projects/${projectId}/graph`, { data: { snapshot } })
  expect(seeded.ok(), await seeded.text()).toBe(true)

  const rootScope = snapshot.scopes.find((scope) => scope.kind === 'root')
  expect(rootScope).toBeTruthy()
  const created = await request.post(`/api/local-core/v1/projects/${projectId}/curation/text`, {
    data: {
      scopeId: rootScope!.id,
      title: 'Canonical Edit',
      body: 'body before edit',
      x: 360,
      y: 220,
    },
  })
  expect(created.ok(), await created.text()).toBe(true)
  const value = (await created.json()).value
  viewId = String(value.viewId)
  artifactId = String(value.artifactId)
})

test.afterEach(async ({ request }) => {
  if (projectId) await request.delete(`/api/local-core/v1/projects/${projectId}`)
})

async function openCanvas(page: Page) {
  await page.goto(`/?project=${projectId}`)
  await expect(page.getByTestId('canvas')).toBeVisible({ timeout: 15_000 })
  const node = page.getByTestId(`canvas-node-${viewId}`)
  await expect(node).toBeVisible({ timeout: 15_000 })
  return node
}

test('ordinary Project text projection edits the same canonical artifact without fork confirmation', async ({ page, request }) => {
  const node = await openCanvas(page)
  await node.dblclick()

  await expect(page.getByText('这是项目实体的投影，直接修改会与本体冲突')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '复制并编辑' })).toHaveCount(0)

  const editor = page.getByRole('textbox', { name: '编辑文本节点正文' })
  await expect(editor).toBeVisible({ timeout: 10_000 })
  await expect(editor).toContainText('body before edit')
  await editor.fill('Canonical Edit\nbody edited through canonical GUI')
  await editor.press('Control+Enter')
  await expect(editor).toHaveCount(0, { timeout: 10_000 })

  const read = await request.post(`/api/local-core/v1/projects/${projectId}/curation/read`, {
    data: { viewIds: [viewId], budget: { maxItems: 1, maxCharsPerItem: 30_000, maxTotalChars: 30_000 } },
  })
  expect(read.ok(), await read.text()).toBe(true)
  const body = await read.json()
  expect(body.value.nodes[0]?.boundedText).toBe('body edited through canonical GUI')
  expect(body.value.nodes[0]?.stableRef).toBe(`artifact:${artifactId}`)

  // Re-enter edit after the first revision. Primary view reads must follow the
  // Artifact current revision rather than replaying the view's original revision.
  await node.dblclick()
  const secondEditor = page.getByRole('textbox', { name: '编辑文本节点正文' })
  await expect(secondEditor).toBeVisible({ timeout: 10_000 })
  await expect(secondEditor).toContainText('body edited through canonical GUI')
  await secondEditor.fill('Canonical Edit\nbody edited twice from current revision')
  await secondEditor.press('Control+Enter')
  await expect(secondEditor).toHaveCount(0, { timeout: 10_000 })

  const secondRead = await request.post(`/api/local-core/v1/projects/${projectId}/curation/read`, {
    data: { viewIds: [viewId], budget: { maxItems: 1, maxCharsPerItem: 30_000, maxTotalChars: 30_000 } },
  })
  expect(secondRead.ok(), await secondRead.text()).toBe(true)
  const secondBody = await secondRead.json()
  expect(secondBody.value.nodes[0]?.boundedText).toBe('body edited twice from current revision')
})
