import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const css = read('apps/web/src/interaction-system.css')
const adapter = read('apps/web/src/features/spatial/projectMaterialRelationGesture.tsx')
const endpoints = read('apps/web/src/features/spatial/projectRelationEndpoint.ts')
const matrix = read('docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md')
const plan = read('docs/v015/convergence/FRONTEND_CONVERGENCE_PLAN_20260831.md')

const checks = [
  ['Workspace Relation source no longer uses permanent/hover legacy notch',
    !canvas.includes('workspace-relation-notch')
      && !canvas.includes('className="lcos-relation-notch')
      && !css.includes('.lcos-relation-notch')],
  ['Workspace header activation opens a local transient Orbit without inventing Workspace selection truth',
    canvas.includes('const [workspaceOrbit, setWorkspaceOrbit]')
      && canvas.includes('setWorkspaceOrbit({ anchor: event.currentTarget, workspaceId: frame.workspaceId, label: frame.label })')
      && canvas.includes('onWorkspaceActivate?.(frame.workspaceId)')],
  ['Workspace Orbit exposes explicit Relation capability through shared ObjectOrbit shell',
    canvas.includes("id: 'workspace-relation'")
      && canvas.includes("label: '关系'")
      && canvas.includes('icon: GitBranch')
      && canvas.includes('<ObjectOrbit')],
  ['Workspace Orbit Relation yields into the existing Main relation intent session',
    canvas.includes('beginRelationIntent(`workspace:${workspaceOrbit.workspaceId}`')
      && canvas.includes('setRelationSourceId(from)')
      && canvas.includes('link.current = { from }')],
  ['Only the active Workspace relation source mounts a temporary screen-space source port',
    canvas.includes('relationSourceId === `workspace:${frame.workspaceId}`')
      && canvas.includes('workspace-relation-source-port-${frame.workspaceId}')
      && canvas.includes('className="lcos-relation-port workspace-relation-port"')
      && css.includes('.workspace-relation-port')],
  ['Relation target click on Workspace commits before Workspace drag ownership can steal the pointer',
    canvas.includes('if (link.current) {')
      && canvas.includes('const target = `workspace:${frame.workspaceId}`')
      && canvas.includes('if (link.current.from !== target) connect(link.current.from, target)')
      && canvas.includes('suppressWorkspaceOrbitClick.current = frame.workspaceId')],
  ['Workspace keeps its canonical aggregate endpoint identity instead of becoming a fake view endpoint',
    canvas.includes('data-relation-target={`workspace:${frame.workspaceId}`}')
      && canvas.includes('relationById.set(`workspace:${frame.workspaceId}`')
      && endpoints.includes("return entityId ? { entityType: 'workspace', entityId } : null")],
  ['A16 may admit Workspace projections in Context/Workflow without stealing A14 Main Workspace source ownership',
    endpoints.includes("node.id.startsWith('workspace:')")
      && canvas.includes("id: 'workspace-relation'")
      && !canvas.includes('workspace-relation-notch')],
  ['A17 may admit artifact-backed Conversation without changing A14 Workspace ownership',
    endpoints.includes("node.entityKind === 'conversation'")
      && endpoints.includes('node.conversation?.conversationArtifactId?.trim()')
      && endpoints.includes("entityType: 'artifact'")
      && canvas.includes("id: 'conversation-relation'")
      && canvas.includes("id: 'workspace-relation'")],
  ['A14 construction records Workspace WRONG_OWNER as closed while keeping semantic/hit-halo debts open',
    matrix.includes('A14 Workspace Relation Intent Ownership')
      && plan.includes('A14 Workspace Relation Intent Ownership')
      && plan.includes('final receptor screen-space hit-slop / 12–18px edge-halo')],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`A14 Workspace Relation Intent Ownership: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
