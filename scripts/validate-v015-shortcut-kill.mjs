import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const srcRoot = path.join(root, 'apps/web/src')
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)])
const sourceFiles = walk(srcRoot).filter((file) => /\.(ts|tsx)$/.test(file))
const source = sourceFiles.map((file) => [path.relative(root, file), fs.readFileSync(file, 'utf8')])
const byFile = new Map(source)
const app = byFile.get('apps/web/src/App.tsx') ?? ''
const dock = byFile.get('apps/web/src/features/shell/SurfaceDock.tsx') ?? ''
const projection = byFile.get('apps/web/src/features/entities/projectEntityProjection.ts') ?? ''
const viewer = byFile.get('apps/web/src/features/viewer/artifactViewerRegistry.tsx') ?? ''
const birth = byFile.get('apps/web/src/features/provenance/birthProvenance.ts') ?? ''
const birthBadge = byFile.get('apps/web/src/features/provenance/BirthProvenanceBadge.tsx') ?? ''
const canvas = byFile.get('apps/web/src/features/canvas/ProjectCanvas.tsx') ?? ''
const checks = []
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) })
const filesMatching = (regex, exclude = () => false) => source.filter(([file, text]) => !exclude(file) && regex.test(text)).map(([file]) => file)

check('Synthetic Conversation nodes are forbidden',
  !/id:\s*`conversation:\$\{/.test(app) && !/id:\s*['"]conversation:/.test(app) &&
  !projection.includes('frontendConversationPosition'))

check('Generic ConversationViewer is forbidden', filesMatching(/\bConversationViewer\b/).length === 0)
check('Generic GlythAvatar / CanvasSprite are forbidden', filesMatching(/\bGlythAvatar\b|\/CanvasSprite['"]|CanvasSprite\.tsx/).length === 0)
check('Timeout-based DROP_FEEDBACK_TOTAL_MS is forbidden', filesMatching(/DROP_FEEDBACK_TOTAL_MS/).length === 0)
check('Legacy receiverSessionStale truth is forbidden', filesMatching(/receiverSessionStale/).length === 0)
check('App cannot use legacy ProjectReceiverBinding as Controller truth', !app.includes('getProjectReceiverBinding('))
check('Conversation cannot become a fourth top-level Surface', !dock.includes("| 'conversation'") && !dock.includes("'conversation' as const"))
check('Conversation artifact Reader is fail-closed rather than primary', viewer.includes("if (node.entityKind === 'conversation') return 'fallback'"))
check('Birth source cannot be inferred from provider/title/time',
  !/\.provider\b|\.title\b|lastRunAt/.test(birth) &&
  !/\.provider\b|\.title\b|lastRunAt/.test(birthBadge))
check('Birth/Conversation Where cannot reuse mutating generic locate callback',
  canvas.includes('onLocateConversationSource?.(conversationOrbit.nodeId)') &&
  !canvas.includes('onLocate?.(conversationOrbit.nodeId)'))

const allowedGlyth = new Set([
  'apps/web/src/features/capture/CaptureFloatApp.tsx',
  'apps/web/src/features/provenance/BirthProvenanceBadge.tsx',
  'apps/web/src/features/spatial/visual/LcosGlyth.tsx',
])
const illegalGlyth = filesMatching(/from ['"][^'"]*\/spatial\/visual\/LcosGlyth['"]|from ['"]\.\.\/visual\/LcosGlyth['"]|from ['"]\.\/LcosGlyth['"]/, (file) => allowedGlyth.has(file))
check('Ordinary Artifact/Surface/Run/Review cannot borrow LcosGlyth', illegalGlyth.length === 0)

let failed = 0
for (const item of checks) { console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}`); if (!item.ok) failed += 1 }
if (illegalGlyth.length) console.log(`  illegal Glyth imports: ${illegalGlyth.join(', ')}`)
console.log(`\n${checks.length - failed}/${checks.length} LCOS v0.15 shortcut-kill contracts passed`)
if (failed) process.exit(1)
