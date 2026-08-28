import fs from 'node:fs'
const client = fs.readFileSync('apps/web/src/runtime/localCoreClient.ts','utf8')
const checks = [
 ['Run input exposes canonical receiverRef', client.includes('readonly receiverRef?: RunReceiverRefV1')],
 ['Run input exposes ordered heterogeneous references', client.includes('readonly orderedReferences?: readonly OrderedRunReferenceV2[]')],
 ['Run input exposes authoritative resultSlotId', client.includes('readonly resultSlotId?: string')],
 ['Web client exposes Conversation Reach read model', client.includes('conversationReach(projectId') && client.includes('/connected-conversations/${encodeURIComponent(connectedConversationId)}/reach')],
 ['Web client exposes full ResultSlot lifecycle reads/writes', client.includes('createResultSlot(projectId') && client.includes('resultSlots(projectId') && client.includes('deleteResultSlot(resultSlotId')],
 ['Web client exposes immutable Run Recipe read', client.includes('runRecipe(runId') && client.includes('/recipe')],
]
let passed=0
for (const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'}  ${label}`); if(ok) passed++}
console.log(`\n${passed}/${checks.length} F6B client seams passed`)
if(passed!==checks.length) process.exit(1)
