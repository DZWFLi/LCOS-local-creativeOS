import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const app = read('apps/web/src/App.tsx')
const client = read('apps/web/src/runtime/localCoreClient.ts')
const bridge = read('apps/web/src/runtime/runtimeBridge.ts')
const dialogs = read('apps/web/src/features/shell/DialogsHost.tsx')
const memory = read('apps/web/src/state/notePresentationMemory.ts')
const coreTest = read('apps/local-core/tests/hu2-session-read.test.ts')
const coreQuery = read('apps/local-core/src/curation-query-service.ts')
const coreQueryTest = read('apps/local-core/tests/curation-query.test.ts')

const checks = [
  [
    'Web exposes canonical curation read + PUT text revision routes',
    client.includes("readCurationViews(projectId")
      && client.includes("method: 'POST'")
      && client.includes('`/projects/${encodeURIComponent(projectId)}/curation/read`')
      && client.includes("updateTextArtifact(projectId")
      && client.includes("method: 'PUT'")
      && client.includes('`/projects/${encodeURIComponent(projectId)}/curation/text`'),
  ],
  [
    'Runtime text edit hydrates current canonical body before opening editor',
    app.includes('client.readCurationViews(activeProjectId')
      && app.includes('current.truncated || call.result.value.truncated')
      && app.includes("setNotice('文本超过安全的就地编辑范围，已打开完整阅读视图')"),
  ],
  [
    'Ordinary runtime save writes canonical revision instead of projection-local body first',
    app.includes('client.updateTextArtifact(activeProjectId')
      && app.includes("setNotice('正在保存文本修订…')")
      && app.includes('noteBodyRevisionId: canonical.revisionId'),
  ],
  [
    'Legacy fork-before-edit owner is retired from production',
    !app.includes('forkPromptId')
      && !app.includes('confirmForkProjection')
      && !app.includes('originTextIdsRef')
      && !dialogs.includes('confirmForkProjection')
      && !app.includes('复制并编辑'),
  ],
  [
    'Session-local body/outline cache is revision-bound and cannot mask newer canonical truth',
    memory.includes('noteBodyRevisionId?: string')
      && bridge.includes('bodyMatchesCanonicalRevision')
      && bridge.includes('presentation.noteBodyRevisionId')
      && bridge.includes('bodyMatchesCanonicalRevision && presentation.noteOutline')
      && bridge.includes('String(revisionId)'),
  ],
  [
    'Save-and-convert waits for canonical text save before changing presentation layout',
    app.includes("void saveNoteBody(noteToEdit.id, input).then((saved) => {")
      && app.includes("if (saved) toggleNoteLayout(noteToEdit.id, 'mindmap', input)"),
  ],
  [
    'Primary curation read follows Artifact current revision instead of stale primary-view revision',
    coreQuery.includes("view.referenceKind === 'primary'")
      && coreQuery.includes('artifact.currentRevisionId ?? view.revisionId')
      && coreQueryTest.includes('primary view reads follow the Artifact current revision after a canonical edit'),
  ],
  [
    'GUI direct Core text edit remains explicitly supported without agent session lease',
    coreTest.includes("it('GUI direct edit without sessionId still bypasses the guard'")
      && coreTest.includes("body: 'user direct edit'")
      && coreTest.includes('expect(direct.status).toBe(200)'),
  ],
  [
    'Duplicate remains a separate explicit action rather than edit prerequisite',
    app.includes('const duplicateSelectedViews = useCallback')
      && app.includes('duplicateSelection()'),
  ],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`A08 Canonical Text Edit: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
