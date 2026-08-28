import fs from 'node:fs'
const read=(f)=>fs.readFileSync(f,'utf8')
const client=read('apps/web/src/runtime/localCoreClient.ts')
const drive=read('apps/web/src/features/project/ProjectDrive.tsx')
const glyph=read('apps/web/src/features/project/ProjectGlyphMark.tsx')
const checks=[]; const check=(name,ok)=>checks.push({name,ok:Boolean(ok)})
check('Web client consumes canonical Warehouse endpoint', client.includes('/warehouse') && client.includes('WarehouseSnapshotV1'))
check('Semantic Drop client goes only through assembly/apply', client.includes('/assembly/apply') && client.includes('AssemblyApplyRequestV1'))
check('Launcher consumes Core project summary instead of pendingCount', drive.includes('client.projectSummary(project.id)') && drive.includes('summary.objectCount') && !drive.includes('project.pendingCount} 个对象'))
check('Launcher consumes versioned Core visual profile', drive.includes('client.projectVisualProfile(project.id)') && drive.includes('profile?.glythMarkId'))
check('Visual profile stays Project Glyph identity, not Conversation Glyth', glyph.includes('shapeId?: LcosIconShape') && !glyph.includes('LcosGlyth') && !glyph.includes('SessionLifecycle'))
check('Web client exposes CAS visual-profile write seam', client.includes('saveProjectVisualProfile') && client.includes('UpsertProjectVisualProfileInputV0'))
check('Web client exposes Skills as read-only catalog', client.includes('projectSkills(') && client.includes('projectSkill(') && !client.includes('applySkillAssembly'))
let failed=0
for(const c of checks){console.log(`${c.ok?'PASS':'FAIL'}  ${c.name}`); if(!c.ok) failed++}
console.log(`\n${checks.length-failed}/${checks.length} F6A Core consumption contracts passed`)
if(failed)process.exit(1)
