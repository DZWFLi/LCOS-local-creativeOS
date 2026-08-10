import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (relative: string) => readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8')
const dock = source('features/shell/SurfaceDock.tsx')
const canvas = source('features/canvas/ProjectCanvas.tsx')
const dropIntent = source('features/drop/dropIntentMachine.ts')
const spatialCamera = source('features/spatial/spatialCamera.ts')
const dialog = source('features/conversations/ConversationContextDialog.tsx')
const workflow = source('features/surfaces/WorkflowSurface.tsx')
const graph = source('features/surfaces/ContextGraphSurface.tsx')
const workspaceDialog = source('features/workspace/WorkspaceDialog.tsx')
const rail = source('features/workrail/WorkRail.tsx')
const app = source('App.tsx')
const css = source('reconstruction.css')

describe('VNext.3 capability frame / project semantics contract', () => {
  it('keeps the capability shell but removes Run/Deliver from the user-facing bottom dock', () => {
    expect(dock).toContain("label:'整理'")
    expect(dock).toContain("label:'上下文'")
    expect(dock).toContain("label:'工作流'")
    expect(dock).toContain("if(next === 'workflow') onSurface('workflow')")
    expect(dock).not.toContain("label:'运行'")
    expect(dock).not.toContain("label:'交付'")
  })

  it('keeps workflow free instead of enforcing lanes or a fixed step schema', () => {
    expect(workflow).toContain('项目自己定义怎么工作')
    expect(workflow).not.toContain('INPUT / CONTEXT')
    expect(workflow).not.toContain('lcos-work-lanes')
  })

  it('does not require a workspace intent taxonomy in the GUI', () => {
    expect(workspaceDialog).not.toContain('understand')
    expect(workspaceDialog).not.toContain('explore')
    expect(workspaceDialog).not.toContain('build')
    expect(workspaceDialog).not.toContain('decide')
    expect(workspaceDialog).toContain('onSave: (input: { label: string })')
  })

  it('keeps conversation history local to one imported conversation and visual', () => {
    expect(dialog).toContain('这里只记录这一条导入对话')
    expect(dialog).toContain('conversation-change-rail')
    expect(dialog).toContain('conversation-change-marker')
    expect(dialog).toContain('标为重点')
    expect(dialog).not.toContain('提升为决策')
    expect(app).toContain('history: []')
    expect(app).toContain('the user-facing Context history belongs to one imported conversation')
  })

  it('derives graph filters from actual project relations rather than a fixed taxonomy', () => {
    expect(graph).toContain('new Set(props.edges.map((edge) => edge.kind))')
    expect(graph).not.toContain("const RELATION_KINDS=['reference','generate','modify','feedback']")
  })

  it('keeps Run as a right-side execution list', () => {
    expect(rail).toContain('data-testid="run-list"')
    expect(rail).toContain('执行')
    expect(app).toContain('setWorkRail((current) => ({ ...current, collapsed: false }))')
  })

  it('preserves the interaction hard gates from the hand-tested Silk baseline', () => {
    expect(css).toContain('.vnext-project-actions { margin-left:auto; display:flex; align-items:center; gap:8px;')
    expect(css).toContain('.lcos-projection-switch { position:relative; display:flex; align-items:center; gap:6px;')
    expect(css).toContain('transform:scale(calc(.8 / var(--canvas-zoom)))')
    expect(css).toContain('transform:scale(calc(1 / var(--canvas-zoom)))')
    expect(css).toContain('bottom:var(--lcos-dock-h) !important')
    expect(dropIntent).toContain('edgeScrollBand: 96')
    expect(dropIntent).toContain('dwellBand: 44')
    expect(dropIntent).toContain('dwellMs: 520')
    expect(spatialCamera).toContain('export function edgeScrollDelta')
    expect(canvas).toContain('restoreDraggedOriginals')
    expect(canvas).toContain('dropStageAnchor.current = state.anchor')
    expect(canvas).toContain('setDropCue')
    expect(canvas).toContain("window.setTimeout(() => hit.click(), 0)")
  })
})
