import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const app = read('apps/web/src/App.tsx')
const bridge = read('apps/web/src/runtime/runtimeBridge.ts')
const surfaceObject = read('apps/web/src/features/surfaces/SurfaceObject.tsx')
const visual = read('apps/web/src/features/canvas/CanvasNodeVisual.tsx')
const dock = read('apps/web/src/features/shell/SurfaceDock.tsx')
const r31 = read('apps/web/tests/guiR31aProjectNodeFoundation.test.ts')
const runtimeTest = read('apps/web/tests/runtimeBridge.test.ts')

let pass = 0
let fail = 0
const check = (label, ok) => {
  if (ok) { pass += 1; console.log(`PASS  ${label}`) }
  else { fail += 1; console.error(`FAIL  ${label}`) }
}

check('A21-01 Conversation projection is keyed by canonical conversationViewId',
  bridge.includes('const conversationByViewId = new Map(conversationSessions.flatMap((session) => session.conversationViewId'))
check('A21-02 Runtime mapping gives Conversation identity precedence over aggregate-scope entityKind',
  bridge.includes("if (conversation) return 'conversation' as const") && !bridge.includes("...(conversation ? {\n        entityKind: 'conversation' as const"))
check('A21-03 Conversation visual dispatch still requires entityKind === conversation, with no title/kind hack',
  visual.includes("if (props.node.entityKind === 'conversation')") && visual.includes('ConversationGlythObject') && !visual.includes("title.includes('Glyth')"))
check('A21-04 Runtime regression locks text-backed canonical Conversation to entityKind conversation',
  runtimeTest.includes("preserves canonical Conversation entityKind even when the backing Artifact is text") && runtimeTest.includes("entityKind: 'conversation'"))

check('A21-05 Context capability Drop resolves current canonical owner instead of creating a new Context',
  app.includes("if (targetViewId === 'capability:context')") && app.includes('const ownerId = activeContextId ?? rootScope.id') && app.includes("appendExactPresentationMembers('context', ownerId"))
check('A21-06 Workflow capability Drop resolves current canonical owner instead of creating a new Workflow',
  app.includes("if (targetViewId === 'capability:workflow')") && app.includes('const ownerId = activeWorkflowId ?? rootScope.id') && app.includes("appendExactPresentationMembers('workflow', ownerId"))
check('A21-07 Explicit generation remains a separate creation path',
  app.includes("if (targetViewId === 'generate:context')") && app.includes('createContextFromMembersDirect(viewIds, undefined, entityRefs)') && app.includes("if (targetViewId === 'generate:workflow')") && app.includes('createWorkflowFromMembersDirect(viewIds, undefined, entityRefs)'))
check('A21-08 Dock remains one semantic receptor labelled as use-in Context/Workflow rather than create',
  dock.includes("'data-project-view-drop-target':`capability:${id}`") && dock.includes('拖入对象直接用于${label}'))
check('A21-09 Surface switching preserves same-family Context/Workflow owner identity',
  app.includes("else if (normalized === 'workflow') setActiveContextId(null)") && !app.includes("if (normalized === 'workflow') { setActiveContextId(null); setActiveWorkflowId(null) }"))
check('A21-10 R31 regression contract is upgraded from generative Dock Drop to same-worksite convergence',
  r31.includes('same canonical worksite as click navigation') && r31.includes("targetViewId === 'generate:context'"))

check('A21-11 Context/Workflow material Selection commits on pointerdown before outer drag capture',
  surfaceObject.includes('Main commits Selection on pointerdown. Context/Workflow must do the same') && surfaceObject.includes('if (!preserveExistingMultiSelection) onSelect(node.id, additive)'))
check('A21-12 Shift remains the only additive Selection modifier and ordinary click only opens Orbit after Selection',
  surfaceObject.includes('const additive = additiveSelectionModifier(event)') && surfaceObject.includes('onClick={maybeOpenOrbit}') && !surfaceObject.includes('onClick={selectAndMaybeOpenOrbit}'))
check('A21-13 Explicit Semantic Drop gestures do not mutate point Selection',
  surfaceObject.includes('const semanticTrigger = semanticDropTriggerFromPointer(event)') && surfaceObject.includes('event.button === 0 && semanticTrigger === null'))

console.log(`\nA21 canonical projection / selection parity: ${pass} PASS / ${fail} FAIL`)
if (fail) process.exit(1)
