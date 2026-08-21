import { readFile } from 'node:fs/promises'
const paths=['packages/contracts/src/continuity.ts','apps/local-core/src/continuity-runtime-service.ts','apps/local-core/src/routes/continuity.ts','apps/local-core/src/metadata-repository.ts','tools/lcos-agent/cli.mjs','apps/web/src/features/project/ProjectToolsDialog.tsx']
const [contracts,service,routes,repo,cli,tools]=await Promise.all(paths.map((p)=>readFile(p,'utf8')))
const checks=[
 ['Continuity contracts',contracts.includes('ContinuityResumeSnapshotV1')&&contracts.includes('ContinuityAttachBundleV1')],
 ['Project resolver reused',service.includes('resolveProjectAffinity')],
 ['Session binding reused',service.includes('upsertSessionContextRef')],
 ['B4 Attention reused',service.includes('attentionRuntime.snapshot')],
 ['Realtime cursor included',service.includes('currentSeq(projectId)')],
 ['Provider-neutral attach',service.includes('attachBundle')&&contracts.includes('provider?: string')],
 ['Return intake',service.includes('intakeReturn')],
 ['Return atomic record',repo.includes('createContinuityReturnRecord')&&repo.includes("BEGIN IMMEDIATE")],
 ['Resolve route',routes.includes('/runtime/continuity/resolve')],
 ['Resume route',routes.includes('continuity\\/resume')],
 ['Attach route',routes.includes('continuity\\/attach')],
 ['Return route',routes.includes('continuity\\/returns')],
 ['CLI resolve',cli.includes('continuity" && action === "resolve')],
 ['CLI attach',cli.includes('continuity" && action === "attach')],
 ['CLI return',cli.includes('continuity" && action === "return')],
 ['No hidden continuity model call in project tools',!tools.includes('props.client.continuityResume(props.project.id, {}),')],
]
let ok=0;for(const [name,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${name}`);if(pass)ok++}
console.log(`B6 static gate: ${ok}/${checks.length}`);if(ok!==checks.length)process.exit(1)
