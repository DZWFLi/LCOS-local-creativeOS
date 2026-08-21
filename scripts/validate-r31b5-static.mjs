import { readFile } from 'node:fs/promises'
const files = Object.fromEntries(await Promise.all([
  'contracts','apps/local-core/src/mutation-safety-service.ts','apps/local-core/src/routes/change-sets.ts','apps/local-core/src/routes/relations.ts','apps/local-core/src/feedback-revision-service.ts','apps/local-core/src/routes/revision-workflows.ts','apps/web/src/features/surfaces/WorkflowSurface.tsx','apps/web/src/features/project/ProjectToolsDialog.tsx','apps/web/src/features/shell/AgentContextSurface.tsx'
].map(async (key)=>[key,await readFile(key==='contracts'?'packages/contracts/src/curation-patch.ts':key,'utf8')])) )
const checks=[
 ['ChangeSet contract',files.contracts.includes('MutationChangeSetV1')],
 ['Relation update snapshot',files.contracts.includes("type: 'relation_update'")],
 ['Relation evidence survives undo',files.contracts.includes('evidenceRefs')],
 ['Safe redo',files['apps/local-core/src/mutation-safety-service.ts'].includes('reapply(changeSetId')],
 ['Touched-state guard',files['apps/local-core/src/mutation-safety-service.ts'].includes('TOUCHED_STATE_CHANGED_AFTER_APPLY')],
 ['ChangeSet routes',files['apps/local-core/src/routes/change-sets.ts'].includes('(revert|reapply)')],
 ['Relation routes',files['apps/local-core/src/routes/relations.ts'].includes('deleteRelation')],
 ['Feedback revision service',files['apps/local-core/src/feedback-revision-service.ts'].includes('feedback_revision.changed')],
 ['Feedback → decision relation',files['apps/local-core/src/feedback-revision-service.ts'].includes("'decision'")],
 ['Feedback → change request relation',files['apps/local-core/src/feedback-revision-service.ts'].includes("'change_request'")],
 ['Revision workflow route',files['apps/local-core/src/routes/revision-workflows.ts'].includes('revision-workflows\\/prepare')],
 ['Workflow can persist relation',files['apps/web/src/features/surfaces/WorkflowSurface.tsx'].includes('保存为项目关系')],
 ['Project tools expose history',files['apps/web/src/features/project/ProjectToolsDialog.tsx'].includes('最近项目修改')],
 ['Revision workflow remains available without becoming a mandatory Agent-surface flow',files['apps/local-core/src/routes/revision-workflows.ts'].includes('revision-workflows\\/prepare') && !files['apps/web/src/features/shell/AgentContextSurface.tsx'].includes('建立修改请求')],
]
let ok=0;for(const [name,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${name}`);if(pass)ok++}
console.log(`B5 static gate: ${ok}/${checks.length}`);if(ok!==checks.length)process.exit(1)
