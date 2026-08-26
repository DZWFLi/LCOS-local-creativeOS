import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (relative: string) => readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8')
const dock = source('features/shell/SurfaceDock.tsx')
const canvas = source('features/canvas/ProjectCanvas.tsx')
const spatialCamera = source('features/spatial/spatialCamera.ts')
const dialog = source('features/conversations/ConversationContextDialog.tsx')
const workflow = source('features/surfaces/WorkflowSurface.tsx')
const workspaceDialog = source('features/workspace/WorkspaceDialog.tsx')
const rail = source('features/workrail/WorkRail.tsx')
const app = source('App.tsx')
const css = source('reconstruction.css')

describe('VNext.3 capability frame / project semantics contract', () => {
  it('keeps the capability shell but removes Run/Deliver from the user-facing bottom dock', () => {
    expect(dock).toContain("label:'主画布'")
    expect(dock).toContain("label:'上下文'")
    expect(dock).toContain("label:'工作流'")
    expect(dock).toContain("if(next === 'workflow') onSurface('workflow')")
    expect(dock).not.toContain("label:'运行'")
    expect(dock).not.toContain("label:'交付'")
  })

  it('keeps workflow freeform while separating the action skeleton from materials', () => {
    expect(workflow).toContain('Workflow is an action scene, not a second material graph')
    expect(workflow).toContain('WorkflowActionV0 is Presentation-only Step state')
    expect(workflow).not.toContain('INPUT / CONTEXT')
    expect(workflow).not.toContain('lcos-work-lanes')
    expect(workflow).not.toContain('lcos-workflow-operator-palette')
  })

  it('does not require a workspace intent taxonomy in the GUI', () => {
    expect(workspaceDialog).not.toContain('understand')
    expect(workspaceDialog).not.toContain('explore')
    expect(workspaceDialog).not.toContain('build')
    expect(workspaceDialog).not.toContain('decide')
    expect(workspaceDialog).toContain('onSave: (input: { label: string })')
    expect(workspaceDialog).not.toContain('WorkspaceSeedMode')
  })

  it('keeps conversation history local to one imported conversation and visual', () => {
    expect(dialog).toContain('这里只记录这一条导入对话')
    expect(dialog).toContain('conversation-change-rail')
    expect(dialog).toContain('conversation-change-marker')
    expect(dialog).toContain('标为重点')
    expect(dialog).not.toContain('提升为决策')
    // Checkpoint 时间线（B5）：Context 表面历史栏 = Core 项目快照（「对比当前 / 从这里建现场」复用既有回调）
    expect(app).toContain('history: coreContextSnapshots.map')
    expect(app).toContain('Context 历史 = Core 项目快照')
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
    expect(spatialCamera).toContain('export function edgeScrollDelta')
    expect(canvas).toContain('restoreDraggedOriginals')
    expect(canvas).toContain("closest<HTMLElement>('[data-project-view-drop-target]')")
    expect(canvas).toContain('onDirectProjectViewDrop(hit.target.id, item.ids)')
    expect(canvas).not.toContain('dropIntentMachine')
    expect(canvas).not.toContain('onStageTransfer')
    expect(canvas).not.toContain('setDropCue')
  })
})
