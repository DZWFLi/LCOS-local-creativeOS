import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const app = read('apps/web/src/App.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const spatialCanvas = read('apps/web/src/features/spatial/SpatialCanvas.tsx')
const pointer = read('apps/web/src/features/spatial/pointerInteractionLanguage.ts')
const css = read('apps/web/src/interaction-system.css')
const host = read('apps/web/src/features/shell/CanvasSceneHost.tsx')
const surfaceObject = read('apps/web/src/features/surfaces/SurfaceObject.tsx')
const contextTree = read('apps/web/src/features/surfaces/ContextTreeSurface.tsx')
const contextHome = read('apps/web/src/features/surfaces/ContextRelationshipHomeSurface.tsx')
const workflowGraph = read('apps/web/src/features/surfaces/WorkflowGraphSurface.tsx')
const workSurface = read('apps/web/src/features/surfaces/WorkSurface.tsx')
const assembly = read('packages/contracts/src/assembly.ts')
const assemblyApply = read('apps/local-core/src/assembly-apply-service.ts')

const checks = [
  ['Shift is the only additive Selection modifier', pointer.includes('return input.shiftKey') && canvas.includes('return additiveSelectionModifier(event)') && spatialCanvas.includes('additive: event.shiftKey')],
  ['Ctrl/Cmd is reserved for this-run Reference Pick', pointer.includes("!input.shiftKey && (input.ctrlKey || input.metaKey)") && canvas.includes('referencePickModifier(event)')],
  ['Reference Pick bridge is available without opening Composer', app.includes("referencePick: layoutMode === 'desktop' ? { active: referencePickActive, ids: selectionReferenceIds") && !app.includes("referencePick: layoutMode === 'desktop' && selectionComposerOpen")],
  ['Reference Pick toggles shared Reference Set without mutating Selection', canvas.includes('referencePick.onToggle(node.id)') && canvas.includes('suppressClick.current = node.id') && app.includes('onToggle: toggleSelectionReference')],
  ['Reference identity remains visible after modifier release', canvas.includes('referenceOrder={referencePick ? referencePick.ids.indexOf(node.id) + 1 : 0}') && css.includes('.canvas-node.reference-picked:not(.selected)')],
  ['Glyth Ctrl/Cmd click switches Receiver instead of becoming an ordinary Reference', canvas.includes("node.entityKind === 'conversation' && node.conversation") && canvas.includes('onSetActiveConversation?.(node.conversation.id)')],
  ['Relation creation starts from one boundary Light Notch', canvas.includes('data-testid={`relation-notch-${node.id}`}') && canvas.includes('className="lcos-relation-notch"') && !canvas.includes('data-testid={`anchor-out-${node.id}`}') && !canvas.includes('data-testid={`anchor-in-${node.id}`}')],
  ['Relation target receptivity stays object-local', canvas.includes("relationTargetId === node.id") && css.includes('.canvas-node.is-relation-target::after')],
  ['Canvas body drop onto Glyth has its own mapping target language', canvas.includes('conversationGlythDropTarget(node.conversation.id)') && canvas.includes("data-project-view-drop-label={node.entityKind === 'conversation' ? '给这段对话' : undefined}")],
  ['Canvas → Glyth durable mapping reuses Assembly apply rather than a second store', app.includes('mapCanvasObjectsToConversation') && app.includes('client.applyAssembly(activeProjectId') && app.includes("targetRef: { kind: 'conversation', id: receiver.id }") && assembly.includes("kind: 'conversation'")],
  ['Core Assembly conversation target remains canonical conversation_context Relation truth', assemblyApply.includes("targetRef.kind === 'conversation'") && assemblyApply.includes("kind: 'conversation_context'")],
  ['Unlinked Conversation mapping fails closed instead of guessing identity', app.includes('这段对话还没有完成连接；先连接后才能长期使用这些材料') && app.includes('unresolved.push(ref)')],
  ['Reference Pick does not call durable mapping or Relation creation', !/referencePick\.onToggle\(node\.id\)[\s\S]{0,180}(applyAssembly|connect\()/.test(canvas)],
  ['Middle mouse remains a pure SpatialCanvas pan entry', spatialCanvas.includes('if (event.button === 1)') && spatialCanvas.includes('beginSpatialPan') && spatialCanvas.includes("data-pointer-state={panning ? 'pan-closed-hand' : 'pan-open-hand'}")],
  ['Space + left drag remains Camera Pan fallback', canvas.includes('event.button === 0 && blankCanvas && spaceHeld')],
  ['Pointer visuals expose reference, relation, and hand states without a persistent pointer store', css.includes('.canvas.is-reference-pick') && css.includes('.canvas.is-relation-dragging') && css.includes('pan-closed-hand') && !/localStorage|sessionStorage/.test(pointer)],
  ['Semantic Drop to Glyth and ordinary Rail/Surface drop share one commit dispatcher', canvas.includes('commitProjectViewTarget') && canvas.includes('conversationSessionFromDropTarget(targetId)') && canvas.includes('onDirectProjectViewDrop?.(targetId, ids)')],
  ['Context/Workflow physical Ctrl/Cmd Reference Pick reuses SharedComposerCommandState', host.includes('surfaceReferencePickIntent') && host.includes('command.onToggleReference(id)') && host.includes('command.onReceiverChange(receiver.id)') && host.includes('referencePickModifier(event)')],
  ['Same Physics removes Ctrl/Cmd from additive Selection across Surface renderers', surfaceObject.includes('additiveSelectionModifier(event)') && contextTree.includes('additiveSelectionModifier(event)') && contextHome.includes('additiveSelectionModifier(event)') && workflowGraph.includes('additiveSelectionModifier(event)') && workSurface.includes('additiveSelectionModifier(event)')],
  ['Surface Reference Pick exposes local receptive feedback without a local Reference store', host.includes("'is-reference-pick'") && css.includes('.lcos-surface-host.is-reference-pick') && !host.includes('surfaceReferenceIds')],
]

let pass = 0
for (const [label, ok] of checks) {
  if (ok) { pass += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`R2-D Interaction Grammar: ${pass}/${checks.length} PASS`)
if (pass !== checks.length) process.exit(1)
