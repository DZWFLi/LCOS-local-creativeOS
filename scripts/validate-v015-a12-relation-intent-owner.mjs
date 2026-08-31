import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const orbit = read('apps/web/src/features/ui/ProjectObjectOrbit.tsx')
const css = read('apps/web/src/interaction-system.css')
const browser = read('tests/e2e/interaction-foundation.spec.ts')

const checks = [
  ['Ordinary object Orbit exposes Relation only when a real onRelation capability is supplied',
    orbit.includes('readonly onRelation?: () => void')
      && orbit.includes("id: 'object-relation'")
      && orbit.includes('...(onRelation ?')],
  ['Orbit Relation owns explicit intent and yields into a source-owned relation session',
    canvas.includes('const beginRelationIntent =')
      && canvas.includes('setRelationSourceId(from)')
      && canvas.includes('onRelation={() => beginRelationIntent(projectObjectOrbitNode.id')],
  ['Ordinary nodes no longer render the legacy hover relation notch',
    canvas.includes('data-testid={`relation-source-port-${node.id}`}')
      && canvas.includes('className="lcos-relation-port"')
      && !canvas.includes('data-testid={`relation-notch-${node.id}`}')],
  ['Source port exists only for the active relation source and uses a motor-tolerant screen-space hit target',
    canvas.includes('relationSource={relationSourceId === node.id}')
      && css.includes('.lcos-relation-port')
      && css.includes('width:24px;')
      && css.includes('height:36px;')
      && css.includes('scale(calc(.92 / var(--canvas-zoom, 1)))')],
  ['A12 ordinary-object notch retirement remains valid after the later Workspace owner migration',
    !canvas.includes('relation-notch-${node.id}')
      && !css.includes('.canvas-node:hover > .lcos-relation-notch')
      && !css.includes('.canvas-node.selected > .lcos-relation-notch')
      && !canvas.includes('workspace-relation-notch')
      && !css.includes('.workspace-frame:hover > .lcos-relation-notch')],
  ['Relation intent follows pointer and target click commits through existing canonical relation path',
    canvas.includes('if (link.current && link.current.from !== node.id)')
      && canvas.includes('connect(link.current.from, node.id)')
      && canvas.includes('setRelationSourceId(null)')
      && canvas.includes('relationTargetAt(event.clientX, event.clientY)')],
  ['Escape and locked/cancel cleanup clear the explicit relation source instead of leaving stale HUD state',
    /event\.key !== 'Escape'[\s\S]{0,320}setRelationSourceId\(null\)/.test(canvas)
      && /if \(!locked\) return[\s\S]{0,900}setRelationSourceId\(null\)/.test(canvas)],
  ['Blank click during explicit Relation preserves the existing create-and-connect path',
    canvas.includes('if (relationSourceId !== null && link.current)')
      && canvas.includes('setCreateMenu({ from: source')
      && canvas.includes('data-testid="anchor-create-menu"')],
  ['Browser regression starts relation from Orbit, observes the temporary source port, and no longer asks for anchor-out',
    browser.includes('data-lcos-orbit-action="object-relation"')
      && browser.includes('relation-source-port-')
      && !browser.includes('anchor-out-')],
  ['A12 still does not invent Conversation Relation semantics; Workspace source migration is owned by later A14',
    !orbit.includes('conversation-relation')
      && canvas.includes("id: 'workspace-relation'")
      && canvas.includes('workspace-relation-source-port-')],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`A12 Relation Intent Ownership: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
