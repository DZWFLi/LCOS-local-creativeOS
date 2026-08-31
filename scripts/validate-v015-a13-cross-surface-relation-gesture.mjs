import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const adapter = read('apps/web/src/features/spatial/projectMaterialRelationGesture.tsx')
const surfaceObject = read('apps/web/src/features/surfaces/SurfaceObject.tsx')
const context = read('apps/web/src/features/surfaces/ContextSpaceSurface.tsx')
const workflow = read('apps/web/src/features/surfaces/WorkflowSurface.tsx')
const projections = read('apps/web/src/features/surfaces/ProjectionSurfaces.tsx')
const main = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const app = read('apps/web/src/App.tsx')
const css = read('apps/web/src/interaction-system.css')

const checks = [
  ['A13 adds one shared physical Project-material Relation gesture adapter without becoming a persistence owner',
    adapter.includes('useProjectMaterialRelationGesture')
      && adapter.includes('This adapter owns only transient pointer/target state')
      && adapter.includes('onCommit: (sourceId: string, targetId: string)')
      && !/saveRelation|setEdges|usePresentationDraftEdges|bridgeRef|workflowActionState/.test(adapter)],
  ['Physical receptor lookup is explicit and no longer treats every generic data-node-id as a Relation target',
    adapter.includes("closest<HTMLElement>('[data-project-relation-target]')")
      && main.includes('projectMaterialRelationTargetAt(clientX, clientY, link.current?.from)')
      && main.includes("data-project-relation-target={node.entityKind !== 'conversation' ? node.id : undefined}")
      && !main.includes("closest<HTMLElement>('[data-relation-target], [data-node-id]')")],
  ['SurfaceObject projects Orbit -> Relation only when the parent Surface supplies a real capability',
    surfaceObject.includes('onRelation?: () => void')
      && surfaceObject.includes('{...(onRelation ? { onRelation } : {})}')
      && surfaceObject.includes('data-project-relation-target={relationEligible ? node.id : undefined}')],
  ['Relation intent yields into a temporary source port and consumes target pointer intent before Selection/Semantic Drop re-opens UI',
    surfaceObject.includes('relationSource && <span data-testid={`relation-source-port-${node.id}`}')
      && surfaceObject.includes('relationPointerConsumed.current = true')
      && surfaceObject.includes('if (onRelationCommit)')
      && surfaceObject.includes('if (relationActive && relationSource)')],
  ['Context Project-view materials now use shared Orbit -> Relation physical grammar and commit canonical domain Relation truth',
    context.includes('useProjectMaterialRelationGesture')
      && context.includes("await props.onCreateDomainRelation(fromViewId, toViewId, 'reference', 'context-canvas')")
      && context.includes('onRelation: () => projectRelation.beginIntent')
      && context.includes('onRelationCommit: () => projectRelation.commitTarget')
      && context.includes('<ProjectMaterialRelationLiveEdge')],
  ['Workflow Project-view materials use the same physical grammar while preserving workflow-canvas provenance',
    workflow.includes('useProjectMaterialRelationGesture')
      && workflow.includes("await props.onCreateDomainRelation(fromViewId, toViewId, 'reference', 'workflow-canvas')")
      && workflow.includes('onRelation: () => projectRelation.beginIntent')
      && workflow.includes('onRelationCommit: () => projectRelation.commitTarget')
      && workflow.includes('<ProjectMaterialRelationLiveEdge')],
  ['Workflow Step/action linking remains a separate truth and is not swallowed by Project-material Relation',
    workflow.includes('const beginLink = (event: ReactPointerEvent<HTMLButtonElement>, from: string) =>')
      && workflow.includes("closest<HTMLElement>('[data-workflow-action-id]')")
      && workflow.includes('setWorkflowActionState((current) => current.edges.some')
      && workflow.includes('if (projectRelation.active || event.button !== 0) return')],
  ['Projection host routes canonical Relation persistence into both Context and Workflow rather than creating a Surface-local store',
    projections.includes("props.surface==='context-space'?<ContextSpaceSurface")
      && projections.includes('onCreateDomainRelation={props.onCreateDomainRelation}')
      && projections.includes("props.surface==='workflow'?<WorkflowSurface")],
  ['Canonical save path records explicit Surface provenance without changing Relation business truth into a presentation edge',
    app.includes("onCreateDomainRelation: async (fromViewId, toViewId, kind, createdBy = 'workflow-canvas')")
      && app.includes("sourceEntityType: 'view', sourceEntityId: fromViewId")
      && app.includes("targetEntityType: 'view', targetEntityId: toViewId")
      && app.includes("origin: 'user', createdBy, confidence: 1")
      && app.includes('client.saveRelation(activeProjectId, relation)')],
  ['Unowned endpoint semantics fail closed: Conversation, aggregate scope and workspace projections do not receive this view-endpoint Relation capability',
    adapter.includes("node.entityKind !== 'conversation'")
      && adapter.includes("!node.id.startsWith('scope:')")
      && adapter.includes("!node.id.startsWith('workspace:')")
      && main.includes("if (link.current && node.entityKind === 'conversation')")],
  ['A13 visual layer keeps source/target controls screen-space local and suppresses competing transient controls during Relation intent',
    css.includes('.lcos-surface-relation-port { pointer-events:none; }')
      && css.includes('.lcos-project-material-relation-live')
      && css.includes('vector-effect:non-scaling-stroke;')
      && css.includes('.is-project-relation-intent :is(.lcos-semantic-drop-handle,.lcos-workflow-port,.lcos-workflow-bypass)')],
  ['A13 does not falsely retire Workspace legacy ownership or invent Conversation Relation semantics',
    css.includes('Legacy Workspace relation source remains temporarily')
      && main.includes('workspace-relation-notch')
      && !adapter.includes('conversation-relation')
      && !adapter.includes('genericConnect')],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`A13 Cross-surface Relation Gesture Adapter: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
