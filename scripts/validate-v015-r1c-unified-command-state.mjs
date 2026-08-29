import fs from 'node:fs'
const read=(f)=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')
const app=read('apps/web/src/App.tsx')
const host=read('apps/web/src/features/shell/CanvasSceneHost.tsx')
const convo=read('apps/web/src/features/surfaces/ConversationSpaceSurface.tsx')
const state=read('apps/web/src/features/execution/surfaceExecution.ts')
const draft=read('apps/web/src/features/execution/commandDraft.ts')
const composer=read('apps/web/src/features/execution/UnifiedExecutionComposer.tsx')
const warehouse=read('apps/web/src/features/assembly/AssemblyProjectWarehouse.tsx')
const assembly=read('apps/web/src/features/assembly/AssemblyCaptureWorkspace.tsx')
const contracts=read('packages/contracts/src/index.ts')
const repo=read('apps/local-core/src/metadata-repository.ts')
const client=read('apps/web/src/runtime/localCoreClient.ts')
const proposal=read('apps/local-core/src/runtime-proposal-service.ts')
const runs=read('apps/local-core/src/routes/runs.ts')
const checks=[
 ['one SharedComposerCommandState owns Surface/Selection/Receiver/Reference/Prompt', state.includes('interface SharedComposerCommandState')&&state.includes('selectionIds: readonly string[]')&&state.includes('referenceIds: readonly string[]')&&state.includes('receiverId: string | null')&&state.includes('prompt: string')],
 ['Context/Workflow no longer keep local prompt/receiver/reference memories', !host.includes('surfacePrompt')&&!host.includes('surfaceReceiverId')&&!host.includes('surfaceReferenceIds')&&host.includes('surfaceExecution.command')],
 ['Conversation consumes the shared Project command state without forging message refs', convo.includes('execution.command.referenceIds')&&convo.includes('execution.command.nodes')&&convo.includes('referencePickAvailable={false}')&&!convo.includes('referenceIds={[]}')],
 ['Selection and Reference stay distinct but merge deterministically for execution', draft.includes('mergeExecutionReferenceIds')&&composer.includes('当前选择')&&composer.includes('额外参考')&&app.includes('selectionExecutionReferenceIds')],
 ['opening Main composer does not overwrite Reference Set with Selection', !app.includes('setSelectionReferenceIds([...selectedIds])')],
 ['Proposal no longer blocks non-active Receiver or heterogeneous refs', !draft.includes('input.receiverId !== input.activeReceiverId')&&!draft.includes("orderedReference?.ref.type !== 'artifact'")],
 ['Web Proposal sends Receiver/ordered refs/ResultSlot', client.includes('receiverRef?: RunReceiverRefV1')&&client.includes('orderedReferences?: readonly OrderedRunReferenceV2[]')&&app.includes('receiverRef: execution.receiverRef')&&app.includes('orderedReferences: execution.orderedReferences')],
 ['Agent validation preserves the same Unified Execution identity', proposal.includes('input.receiverRef')&&proposal.includes('input.orderedReferences')&&proposal.includes('input.resultSlotId')&&runs.includes("'receiverRef', 'orderedReferences', 'resultSlotId'")],
 ['CommandDraft persists Surface/Selection/Receiver/Reference/Intent state', contracts.includes("surfaceKind: 'main' | 'context' | 'workflow' | 'conversation'")&&contracts.includes('selectionViewIds: readonly string[]')&&contracts.includes('receiverId: string | null')&&repo.includes('#migrate_049_from_v48')&&repo.includes('PRAGMA user_version = 49')],
 ['blank prompt does not erase a non-empty shared command state', app.includes('const hasSharedCommandState = Boolean(selectionComposerText.trim() || selectionReferenceIds.length || selectedIds.length || selectionReceiverId)')],
 ['Assembly Project Warehouse writes into the same Reference Set', warehouse.includes('assembly-warehouse-reference')&&assembly.includes('referenceSet.resolveWarehouseReferenceId')&&app.includes('resolveAssemblyWarehouseReferenceId')&&app.includes('onToggle: toggleSelectionReference')],
 ['unsupported Warehouse identities remain fail-closed', app.includes('orderedReferenceForNode(node, 0).supported ? node.id : null')],
]
let pass=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(ok)pass++}
console.log(`R1-C Unified Command State static: ${pass}/${checks.length}`);if(pass!==checks.length)process.exit(1)
