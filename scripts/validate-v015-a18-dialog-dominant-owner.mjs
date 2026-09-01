import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const host = read('apps/web/src/features/shell/DialogsHost.tsx')
const owner = read('apps/web/src/features/shell/dialogOwner.ts')
const app = read('apps/web/src/App.tsx')
const test = read('apps/web/src/features/shell/__tests__/dialogOwner.test.ts')
const focusMigrated = fs.existsSync('docs/v015/convergence/A25_4_FOCUS_LOCATION_INDEX_MIGRATION_CLOSEOUT_20260901.md')
  && app.includes('<CenteredSpatialIndex')
  && !app.includes("id: 'project-focus'")

const checks = [
  ['one centralized dominant dialog resolver exists', owner.includes('export function dominantDialogOwner')],
  ['dialog tiers distinguish editor/surface/child/blocking', ['editor','surface','child','blocking'].every((tier) => owner.includes(`'${tier}'`))],
  ['higher tier wins without deleting lower application state', owner.includes('priority < winnerPriority') && owner.includes("winner?.id ?? null")],
  ['DialogsHost consumes dominant owner instead of flat rendering', host.includes('dominantDialogOwner(') && !host.includes('return <>{[')],
  ['typed extra dialogs are explicit candidates, not opaque fragment', host.includes('readonly extraDialogs: readonly DialogLayerCandidate[]') && app.includes('extraDialogs: [') && !app.includes('extraDialogs: <>')],
  ['project create does not remain a permanently mounted false-open candidate', app.includes('projectCreate: projectCreateOpen ? {') && app.includes('open: true,')],
  ['blocking confirmations are in blocking tier', ['confirm-workspace-delete','confirm-scope-delete','confirm-project-delete'].every((id) => host.includes(`id: '${id}', tier: 'blocking'`))],
  ['child dialog causality is explicit for import/detail flows', ['link-reference','conversation-context','obsidian-import','resource-detail'].every((id) => host.includes(`id: '${id}', tier: 'child'`))],
  ['complex App dialogs enter the same arbitration path', ['permission-confirm','revision-upgrade','workspace-states','conversation-controller','reorganize'].every((id) => app.includes(`id: '${id}'`)) && (app.includes("id: 'project-focus'") || focusMigrated)],
  ['permission confirmation is blocking', app.includes("id: 'permission-confirm', tier: 'blocking' as const")],
  ['owner arbitration has unit coverage for parent/child/blocking/tie behavior', ['temporarily outrank','blocking confirmation','deterministic tie breaker'].every((text) => test.includes(text))],
  ['A18 does not replace overlayStack or spatial placement', host.includes("from './dialogOwner'") && !host.includes('registerOverlay') && !owner.includes('getBoundingClientRect')],
]

let pass = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) pass += 1
}
console.log(`A18 Dialog Dominant Owner: ${pass}/${checks.length} PASS`)
if (pass !== checks.length) process.exit(1)
