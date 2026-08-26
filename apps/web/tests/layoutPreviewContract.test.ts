import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source=(path:string)=>readFileSync(new URL(`../src/${path}`,import.meta.url),'utf8')
const app=source('App.tsx')
const workflow=source('features/surfaces/WorkflowSurface.tsx')
const draft=source('state/presentationDraftState.ts')

describe('Phase C preview-first layout contract',()=>{
  it('does not directly mutate Arrange selection when the user asks to organize it',()=>{
    expect(app).toContain('layoutPreviewSync')
    expect(app).toContain('layoutVisualGrid')
    expect(app).toContain('repairVisualLayoutPositions')
    expect(app).toContain('if (internalEdges.length === 0)')
    expect(app).toContain('setLayoutPreview(positions)')
    expect(app).not.toContain('setNodes((current) => arrangeSelectedNodes(current, selectedIds))')
    expect(app).not.toContain('setLayoutPreview([...proposal.positions])')
  })

  it('keeps Workflow manual-first and previews relation layout before committing Presentation positions',()=>{
    expect(workflow).toContain('layoutManualSpatial')
    expect(workflow).not.toContain('layoutWorkflowGraph')
    expect(workflow).toContain('workflow-layout-preview')
    expect(workflow).toContain('const engines = await loadPresentationLayoutEngines()')
    expect(workflow).toContain('chooseLayoutStrategy(layoutInput)')
    expect(workflow).toContain('const result = await runLayoutPreview(')
    expect(workflow).toContain('setLayoutPreview(result)')
    expect(workflow).toContain('applyLayoutPreview')
    expect(workflow).toContain('lcos-layout-ghost')
    expect(workflow).not.toContain('setLayoutPreview(await runLayoutPreview(request,engines))')
  })

  it('records manual workflow drags as Presentation anchors, not canonical position locks',()=>{
    expect(draft).toContain('const pinnedMemory = new Map')
    expect(draft).toContain('usePresentationDraftPinnedIds')
    expect(workflow).toContain('setPinnedIds')
    expect(workflow).not.toContain('positionLocked: true')
  })
})
