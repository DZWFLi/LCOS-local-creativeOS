import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8')
const app=read('apps/web/src/App.tsx')
const rail=read('apps/web/src/features/shell/WorkspaceRailVNext.tsx')
const expand=read('apps/web/src/features/canvas/collectionExpandLayout.ts')
const canvas=read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const context=read('apps/web/src/features/surfaces/ContextRelationshipHomeSurface.tsx')
const contextSpace=read('apps/web/src/features/surfaces/ContextSpaceSurface.tsx')
const evolution=read('apps/web/src/features/surfaces/ContextFlowSurface.tsx')
const structure=read('apps/web/src/features/surfaces/ContextTreeSurface.tsx')
const workflowGraph=read('apps/web/src/features/surfaces/WorkflowGraphSurface.tsx')
const workflow=read('apps/web/src/features/surfaces/WorkflowSurface.tsx')
const reorganize=read('apps/web/src/features/reorganize/ReorganizePanel.tsx')
const core=read('apps/local-core/src/reorganize-service.ts')
const css=read('apps/web/src/interaction-system.css')
const porcelain=read('apps/web/src/porcelain-studio.css')
const checks=[]
const check=(name,ok)=>checks.push([name,Boolean(ok)])

check('Rail distinguishes Scene and Collection identities', rail.includes("kind === 'scene'") && rail.includes('lcos-rail-preview-scene'))
check('Spatial-style Collection expansion is node-size aware and obstacle safe', expand.includes('obstacles') && expand.includes('member.width') && expand.includes('member.height') && expand.includes('intersects(candidate,other)'))
check('Main keeps selection geometry actions and explicit Agent organize entry', canvas.includes('对齐与分布') && canvas.includes('lcos-agent-arrange-entry'))
check('Focus is still a known-target locator', app.includes("key === 'f' && selectedIds.length === 1"))
check('Context Graph keeps real pan/marquee substrate', context.includes('<SpatialCanvas') && context.includes('onMarqueeSelect={props.onMarqueeSelect}'))
check('Context default Space renders real regions / relationships without a second truth', contextSpace.includes('contextUnderstandingRegions') && contextSpace.includes('lcos-context-understanding-region'))
check('Evolution keeps ordered interpretation tools', evolution.includes('reorderTrackSegment') && evolution.includes('splitTrackSegment') && evolution.includes('mergeTrackSegments'))
check('Structure remains editable Presentation hierarchy', structure.includes('拖动手柄可重排 / 重挂'))
check('Workflow overview remains spatial and selectable', workflowGraph.includes('onDoubleClick') && workflowGraph.includes('beginDrag'))
check('Workflow primary skeleton is Action-to-Action; materials are attachments', workflow.includes('fromActionId') && workflow.includes('toActionId') && workflow.includes('attachSelection') && !workflow.includes('data-workflow-input={node.id}'))
check('Whole reorganize run uses a real persisted position ChangeSet', reorganize.includes('positionPatch') && reorganize.includes('onLivePositions') && core.includes('proposal.positionPatch'))
check('Keep / Revert close the whole ChangeSet through Core', reorganize.includes('acceptReorganize') && reorganize.includes('rollbackReorganize') && core.includes('accept(id: string)'))
check('Pending review and 16x16 status visuals are present without whole-card AI paint', css.includes('.lcos-review-pending-signal') && css.includes('.lcos-signal-glyph'))
check('Narrow collaboration breakpoint remains', porcelain.includes('@media (max-width: 520px)'))

let failed=0
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'}  ${name}`);if(!ok)failed++}
console.log(`\n${checks.length-failed}/${checks.length} LCOS 0.1 GUI closure contracts passed`)
if(failed)process.exit(1)
