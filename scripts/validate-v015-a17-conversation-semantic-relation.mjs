import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const mandatory = read('docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md')
const domain = read('packages/domain/src/index.ts')
const bridge = read('apps/web/src/runtime/runtimeBridge.ts')
const endpoint = read('apps/web/src/features/spatial/projectRelationEndpoint.ts')
const endpointTest = read('apps/web/src/features/spatial/__tests__/projectRelationEndpoint.test.ts')
const main = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const surfaceObject = read('apps/web/src/features/surfaces/SurfaceObject.tsx')
const context = read('apps/web/src/features/surfaces/ContextSpaceSurface.tsx')
const workflow = read('apps/web/src/features/surfaces/WorkflowSurface.tsx')
const app = read('apps/web/src/App.tsx')
const assembly = read('apps/local-core/src/assembly-apply-service.ts')
const e2e = read('tests/e2e/orbit-lifecycle.spec.ts')
const closeout = read('docs/v015/convergence/A17_CONVERSATION_SEMANTIC_RELATION_CLOSEOUT_20260831.md')
const matrix = read('docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md')
const plan = read('docs/v015/convergence/FRONTEND_CONVERGENCE_PLAN_20260831.md')

const checks = [
  ['Latest L0 explicitly gives Glyth a Relation Orbit capability', mandatory.includes('### Glyth') && mandatory.includes('- Relation')],
  ['Domain Relation truth supports artifact endpoints', domain.includes("'artifact' | 'note' | 'scope' | 'view' | 'workspace'")],
  ['Runtime Conversation projection joins sessions by conversationViewId and carries conversationArtifactId on the real ArtifactView-backed node', bridge.includes('session.conversationViewId') && bridge.includes('conversationByViewId.get(String(view.id))') && bridge.includes('id: String(view.id)') && bridge.includes('conversation.conversationArtifactId')],
  ['Canonical endpoint resolver admits Conversation only through canonical conversationArtifactId', endpoint.includes("node.entityKind === 'conversation'") && endpoint.includes('node.conversation?.conversationArtifactId?.trim()') && endpoint.includes("entityType: 'artifact'")],
  ['Conversation endpoint unit coverage proves artifact truth and missing-artifact fail-close', endpointTest.includes('artifact-conversation') && endpointTest.includes("entityType: 'artifact'") && endpointTest.includes('conversation-without-artifact') && endpointTest.includes('toBeNull()')],
  ['Main Glyth Orbit exposes explicit Relation and retires the read-only status satellite', main.includes("id: 'conversation-relation'") && !main.includes("id: 'conversation-status'") && !main.includes('sessionPhaseLabel')],
  ['Main Glyth source requires canonical conversationArtifactId and reuses the existing Main relation session', main.includes('byId.get(conversationOrbit.nodeId)?.conversation?.conversationArtifactId') && main.includes('beginRelationIntent(source.id') && main.includes('setRelationSourceId(from)')],
  ['Main Glyth target uses explicit conversationArtifact-backed receptor + existing screen-space halo rather than generic data-node fallback', main.includes('[data-node-id][data-entity-kind="conversation"][data-conversation-artifact-id]') && main.includes('relationTargetWithinScreenHaloAt') && !main.includes("if (link.current && node.entityKind === 'conversation')") && !main.includes("closest<HTMLElement>('[data-relation-target], [data-node-id]')")],
  ['Context and Workflow inherit Conversation source/target participation from the same canonical eligibility resolver and no longer suppress Glyth Orbit', context.includes('isProjectRelationEligible(item.node)') && workflow.includes('isProjectRelationEligible(node)') && !surfaceObject.includes("node.entityKind === 'conversation' || additive") && !surfaceObject.includes("node.entityKind !== 'conversation' && <ProjectObjectOrbit")],
  ['Context/Workflow persistence still resolves physical ids before existing saveRelation', app.includes('projectRelationEndpointForNodeId(fromNodeId, projectPresentationNodes)') && app.includes('sourceEntityType: sourceEndpoint.entityType') && app.includes('targetEntityType: targetEndpoint.entityType')],
  ['Conversation Context Mapping remains a distinct conversation_context channel', assembly.includes("kind: 'conversation_context'") && closeout.includes('Conversation Context Mapping') && closeout.includes('NOT ordinary Relation')],
  ['Receiver identities are not smuggled into the canonical Relation endpoint resolver', !endpoint.includes('connectedConversationId') && !endpoint.includes('activeReceiverId') && !endpoint.includes('conversationViewId')],
  ['Browser regression source covers Glyth source, Glyth 16px-halo target, and status-satellite retirement', e2e.includes('conversationArtifact-backed Glyth is an ordinary Relation source') && e2e.includes('conversation-relation') && e2e.includes('conversation-status') && e2e.includes('conversationBounds!.x - 14')],
  ['A17 is recorded as semantic endpoint resolution rather than generic connect()', matrix.includes('A17 Conversation Semantic Relation') && plan.includes('A17 Conversation Semantic Relation') && closeout.includes('generic `connect()`')],
  ['Phase B is still not admitted from source/static evidence', closeout.includes('Phase A complete: NO') && closeout.includes('Phase B admission: NO')],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed += 1
}
console.log(`A17 Conversation Semantic Relation: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
