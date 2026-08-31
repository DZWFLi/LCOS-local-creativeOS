import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const app = read('apps/web/src/App.tsx')
const canvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const surfaceObject = read('apps/web/src/features/surfaces/SurfaceObject.tsx')
const context = read('apps/web/src/features/surfaces/ContextSpaceSurface.tsx')
const workflow = read('apps/web/src/features/surfaces/WorkflowSurface.tsx')
const projection = read('apps/web/src/features/surfaces/ProjectionSurfaces.tsx')
const projectOrbit = read('apps/web/src/features/ui/ProjectObjectOrbit.tsx')
const browser = read('tests/e2e/orbit-lifecycle.spec.ts')

const checks = [
  [
    'Ordinary project objects have a shared ObjectOrbit projection rather than a bespoke toolbar',
    projectOrbit.includes("import { ObjectOrbit, type ObjectOrbitAction } from './ObjectOrbit'")
      && projectOrbit.includes('<ObjectOrbit')
      && projectOrbit.includes("id: 'object-locate'")
      && projectOrbit.includes("id: 'object-pin'"),
  ],
  [
    'Orbit capabilities fail-close: Relation appears only with a wired owner; Assembly / More remain absent',
    projectOrbit.includes('capability gaps must fail-close rather than become fake UI')
      && projectOrbit.includes('readonly onRelation?: () => void')
      && projectOrbit.includes('...(onRelation ?')
      && projectOrbit.includes("id: 'object-relation'")
      && !projectOrbit.includes("id: 'object-assembly'")
      && !projectOrbit.includes("id: 'object-more'"),
  ],
  [
    'Open satellite is capability-driven and excludes Collection / Conversation no-op destinations',
    projectOrbit.includes('export function projectObjectCanOpen')
      && projectOrbit.includes("node.entityKind === 'conversation' || node.entityKind === 'collection'")
      && projectOrbit.includes('onOpen && projectObjectCanOpen(node)'),
  ],
  [
    'Main Canvas opens ordinary ObjectOrbit for a real single-object selection and keeps Conversation on its custom projection',
    canvas.includes('const [projectObjectOrbit, setProjectObjectOrbit]')
      && canvas.includes("node.entityKind !== 'conversation' && !additive && !preservingExistingMultiSelection")
      && canvas.includes('<ProjectObjectOrbit')
      && canvas.includes("node.entityKind === 'conversation' && node.conversation !== undefined"),
  ],
  [
    'Main single-object legacy Selection Strip remains retired and additive selection still dismisses single-object Orbit',
    !canvas.includes('lcos-selection-strip')
      && canvas.includes('selectedIds.length > 1')
      && canvas.includes('setProjectObjectOrbit(null)'),
  ],
  [
    'Explicit Composer becomes the dominant transient layer and dismisses both object Orbit projections',
    canvas.includes('if (!selectionComposerVisible) return')
      && canvas.includes('setConversationOrbit(null)')
      && canvas.includes('setProjectObjectOrbit(null)'),
  ],
  [
    'Shared SurfaceObject provides the same click-open Orbit shell and closes it for multi-selection',
    surfaceObject.includes('const [orbitOpen, setOrbitOpen] = useState(false)')
      && surfaceObject.includes('if (!selected || !orbitEligible) setOrbitOpen(false)')
      && surfaceObject.includes('setOrbitOpen(true)')
      && surfaceObject.includes('<ProjectObjectOrbit'),
  ],
  [
    'Context and Workflow both consume the shared object Orbit with single-selection eligibility',
    context.includes('onLocate={props.onFocusObject} orbitEligible={props.selectedIds.length <= 1}')
      && workflow.includes('onLocate={props.onFocusObject} orbitEligible={props.selectedIds.length <= 1}')
      && projection.includes('onFocusObject?:')
      && projection.includes('onFocusObject:props.onFocusObject'),
  ],
  [
    'Project-level Focus capability is wired from App into Main / Context / Workflow object Orbit',
    app.includes('onFocusNode: (id) => openProjectFocus([id])')
      && app.includes('onFocusObject: (id) => openProjectFocus([id])'),
  ],
  [
    'Browser regression covers ordinary Artifact Orbit, explicit actions, no single Selection Strip, and additive-selection dismissal',
    browser.includes("ordinary Artifact gets Universal ObjectOrbit and single Selection Strip stays retired")
      && browser.includes('data-lcos-orbit-action="object-open"')
      && browser.includes('data-lcos-orbit-action="object-locate"')
      && browser.includes('data-lcos-orbit-action="object-pin"')
      && browser.includes("modifiers: ['Shift']"),
  ],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`A09 Universal ObjectOrbit Coverage: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
