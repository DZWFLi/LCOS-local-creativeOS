import fs from 'node:fs'

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const sop = read('docs/v015/convergence/CONSTRUCTION_SOP_FINAL_FROZEN_20260831.md')
const mandatory = read('docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md')
const ledger = read('docs/v015/convergence/LOST_SOURCE_PROVENANCE_LEDGER_20260831.md')
const index = read('docs/v015/convergence/ORIGINAL_SOURCE_ADJUDICATION_INDEX_20260831.md')

const checks = [
  ['FULL READ remains default', sop.includes('FULL READ 仍是默认规则') && mandatory.includes('默认仍要求 FULL READ')],
  ['lost source has explicit reconstructed-authority gate', sop.includes('RAW_SOURCE_LOST') && sop.includes('RECONSTRUCTED_AUTHORITY = PASS')],
  ['snippet cannot impersonate full read', sop.includes('搜索 snippet / 摘要冒充原文 FULL READ') && mandatory.includes('用搜索 snippet 冒充全文')],
  ['conflict still stops for user arbitration', sop.includes('USER_ARBITRATION_REQUIRED') && mandatory.includes('USER_ARBITRATION_REQUIRED / STOP')],
  ['insufficient evidence still stops', sop.includes('RECONSTRUCTION_INSUFFICIENT') && mandatory.includes('RECONSTRUCTION_INSUFFICIENT / STOP')],
  ['ledger records LS-001 without fabricating original', ledger.includes('LS-001') && ledger.includes('它不是原文恢复稿') && ledger.includes('RAW_SOURCE_LOST')],
  ['8/21 v0.3 is explicitly non-sole authority', ledger.includes('不是 LCOS 三 Surface 产品定义的唯一创世来源') && index.includes('不是三 Surface 产品定义的唯一创世来源')],
  ['latest user adjudication makes LS-001 non-blocking for A13', ledger.includes('A13_BLOCKING = NO') && mandatory.includes('NON-BLOCKING for A13')],
]
let passed = 0
for (const [label, ok] of checks) {
  if (ok) { passed += 1; console.log(`PASS ${label}`) }
  else console.error(`FAIL ${label}`)
}
console.log(`SOP-R1 Reconstructed Authority Gate: ${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
