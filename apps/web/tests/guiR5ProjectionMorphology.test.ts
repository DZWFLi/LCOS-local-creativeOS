import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const visual = source('features/canvas/CanvasNodeVisual.tsx')
const canvas = source('features/canvas/ProjectCanvas.tsx')
const app = source('App.tsx')
const css = source('interaction-system.css')

describe('GUI R5 Spatial-style Project Entity projections', () => {
  it('gives Context, Workflow and Workspace different physical morphologies on Main', () => {
    // 20260826 注册表做实后，entityKind 分发走 nodeCardRegistry 查表（不同渲染器=不同形态）。
    expect(visual).toContain("registerNodeCard('entity:workflow', WorkflowProjectionObject)")
    expect(visual).toContain("registerNodeCard('entity:workspace', WorkspaceProjectionObject)")
    expect(visual).toContain("registerNodeCard('entity:context', ContextProjectionObject)")
    expect(visual).toContain('lcos-context-projection')
    expect(visual).toContain('lcos-workflow-projection')
    expect(visual).toContain('lcos-workspace-projection')
    expect(css).toContain('Context = a researched dossier')
    expect(css).toContain('Workflow = an action folio')
    expect(css).toContain('Workspace = a saved spatial board snapshot')
  })

  it('renders projection previews from the real referenced Project members', () => {
    expect(app).toContain('bindScopeMembers(context')
    expect(app).toContain('bindScopeMembers(workflow')
    expect(app).toContain("result[`workspace:${workspace.id}`]")
    expect(canvas).toContain('collectionMembersByNodeId[node.id]')
    expect(visual).toContain('ProjectionPreviewTile')
    expect(visual).toContain('workspaceMiniLayout')
  })

  it('shows three Context lens icons only after selection and routes them to real Context surfaces', () => {
    expect(visual).toContain('context-lens-launcher')
    expect(visual).toContain("openLens('space')")
    expect(visual).toContain("openLens('structure')")
    expect(visual).toContain("openLens('evolution')")
    expect(visual).toContain('selected && showControls && onOpenContextLens')
    expect(app).toContain("lens === 'structure' ? 'context-tree'")
    expect(app).toContain("lens === 'evolution' ? 'context-flow' : 'context-space'")
    expect(canvas).toContain('onOpenContextLens={onOpenContextLens}')
  })

  it('keeps the Main Workflow projection morphological while the real Step skeleton lives in Workflow Presentation', () => {
    expect(visual).toContain('lcos-workflow-route-mark')
    expect(visual).toContain('ProjectionAttachment')
    expect(visual).not.toContain('workflowStepTitles')
    const workflow = source('features/surfaces/WorkflowSurface.tsx')
    const contract = readFileSync(new URL('../../../packages/contracts/src/presentations.ts', import.meta.url), 'utf8')
    expect(contract).toContain('workflowActions?: WorkflowActionV0[]')
    expect(workflow).toContain('data-workflow-action-id={action.id}')
    expect(workflow).toContain('attachedViewIds')
  })
})
