import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const gesture = read('apps/web/src/features/spatial/projectMaterialRelationGesture.tsx')
const endpoints = read('apps/web/src/features/spatial/projectRelationEndpoint.ts')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const context = read('apps/web/src/features/surfaces/ContextSpaceSurface.tsx')
const workflow = read('apps/web/src/features/surfaces/WorkflowSurface.tsx')
const mandatory = read('docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md')
const e2e = read('tests/e2e/interaction-foundation.spec.ts')
const test = read('apps/web/src/features/spatial/__tests__/projectMaterialRelationGesture.test.ts')

const checks = [
  ['L0 explicitly freezes an extra 12–18px Relation receptive halo', /Relation receptive edge：额外 12[–-]18px halo/.test(mandatory)],
  ['A15 chooses a 16px screen-space tolerance inside the frozen band', gesture.includes('RELATION_RECEPTOR_SCREEN_HALO_PX = 16')],
  ['Halo math is based on getBoundingClientRect screen geometry, not world/camera units', gesture.includes('getBoundingClientRect()') && gesture.includes('relationReceptorScreenDistance(rect, clientX, clientY)') && !/RELATION_RECEPTOR_SCREEN_HALO_PX\s*\/\s*.*zoom/.test(gesture)],
  ['Direct body hit keeps priority before expanded halo lookup', /elementFromPoint\(clientX, clientY\)[\s\S]{0,260}if \(directId && directId !== sourceId\) return directId/.test(gesture)],
  ['Project material receptors use the shared halo helper without generic data-node fallback', gesture.includes("relationTargetWithinScreenHaloAt(clientX, clientY, '[data-project-relation-target]'" ) && !gesture.includes("closest<HTMLElement>('[data-node-id]')")],
  ['Main Workspace receptor receives the same halo without changing its workspace endpoint identity', canvas.includes("relationTargetWithinScreenHaloAt(clientX, clientY, '[data-relation-target]', 'data-relation-target', link.current?.from)") && canvas.includes('data-relation-target={`workspace:${frame.workspaceId}`}')],
  ['Context gives Relation pointer ownership over marquee/drag while active', context.includes('marqueeItems={projectRelation.active ? undefined : marqueeItems}') && context.includes('if (projectRelation.active || event.button !== 0) return') && context.includes('projectMaterialRelationTargetAt(event.clientX, event.clientY, projectRelation.sourceId)')],
  ['Workflow gives Relation pointer ownership over marquee/material drag while active', workflow.includes('marqueeItems={projectRelation.active ? undefined : marqueeItems}') && workflow.includes('if (projectRelation.active || event.button !== 0 || layoutPreview) return') && workflow.includes('projectMaterialRelationTargetAt(event.clientX, event.clientY, projectRelation.sourceId)')],
  ['Context/Workflow halo clicks commit through the existing A13 persistence callback', context.includes('projectRelation.commitTarget(targetId)') && workflow.includes('projectRelation.commitTarget(targetId)')],
  ['A17 extends the same 16px halo to artifact-backed Conversation while unresolved Conversation still fails closed', endpoints.includes("node.entityKind === 'conversation'") && endpoints.includes('node.conversation?.conversationArtifactId?.trim()') && canvas.includes('[data-node-id][data-entity-kind=\"conversation\"][data-conversation-artifact-id]') && endpoints.includes("node.id.startsWith('scope:')") && endpoints.includes("node.id.startsWith('workspace:')") && endpoints.includes('isProjectRelationEligible')],
  ['Unit coverage freezes screen-pixel distance and radial corner behavior', test.includes('toBe(16)') && test.includes('Math.hypot(11, 11)') && test.includes('toBeGreaterThan(RELATION_RECEPTOR_SCREEN_HALO_PX)')],
  ['Browser regression source commits from 14px outside the visible target body', e2e.includes("targetBounds!.x - 14") && e2e.includes('page.mouse.click(targetHaloPoint.x, targetHaloPoint.y)')],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed += 1
}
console.log(`A15 Relation Receptor Halo: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
