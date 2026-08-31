import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const domain = read('packages/domain/src/index.ts')
const bridge = read('apps/web/src/runtime/runtimeBridge.ts')
const endpoint = read('apps/web/src/features/spatial/projectRelationEndpoint.ts')
const endpointTest = read('apps/web/src/features/spatial/__tests__/projectRelationEndpoint.test.ts')
const context = read('apps/web/src/features/surfaces/ContextSpaceSurface.tsx')
const workflow = read('apps/web/src/features/surfaces/WorkflowSurface.tsx')
const projections = read('apps/web/src/features/surfaces/ProjectionSurfaces.tsx')
const app = read('apps/web/src/App.tsx')
const main = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const matrix = read('docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md')

const checks = [
  ['Core Relation truth explicitly supports view/note/scope/workspace endpoints', domain.includes("export type RelationEntityType = 'artifact' | 'note' | 'scope' | 'view' | 'workspace'")],
  ['Existing runtime bridge already canonicalizes aggregate container nodes to scope and prefixed Workspace/Scope ids to their entity types', bridge.includes('aggregateScopeByNodeId') && bridge.includes("? { type: 'workspace' as const") && bridge.includes("? { type: 'scope' as const") && bridge.includes("aggregateScopeByNodeId.get(id)!")],
  ['A16 introduces one shared visible-node -> canonical Relation endpoint resolver', endpoint.includes('projectRelationEndpointForNode') && endpoint.includes('projectRelationEndpointForNodeId') && endpoint.includes("ProjectRelationEndpointType = 'artifact' | 'view' | 'note' | 'scope' | 'workspace'")],
  ['Anchored Core Note projections persist as note truth while local-only note shells fail closed', endpoint.includes("node.kind === 'note' && !node.artifactId") && endpoint.includes("entityType: 'note'") && endpoint.includes('node.anchors?.length')],
  ['Aggregate container ArtifactView bodies persist as Scope truth through opensScopeId', endpoint.includes('node.opensScopeId && AGGREGATE_SCOPE_ENTITY_KINDS.has(node.entityKind)') && endpoint.includes("return { entityType: 'scope', entityId: node.opensScopeId }")],
  ['Explicit scope/workspace projections preserve canonical entity ids rather than fake view ids', endpoint.includes("node.id.startsWith('scope:')") && endpoint.includes("node.id.startsWith('workspace:')") && endpoint.includes("entityType: 'workspace'")],
  ['A17 extends A16 only for artifact-backed Conversation and keeps missing-artifact Conversation fail-close', endpoint.includes("node.entityKind === 'conversation'") && endpoint.includes('node.conversation?.conversationArtifactId?.trim()') && endpoint.includes("entityType: 'artifact'")],
  ['Unknown/non-projected ids fail closed instead of being guessed from string shape alone', /const node = nodes\.find\([\s\S]{0,160}return node \? projectRelationEndpointForNode\(node\) : null/.test(endpoint)],
  ['Context and Workflow now admit every proven non-Conversation Project Relation endpoint through the shared eligibility resolver', context.includes('isProjectRelationEligible(item.node)') && workflow.includes('isProjectRelationEligible(node)')],
  ['Projection host contract passes physical node ids, not falsely named view ids', projections.includes('onCreateDomainRelation?:(fromNodeId:string,toNodeId:string')],
  ['Canonical save path resolves both physical ids against current Project projection before persistence', app.includes('projectRelationEndpointForNodeId(fromNodeId, projectPresentationNodes)') && app.includes('projectRelationEndpointForNodeId(toNodeId, projectPresentationNodes)')],
  ['Direct saveRelation no longer hardcodes Context/Workflow endpoints to view', app.includes('sourceEntityType: sourceEndpoint.entityType, sourceEntityId: sourceEndpoint.entityId') && app.includes('targetEntityType: targetEndpoint.entityType, targetEntityId: targetEndpoint.entityId') && !app.includes("sourceEntityType: 'view', sourceEntityId: fromNodeId")],
  ['Unproven endpoint resolution aborts the write instead of falling back to view', app.includes("throw new Error('RELATION_ENDPOINT_UNPROVEN')") && app.includes('关系端点语义尚未确认；已停止写入')],
  ['Main Workspace relation owner remains A14 canonical workspace:<id> and is not moved into the Context/Workflow adapter', main.includes('data-relation-target={`workspace:${frame.workspaceId}`}') && main.includes("id: 'workspace-relation'")],
  ['Unit coverage freezes view/note/scope/workspace plus artifact-backed Conversation and unresolved fail-close', endpointTest.includes("entityType: 'view'") && endpointTest.includes("entityType: 'note'") && endpointTest.includes("entityType: 'scope'") && endpointTest.includes("entityType: 'workspace'") && endpointTest.includes("entityType: 'artifact'") && endpointTest.includes('conversation-without-artifact') && endpointTest.includes('toBeNull()')],
  ['Responsibility matrix records A16 as endpoint canonicalization rather than generic connect()', matrix.includes('A16 Canonical Relation Endpoint Adapter') && matrix.includes('generic `connect()`')],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed += 1
}
console.log(`A16 Canonical Relation Endpoint Adapter: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
