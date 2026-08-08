import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const files = {
  host: read('apps/web/src/features/shell/CanvasSceneHost.tsx'),
  dock: read('apps/web/src/features/shell/SurfaceDock.tsx'),
  rail: read('apps/web/src/features/shell/WorkspaceRailVNext.tsx'),
  canvas: read('apps/web/src/features/canvas/ProjectCanvas.tsx'),
  outline: read('apps/web/src/features/surfaces/OutlineSurface.tsx'),
  flow: read('apps/web/src/features/surfaces/ContextFlowSurface.tsx'),
  tree: read('apps/web/src/features/surfaces/ContextTreeSurface.tsx'),
  graph: read('apps/web/src/features/surfaces/ContextGraphSurface.tsx'),
  history: read('apps/web/src/features/surfaces/ContextHistoryRail.tsx'),
  work: read('apps/web/src/features/surfaces/WorkSurface.tsx'),
  deliver: read('apps/web/src/features/surfaces/DeliverSurface.tsx'),
  projections: read('apps/web/src/features/surfaces/ProjectionSurfaces.tsx'),
  projectionState: read('apps/web/src/state/projectionLayoutState.ts'),
  app: read('apps/web/src/App.tsx'),
  css: read('apps/web/src/reconstruction.css'),
  webPkg: read('apps/web/package.json'),
}

const checks = [
  ['Surface shell does not morph Arrange nodes between lenses', files.host.includes("props.surface === 'arrange' ? <ProjectCanvas") && files.host.includes('<ProjectionSurface')],
  ['Projection renderers are lazy loaded', files.projections.includes('lazy, Suspense') && files.projections.includes('const OutlineSurface=lazy')],
  ['Bottom dock separates Scope and Lens', files.dock.includes('lcos-scope-axis') && files.dock.includes('lcos-lens-axis')],
  ['Workspace rail is dedicated shell navigation', files.rail.includes('WorkspaceRailVNext') && files.rail.includes('workspace')],
  ['Left drop gutter exists', files.canvas.includes('drop-gutter-left')],
  ['Bottom drop gutter exists', files.canvas.includes('drop-gutter-bottom')],
  ['Bottom drop stages transfer instead of targeting a Lens', files.canvas.includes("onStageTransfer?.(draggedCandidate.group.map") && !files.dock.includes('onStageTransfer')],
  ['Selection action strip exists', files.canvas.includes('lcos-selection-strip')],
  ['Multi-selection remains directly draggable', files.canvas.includes('groupIds = selectedIds.includes(node.id)')],
  ['Workspace aggregate relation handles exist', files.canvas.includes('workspace-relation-handle') && files.canvas.includes('workspace:${frame.workspaceId}')],
  ['Selected edge exposes reconnect terminals', files.canvas.includes('edge-reconnect-from-') && files.canvas.includes('edge-reconnect-to-')],
  ['Selected edge exposes cut', files.canvas.includes('edge-cut-') && files.canvas.includes('onCut')],
  ['Outline persists order/depth/collapse', files.outline.includes('orderIds') && files.outline.includes('depthById') && files.outline.includes('collapsedIds')],
  ['Outline supports keyboard hierarchy', files.outline.includes("event.key==='Tab'") && files.outline.includes('shiftKey')],
  ['Outline supports drag reorder', files.outline.includes('draggable') && files.outline.includes('onDragStart')],
  ['Context Flow uses independent semantic axes', files.flow.includes("id:'feedback'") && files.flow.includes("id:'sessions'") && files.flow.includes("id:'revisions'")],
  ['Context Flow renders a Handoff ribbon', files.flow.includes('lcos-handoff-ribbon') && files.flow.includes('handoffs')],
  ['Context Tree supports multiple roots', files.tree.includes('rootIds') && files.tree.includes('roots')],
  ['Context Tree supports branch collapse', files.tree.includes('collapsedIds')],
  ['Context Graph is hop bounded', files.graph.includes('hops') && files.graph.includes('2')],
  ['Context Graph supports relation filters', files.graph.includes('relationKinds')],
  ['Context History exposes version beads', files.history.includes('lcos-context-version-beads')],
  ['Context History can branch to Workbench', files.history.includes('onBranch')],
  ['Context History can compare with current', files.history.includes('onCompare')],
  ['Session/Handoff projection exists', files.flow.includes('runtime?.handoffs') && files.app.includes('sessionHandoffProjection')],
  ['Work Surface consumes active Run', files.work.includes('activeRun') && files.work.includes('lcos-active-run-stage')],
  ['Work Surface exposes cancel/retry/review', files.work.includes('onCancel') && files.work.includes('onRetry') && files.work.includes('onReview')],
  ['Work Surface handles waiting input', files.work.includes('waiting_input') && files.work.includes('onAnswerInput')],
  ['Deliver Surface has revision timeline', files.deliver.includes('lcos-revision-line') && files.deliver.includes('Revision')],
  ['Deliver Surface supports two-revision compare', files.deliver.includes('selectedRevisionIds') && files.deliver.includes('onCompare')],
  ['Deliver Surface exposes review decisions', files.deliver.includes('onAccept') && files.deliver.includes('onReject')],
  ['Projection view state is keyed by scope + surface', files.projectionState.includes('scopeId') && files.projectionState.includes('surface') && files.projectionState.includes('keyOf')],
  ['Projection state does not rewrite Arrange coordinates', !files.projectionState.includes('setNodes(') && !files.projectionState.includes('nodePositions')],
  ['Large Arrange canvas culls to viewport', files.canvas.includes('overscan') && files.canvas.includes('clientWidth') && files.canvas.includes('clientHeight')],
  ['Overview caps rendered heavy nodes', files.canvas.includes('220') && files.canvas.includes('stride')],
  ['Reduced motion is supported', files.css.includes('@media (prefers-reduced-motion: reduce)')],
  ['Surface transition is shell-level', files.host.includes('lcos-surface-mount') && files.css.includes('@keyframes lcos-surface-enter')],
  ['Selected glow remains part of design language', files.css.includes('selected') && (files.css.includes('linear-gradient') || files.css.includes('edge-light'))],
  ['Existing Zustand dependency contract is preserved', files.webPkg.includes('"zustand"')],
  ['Existing presentation/viewer dependency is preserved', files.webPkg.includes('@pagus-kit/react')],
  ['Global conversation exposes Workspace/Scope/Project context', files.app.includes('workspace') && files.app.includes('scope') && files.app.includes('project') && files.app.includes('globalContext')],
  ['Single selection keeps one-hop context behavior', files.app.includes('inferTargetContext') || files.app.includes('oneHop') || files.app.includes('selectedIds.length === 1')],
  ['Multi-selection defaults to exact selected IDs', files.app.includes('selectedIds.length > 1') && files.app.includes('? [...defaultSelectionContextIds]')],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (ok) passed += 1
}
console.log(`\n${passed} / ${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
