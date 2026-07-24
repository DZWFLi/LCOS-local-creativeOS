// Phase 2 verify — full stack check
import { spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'

const BASE = 'http://127.0.0.1:43121'

async function get(path) {
  const r = await fetch(BASE + path)
  return r.json()
}

async function put(path, body) {
  const r = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

const PORTASPLIT = {
  disposable: true,
  snapshot: {
    schemaVersion: 2,
    project: { id: 'disposable-portasplit', name: 'PortaSplit', rootPath: 'disposable://portasplit', createdAt: t(), updatedAt: t() },
    workspaces: [{ id: 'ws-main', projectId: 'disposable-portasplit', name: 'Main', intent: 'build', viewport: { x: 100, y: 200, zoom: 1.0 }, focusedNodeIds: [], visibleLayers: ['core'], updatedAt: t() }],
    artifacts: [{ id: 'art-brief', projectId: 'disposable-portasplit', title: 'Creative Brief', kind: 'markdown', localPath: 'disposable://brief.md', availability: 'available', createdAt: t(), updatedAt: t() }],
    artifactViews: [{ id: 'view-brief', artifactId: 'art-brief', workspaceId: 'ws-main', referenceKind: 'primary', position: { x: 50, y: 50 }, size: { width: 200, height: 150 }, displayMode: 'card', collapsed: false }],
    relations: [],
    notes: [{ id: 'note-1', projectId: 'disposable-portasplit', anchor: { scope: 'artifact', artifactId: 'art-brief' }, body: '需要补充目标受众', createdAt: t(), updatedAt: t() }],
    artifactRevisions: [{ id: 'rev-1', artifactId: 'art-brief', localPath: 'disposable://brief.md', contentHash: 'abc', source: 'import', status: 'current', createdAt: t() }],
    checkpoints: [{ id: 'cp-1', projectId: 'disposable-portasplit', workspaceId: 'ws-main', artifactRevisionIds: ['rev-1'], relatedRunIds: [], canvasSnapshot: { camera: { x: 100, y: 200, zoom: 1.0 } }, createdAt: t() }],
  },
}

function t() { return new Date().toISOString() }

async function main() {
  console.log('=== Phase 2 Full Stack Verification ===\n')

  // 1. Health
  const health = await get('/health')
  console.log('1. Health:', health.status, health.version)

  // 2. Metadata
  const meta = await get('/metadata/status')
  console.log('2. Schema version:', meta.value.schemaVersion, '| DB:', meta.value.databasePath.replace(/.*OS开发./, ''))

  // 3. Save full project
  const save = await put('/projects/disposable-portasplit/graph', PORTASPLIT)
  console.log('3. Save:', save.ok ? 'OK' : 'FAIL')

  // 4. Restore
  const g = await get('/projects/disposable-portasplit/graph')
  console.log('4. Restore:', g.ok ? 'OK' : 'FAIL')
  if (g.ok) {
    const v = g.value
    console.log('   Project:', v.project.name)
    console.log('   Workspaces:', v.workspaces.length, '| zoom:', v.workspaces[0]?.viewport?.zoom)
    console.log('   Artifacts:', v.artifacts.length)
    console.log('   Views:', v.artifactViews.length)
    console.log('   Notes:', v.notes.length, '|', v.notes[0]?.body)
    console.log('   Revisions:', v.artifactRevisions.length, '|', v.artifactRevisions[0]?.status)
    console.log('   Checkpoints:', v.checkpoints.length, '| revIds:', v.checkpoints[0]?.artifactRevisionIds)
  }

  // 5. Individual CRUD — Note
  const noteRes = await fetch(BASE + '/projects/disposable-portasplit/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'note-new', projectId: 'disposable-portasplit', anchor: { scope: 'page', artifactId: 'art-brief', pageIndex: 2 }, body: '第二页备注', createdAt: t(), updatedAt: t() }),
  })
  const notes = await get('/projects/disposable-portasplit/notes')
  console.log('5. Note CRUD:', notes.value.length === 2 ? 'OK (2 notes)' : 'FAIL')

  // 6. Delete view, keep artifact
  await fetch(BASE + '/projects/disposable-portasplit/artifact-views/view-brief', { method: 'DELETE' })
  const afterDelete = await get('/projects/disposable-portasplit/graph')
  const viewsOk = afterDelete.value.artifactViews.length === 0
  const artifactsOk = afterDelete.value.artifacts.length === 1
  console.log('6. Delete view:', viewsOk && artifactsOk ? 'OK (0 views, 1 artifact)' : 'FAIL')

  // 7. Project catalog
  const catalog = await get('/projects')
  console.log('7. Catalog:', catalog.value.length > 0 ? `OK (${catalog.value.length} projects)` : 'FAIL')

  console.log('\n=== All checks complete ===')
}

const server = spawn('node', ['apps/local-core/dist/index.js'], { cwd: 'E:/Codex 项目/OS开发', stdio: 'ignore', shell: true })
await setTimeout(2000)

try {
  await main()
  console.log('PASS')
} catch (e) {
  console.error('FAIL:', e.message)
} finally {
  server.kill()
  await setTimeout(500)
  process.exit(0)
}
