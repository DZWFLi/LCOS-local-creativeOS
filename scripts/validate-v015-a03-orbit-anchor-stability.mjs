import fs from 'node:fs'

const canvas = fs.readFileSync('apps/web/src/features/canvas/ProjectCanvas.tsx', 'utf8').replace(/\r\n/g, '\n')
const locationOrbit = fs.readFileSync('apps/web/src/features/focus/ArtifactLocationOrbit.tsx', 'utf8').replace(/\r\n/g, '\n')
const orbit = fs.readFileSync('apps/web/src/features/ui/ObjectOrbit.tsx', 'utf8').replace(/\r\n/g, '\n')

const checks = [
  [
    'ObjectOrbit outside-pointer ownership tracks the latest anchor element without depending on caller ref-object identity',
    orbit.includes('const anchorNodeRef = useRef<Element | null>(null)')
      && orbit.includes('anchorNodeRef.current = anchorRef?.current ?? null')
      && orbit.includes('anchorNodeRef.current?.contains(target) === true')
      && orbit.includes('const stack = queryStack()')
      && orbit.includes('stack[stack.length - 1]?.id !== orbitId')
      && (orbit.includes('}, [open, close])') || orbit.includes('}, [open, close, orbitId])'))
      && !orbit.includes('}, [open, close, anchorRef])'),
  ],
  [
    'Conversation Orbit passes a stable memoized anchor ref instead of recreating an inline ref object',
    canvas.includes('const conversationOrbitAnchorRef = useMemo(() => ({ current: conversationOrbitAnchor }), [conversationOrbitAnchor])')
      && canvas.includes('anchorRef={conversationOrbitAnchorRef}')
      && !canvas.includes('anchorRef={{ current: conversationOrbit.anchor }}'),
  ],
  [
    'Artifact Location Orbit keeps the same stable anchor-ref ownership rule',
    locationOrbit.includes('const anchorRef = useMemo(() => ({ current: props.anchor }), [props.anchor])')
      && locationOrbit.includes('anchorRef={anchorRef}'),
  ],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) {
    passed += 1
    console.log(`PASS ${label}`)
  } else {
    console.error(`FAIL ${label}`)
  }
}

console.log(`A03 Orbit Anchor Stability: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
