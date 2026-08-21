import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const checks = []
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) })

const selection = read('packages/contracts/src/selection.ts')
const presentations = read('packages/contracts/src/presentations.ts')
const layout = read('apps/web/src/state/presentationLayout.ts')
const region = read('apps/web/src/state/spatialRegion.ts')
const app = read('apps/web/src/App.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const visual = read('apps/web/src/features/design/DotGlyph.tsx')
const launcher = read('scripts/dev-launcher.mjs')
const repository = read('apps/local-core/src/metadata-repository.ts')
const domain = read('packages/domain/src/index.ts')

check('Selection is Surface-local EntityRef contract', selection.includes('surfaceId: string') && selection.includes('entityRefs: readonly PresentationEntityRefV0[]') && selection.includes('never expands aggregate membership implicitly'))
check('Project keeps stable identity', /interface Project[\s\S]*readonly id: ProjectId/.test(domain) || /export interface Project[\s\S]*id: ProjectId/.test(domain))
check('Relation object has independent identity/source/target/provenance', domain.includes('interface Relation') && domain.includes('sourceEntityId') && domain.includes('targetEntityId') && domain.includes('evidenceRefs'))
check('Relation traversal indexes remain migrated in the current schema chain', repository.includes('#migrate_035_from_v34') && repository.includes('idx_relations_project_source') && repository.includes('idx_relations_project_target') && repository.includes('idx_relations_project_kind') && repository.includes('#migrate_037_from_v36'))
check('16x16 is canonical LCOS action/state signal, not object identity', visual.includes('LcosSignalState') && visual.includes('viewBox="0 0 16 16"') && visual.includes("'working'") && visual.includes("'pending'") && !visual.includes('SystemDotGlyph'))
check('Freeform/Grid are Presentation-only modes and may order aggregate refs without changing membership', presentations.includes("PresentationLayoutModeV0 = 'freeform' | 'grid'") && layout.includes('visible ids are supplied by the current') && layout.includes('memberViewIds'))
check('Region is temporary Presentation intent', region.includes('temporary Presentation intent') && region.includes('memberViewIds'))
check('Surface bootstrap forces Tap/Companion modes', app.includes("launchSurface === 'companion' ? 'sidecar'") && app.includes("launchSurface === 'tap' ? 'desktop'") && launcher.includes("const surfaces = ['tap', 'companion']"))
check('Surface query survives project routing', app.includes("preserved.set('surface', surface)") && app.includes("if (launchSurface) params.set('surface', launchSurface)"))
check('A4 Collection semantics remain in-place and child-canvas is firewalled', app.includes("if (next.kind === 'collection')") && app.includes('setExpandedCollectionScopeIds') && canvas.includes('onToggleCollection?.(collectionScopeId)'))
check('Rail implementation is not coupled to B spatial code', !canvas.includes('WorkspaceRailVNext') && !visual.includes('WorkspaceRailVNext'))

let failed = 0
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}`)
  if (!item.ok) failed += 1
}
console.log(`\n${checks.length - failed}/${checks.length} R3.1B1-r2 static contracts passed`)
if (failed) process.exit(1)
