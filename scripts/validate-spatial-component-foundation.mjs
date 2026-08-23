import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const contracts = read('packages/contracts/src/presentations.ts')
const catalog = read('apps/web/src/features/spatial/model/surfaceComponentCatalog.ts')
const ops = read('apps/web/src/features/spatial/model/surfaceOps.ts')
const geometry = read('apps/web/src/features/spatial/model/surfaceGeometry.ts')
const intent = read('apps/web/src/features/spatial/model/surfaceIntent.ts')
const registry = read('apps/web/src/features/spatial/components/surfaceComponentRegistry.tsx')
const frame = read('apps/web/src/features/spatial/components/SurfaceFrame.tsx')
const visual = read('apps/web/src/spatial-components.css')
const light = read('apps/web/src/features/spatial/visual/LightSegment.tsx')
const glyth = read('apps/web/src/features/spatial/visual/LcosGlyth.tsx')
const matrix = read('apps/web/src/features/spatial/visual/MatrixActivity.tsx')
const reduced = read('apps/web/src/features/spatial/visual/useReducedSpatialMotion.ts')
const draft = read('apps/web/src/state/presentationDraftState.ts')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const context = read('apps/web/src/features/surfaces/ContextSpaceSurface.tsx')
const workflow = read('apps/web/src/features/surfaces/WorkflowSurface.tsx')
const dock = read('apps/web/src/features/shell/SurfaceDock.tsx')
const projection = read('apps/web/src/features/surfaces/ProjectionSurfaces.tsx')
const core = read('apps/local-core/src/presentation-application-service.ts')
const curation = read('apps/local-core/src/curation-command-service.ts')

const checks = [
  ['SurfaceBounds is one x/y/w/h contract', contracts.includes('export interface SurfaceBoundsV0') && contracts.includes('w: number') && contracts.includes('h: number')],
  ['SurfaceBinding stores identity locators only', contracts.includes('export interface SurfaceBindingV0') && !contracts.includes('FullCopiedProjectEntity')],
  ['Component catalog covers the first trusted capability set', ['fence','region','portal','structure-map','evolution','relationship-field','context-pack','workflow-step','review','workbench'].every((name) => catalog.includes(`${name.includes('-') ? `'${name}'` : name}:`))],
  ['Non-presentation capability shells cannot masquerade as Human-createable components', catalog.includes("readonly createMode: 'presentation' | 'adapter-only' | 'planned'") && catalog.includes("entry.createMode === 'presentation'")],
  ['Registry resolves actual renderers', registry.includes('rendererByType') && registry.includes('FenceComponent') && registry.includes('resolveSurfaceComponent')],
  ['Main Fence renders through the Registry adapter', canvas.includes("resolveSurfaceComponent('fence')") && canvas.includes('main-fence:${region.id}')],
  ['Surface Frame owns move/resize physics in zoom-correct world coordinates', frame.includes("kind: 'move' | 'resize'") && frame.includes('/ Math.max(.05, zoom)')],
  ['Bounds persist through existing Presentation bridge', draft.includes('usePresentationSurfaceElements') && draft.includes('surfaceElements: value')],
  ['remove-projection has no Project delete path', ops.includes("type: 'remove-projection'") && ops.includes('elements.filter((element) => element.id !== op.elementId)') && !ops.includes('deleteProject')],
  ['Light Segment is static-readable structural material', visual.includes('.lcos-light-segment') && visual.includes('background: linear-gradient')],
  ['Matrix Activity can be completely off', matrix.includes('if (!active) return null')],
  ['LCOS Glyth cannot intercept pointer/drop', visual.includes('.lcos-glyth') && visual.includes('pointer-events: none !important')],
  ['Reduced Motion is a shared store consumed by actual primitives', reduced.includes('useSyncExternalStore') && frame.includes('useReducedSpatialMotion') && light.includes('useReducedSpatialMotion') && glyth.includes('useReducedSpatialMotion') && matrix.includes('useReducedSpatialMotion')],
  ['SurfaceOps validates geometry/capability', ops.includes('validateSurfaceOp') && ops.includes('surfaceSupportsComponent') && ops.includes('minimum size')],
  ['SurfaceOps proposal batches are fail-closed', ops.includes('validateSurfaceOps') && ops.includes('one invalid op means zero durable changes') && ops.includes('if (!validation.ok) return [...elements]')],
  ['Pointer cancel rolls preview back instead of committing', frame.includes('const cancel = (pointer: PointerEvent)') && frame.includes("window.addEventListener('pointercancel', cancel)")],
  ['Pinned/manual component bounds are protected', ops.includes('element.presentation?.pinned') && geometry.includes('pinned/manual elements are hard obstacles')],
  ['Surface Intent preserves selected Project View identities without copying truth', contracts.includes('projectViewIds?: string[]') && intent.includes('bindingForTargets') && intent.includes('projectViewIds: ids')],
  ['Context worksite hosts trusted components', context.includes('SurfaceComponentLayer surface="context"') && context.includes('SurfaceComponentShelf')],
  ['Workflow worksite hosts trusted components without duplicate Step creation', workflow.includes('SurfaceComponentLayer surface="workflow"') && workflow.includes("surfaceComponentContract('workflow-step')") && catalog.includes("createMode: 'adapter-only'")],
  ['Context/Workflow first-level entry no longer forces Graph homepages', dock.includes("if(next === 'context') onSurface('context-space')") && projection.includes("props.surface==='workflow'?<WorkflowSurface") && !projection.includes('!props.activeWorkflowId?<WorkflowGraphSurface')],
  ['Core validates and curation preserves SurfaceElements', core.includes('for (const element of state.surfaceElements ?? [])') && curation.includes('...state,')],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed += 1
}
console.log(`Spatial Component Foundation static: ${passed}/${checks.length}`)
if (passed !== checks.length) process.exit(1)
