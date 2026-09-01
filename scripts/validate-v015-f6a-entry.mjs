import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const shell = read('apps/web/src/features/shell/AppShellView.tsx')
const drive = read('apps/web/src/features/project/ProjectDrive.tsx')
const capture = read('apps/web/src/features/assembly/AssemblyCaptureWorkspace.tsx')
const flow = read('apps/web/src/features/capture/CaptureMaterialFlow.tsx')
const projectMark = read('apps/web/src/features/project/ProjectGlyphMark.tsx')
const searchLens = read('apps/web/src/features/project/ProjectSearchLens.tsx')
const tools = read('apps/web/src/features/project/ProjectToolsDialog.tsx')
const app = read('apps/web/src/App.tsx')
const searchIndex = read('apps/web/src/features/project/projectSearchIndex.ts')
const searchInput = read('apps/web/src/features/project/ProjectSearchIndexInput.tsx')
const searchMigrated = fs.existsSync('docs/v015/convergence/A25_5_SEARCH_RESULT_INDEX_MIGRATION_CLOSEOUT_20260901.md')

const checks = []
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) })

check('Primary /capture shell renders AssemblyCaptureWorkspace, not legacy CaptureSpace',
  shell.includes("import { AssemblyCaptureWorkspace }") &&
  shell.includes('<AssemblyCaptureWorkspace') &&
  !shell.includes("import { CaptureSpace }"))
check('Assembly Capture does not embed ProjectCanvas', !capture.includes('ProjectCanvas'))
check('Capture source is a real material flow with preview API',
  flow.includes('capture-material-masonry') && flow.includes('captureSpacePreview('))
check('Capture selection drag commits through real materialize API',
  capture.includes('materializeCaptureToProject(') && flow.includes('application/x-lcos-capture-ids'))
check('Capture material body remains media-native instead of universal card shell',
  flow.includes('capture-material-image') && flow.includes('capture-material-text') && flow.includes('capture-material-link'))
check('Project Launcher uses Portal grid instead of project row list',
  drive.includes('project-portal-grid') && !drive.includes('project-row-main'))
check('Project Launcher does not show local path as primary metadata',
  !drive.includes('<small>{project.localPath}'))
check('Project object count fails visibly unknown rather than reusing pendingCount',
  drive.includes("summary ? `${summary.objectCount} 个对象` : '— 个对象'") && drive.includes('client.projectSummary(project.id)') && !drive.includes('project.pendingCount'))
check('Project identity mark does not borrow Conversation Glyth runtime',
  !projectMark.includes('LcosGlyth') && !projectMark.includes('ConversationGlyth') && projectMark.includes('iconShapes'))
check('Capture Inbox is lightweight launcher status, not a Capture project card',
  drive.includes('project-capture-inbox') && !drive.includes('project-drive-capture-card'))
check('Ctrl/Cmd+F Search uses the admitted dedicated presentation owner',
  searchMigrated
    ? app.includes('<ProjectSearchIndexInput') && app.includes("projectTools: projectToolsMode === 'full' ?") && !app.includes('<ProjectSearchLens')
    : tools.includes('<ProjectSearchLens') && searchLens.includes('project-search-lens'))
check('Search is query-as-you-type and requests all current Core entity types',
  searchMigrated
    ? searchIndex.includes('window.setTimeout') && searchIndex.includes("types: ['artifact', 'resource', 'note', 'conversation', 'file']") && searchInput.includes('onQueryChange')
    : searchLens.includes('window.setTimeout') && searchLens.includes("types: ['artifact', 'resource', 'note', 'conversation', 'file']"))
check('Project Tools no longer renders a duplicate search field',
  !tools.includes('project-tools-search'))

let failed = 0
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}`)
  if (!item.ok) failed += 1
}
console.log(`\n${checks.length - failed}/${checks.length} LCOS v0.15 F6A entry contracts passed`)
if (failed) process.exit(1)
