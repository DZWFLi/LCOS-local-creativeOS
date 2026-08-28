import fs from 'node:fs'

const drive = fs.readFileSync('apps/web/src/features/project/ProjectDrive.tsx', 'utf8')
const control = fs.readFileSync('apps/web/src/features/project/ProjectVisualProfileControl.tsx', 'utf8')
const client = fs.readFileSync('apps/web/src/runtime/localCoreClient.ts', 'utf8')

const checks = [
  ['Launcher exposes a restrained project identity control', drive.includes('ProjectVisualProfileControl')],
  ['Project identity editor is a shared popover, not a settings page', control.includes('LcosPopover') && !control.includes('Dialog')],
  ['Project mark choices come only from the contract repertoire', control.includes('PROJECT_GLYPH_MARK_REPERTOIRE')],
  ['Project tint choices come only from contract tokens', control.includes('PROJECT_TINT_TOKENS')],
  ['Visual profile persists through the canonical CAS endpoint', control.includes('saveProjectVisualProfile') && client.includes('/visual-profile')],
  ['CAS conflicts re-read Core truth before retrying', control.includes("['CONFLICT', 'STALE', 'STALE_PRESENTATION_VERSION']") && control.includes('projectVisualProfile(projectId)')],
  ['No arbitrary project SVG or color picker is introduced', !control.includes('type="color"') && !control.includes('svgBytes') && !control.includes('innerHTML')],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (ok) passed += 1
}
console.log(`\n${passed}/${checks.length} F6A2 Project Profile contracts passed`)
if (passed !== checks.length) process.exit(1)
