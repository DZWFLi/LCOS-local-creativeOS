import fs from 'node:fs'
import crypto from 'node:crypto'

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase()
const exists = (p) => fs.existsSync(p)

const expected = new Map([
  ['docs/v015/convergence/original/LCOS v0.15 GUI 感知层重构与前端施工规划.md', 'E31CC1D56A3DFBF76A42FF9E589C8156A18D2D1B3D11CAEB60000418EA71653C'],
  ['docs/v015/convergence/original/LCOS v0.15 UX 架构第二轮收口与施工清单.md', '64A2320FA7E8B19DDD770515D773254418E6FEB61850AABEA950B1FA1D6FF8FC'],
  ['docs/v015/convergence/original/LCOS_v0.15_UX冻结_同一套物理三个语义现场与Assembly_20260829.md', '2D7C9E50F30E341E285FFFC9F79FAFB790D41512AAB6DB32BD2EE7B70DD119E6'],
  ['docs/v015/convergence/original/LCOS_v0.15_R3D_SkillArtifact_SkillBuilder_CrossSurface_Freeze_20260830.md', 'C94F852BAAACD40205FBB48440EAE496469F867A645C51F0A4089CE2A3F98A69'],
])

const ledger = read('docs/v015/convergence/LOST_SOURCE_PROVENANCE_LEDGER_20260831.md')
const recovery = read('docs/v015/convergence/RECOVERED_SOURCE_PROVENANCE_20260901.md')
const originalIndex = read('docs/v015/convergence/ORIGINAL_SOURCE_ADJUDICATION_INDEX_20260831.md')
const mandatory = read('docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md')
const constructionIndex = read('docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md')
const manifest = read('docs/v015/context-library/MANIFEST.md')
const plan = read('docs/v015/convergence/NIGHT_SHIFT_46_ROUND_CONSTRUCTION_PLAN_20260901.md')

const checks = []

for (const [path, hash] of expected) {
  checks.push([`exact local recovered: ${path}`, exists(path) && sha256(path) === hash])
  checks.push([`manifest hash retained: ${hash.slice(0, 12)}`, manifest.includes(hash)])
}

checks.push(['historical LS-001 loss event retained', ledger.includes('RAW_SOURCE_LOST') && ledger.includes('LS-001')])
checks.push(['current LS-001 external recovery recorded', ledger.includes('RAW_SOURCE_RECOVERED_EXTERNAL') && ledger.includes('LOCAL_VENDOR_PENDING')])
checks.push(['external recovery does not fabricate v0.3 local original', !exists('docs/v015/convergence/original/LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md')])
checks.push(['recovery authority distinguishes three states', recovery.includes('REPO_LOCAL_EXACT') && recovery.includes('RAW_SOURCE_RECOVERED_EXTERNAL') && recovery.includes('RAW_SOURCE_NOT_RECOVERED')])
checks.push(['component screening unresolved is explicit', recovery.includes('LCOS_三大视图组件体系筛选表_v01_20260821.md') && recovery.includes('RAW_SOURCE_NOT_RECOVERED')])
checks.push(['original adjudication current state repaired', originalIndex.includes('RAW_SOURCE_RECOVERED_EXTERNAL / LOCAL_VENDOR_PENDING')])
checks.push(['mandatory points to W0-2 recovery', mandatory.includes('# 50. W0-2 · Recoverable Raw Source Ledger Repair')])
checks.push(['construction index points to W0-2 recovery', constructionIndex.includes('# 19. W0-2 pointer · Raw Source Recovery / Canonical Local Mirrors')])
checks.push(['rolling plan advances to W0-3', plan.includes('W0-2 Recoverable Raw Source Ledger Repair = PASS') && plan.includes('W0-3 Fresh source/runtime census at A23 line = NEXT')])

let passed = 0
for (const [label, ok] of checks) {
  if (ok) {
    passed += 1
    console.log(`PASS ${label}`)
  } else {
    console.error(`FAIL ${label}`)
  }
}
console.log(`W0-2 Recovered Source Ledger Gate: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
