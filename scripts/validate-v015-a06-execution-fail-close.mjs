import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const app = read('apps/web/src/App.tsx')
const rail = read('apps/web/src/features/workrail/WorkRail.tsx')
const work = read('apps/web/src/features/surfaces/WorkSurface.tsx')
const deliver = read('apps/web/src/features/surfaces/DeliverSurface.tsx')
const contracts = read('apps/web/src/features/surfaces/surfaceContracts.ts')
const s1 = read('scripts/validate-execution-item.mjs')

const checks = [
  [
    'App projects active runtime controls from ExecutionItemV1.availableActions only',
    app.includes('const activeRunActions = useMemo<readonly ExecutionItemAction[]>')
      && app.includes('executionItems.find((item) => item.runId === activeRun.id)?.availableActions ?? []'),
  ],
  [
    'App no longer derives cancel/retry/answer from ActiveRun.status',
    !app.includes('concat(activeRun.status')
      && !app.includes('?? (["queued", "running", "waiting_input", "failed"].includes(activeRun.status)'),
  ],
  [
    'WorkRail fails closed when runActions are absent',
    rail.includes('return runActions?.includes(action) === true')
      && !rail.includes('runActions === undefined || runActions.includes(action)'),
  ],
  [
    'WorkRail review retry is also gated by canonical retry action',
    rail.includes("canAct(runActions, 'retry') && <button className=\"rail-secondary pressable\" data-testid=\"retry-runtime\"")
      && rail.includes('runActions={props.runActions}'),
  ],
  [
    'Workflow work surface gates cancel/retry/answer_input by canonical actions',
    work.includes("canRunAction('cancel')")
      && work.includes("canRunAction('retry')")
      && work.includes("canRunAction('answer_input')")
      && !work.includes("['queued','running','waiting_input'].includes(active.status)&&<button type=\"button\" onClick={runtime?.onCancel}"),
  ],
  [
    'Deliver retry is gated by canonical retry action while review truth stays separate',
    deliver.includes("props.runtime.runActions.includes('retry')===true")
      && deliver.includes("props.runtime.activeRun.status==='review'"),
  ],
  [
    'Surface runtimes carry the same canonical action projection',
    contracts.includes('runActions: readonly ExecutionItemAction[]')
      && (contracts.match(/runActions: readonly ExecutionItemAction\[\]/g) ?? []).length === 2,
  ],
  [
    'Canonical S1 gate prevents status-derived action fallback from returning',
    s1.includes('App 仍按 activeRun.status 猜测 runtime actions，必须 fail-close')
      && s1.includes('WorkRail Review retry 仍可绕过 availableActions')
      && s1.includes('DeliverSurface retry 仍未受 availableActions 控制'),
  ],
]

let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`A06 ExecutionItem Fail-Close: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
