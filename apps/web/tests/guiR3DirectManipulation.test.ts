import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const app = source('App.tsx')
const canvas = source('features/canvas/ProjectCanvas.tsx')
const rail = source('features/shell/WorkspaceRailVNext.tsx')
const dock = source('features/shell/SurfaceDock.tsx')
const contextHome = source('features/surfaces/ContextRelationshipHomeSurface.tsx')
const signal = source('features/surfaces/ContextFlowSurface.tsx')
const contextSpace = source('features/surfaces/ContextSpaceSurface.tsx')
const workflow = source('features/surfaces/WorkflowSurface.tsx')
const scene = source('features/shell/CanvasSceneHost.tsx')

describe('GUI R3 direct manipulation contract', () => {
  it('makes Left Rail a direct drop destination for ordinary node pointer drag', () => {
    expect(rail).toContain('data-project-view-drop-target={view.id}')
    expect(canvas).toContain("closest<HTMLElement>('[data-project-view-drop-target]')")
    expect(canvas).toContain('onDirectProjectViewDrop(hit.target.id, item.ids)')
    expect(app).toContain('directDropToProjectRailView')
    expect(app).toContain('Project Rail is deliberately project-wide')
    expect(app).toContain("title: 'Workflow'")
    expect(scene).not.toContain('<DropShelf')
    expect(canvas).not.toContain('dropIntentMachine')
    expect(canvas).not.toContain('onStageTransfer')
    expect(canvas).not.toContain('停住以投送')
  })

  it('opens a saved Context directly into its understanding scene without forcing a renderer choice', () => {
    expect(dock).toContain("if(next === 'context') onSurface('context-graph')")
    expect(dock).not.toContain('ProjectionPills')
    expect(app).toContain("setActiveSurface('context-space')")
    expect(app).toContain("setActiveContextId(contextId)")
    expect(contextSpace).toContain('Drop 就是在这里使用')
  })

  it('lets visible Context cards accept material directly and opens them with one click', () => {
    expect(contextHome).toContain('application/x-lcos-project-view')
    expect(contextHome).toContain('onAddMembersToContext')
    expect(contextHome).toContain('onAddMembersToGraph')
    expect(contextHome).toContain('把项目节点拖到这里')
    expect(contextHome).toContain('onClick={(event)=>props.onSelect(viewId,event.metaKey||event.ctrlKey||event.shiftKey)}')
    expect(contextHome).toContain('onDoubleClick={(event)=>{event.stopPropagation();props.onOpenContextView?.(placement.view.id)}}')
    expect(contextHome).toContain('单击选中 · 双击进入 Context')
  })

  it('removes form-first Context organization affordances', () => {
    expect(canvas).not.toContain('aria-label="放入上下文"')
    expect(app).not.toContain('addSelectionToContext')
    expect(signal).toContain('把材料直接拖进这个 Context')
    expect(signal).not.toContain('lcos-context-start-actions')
  })

  it('makes Workflow rail membership project-level without rendering old page UI', () => {
    expect(app).toContain('savedWorkflowViews')
    expect(app).toContain('workflowMembersById')
    expect(app).toContain("appendExactPresentationMembers('workflow', result.scope.id")
    expect(workflow).toContain('not render Workflow Pages or fake operator nodes')
    expect(workflow).not.toContain('workflowPageTargetAt')
    expect(app).toContain('createWorkflowPageDirect')
  })

  it('restores Right-button drag as the only cross-space drop gesture (R3 correction)', () => {
    expect(canvas).toContain('if (semanticDropTriggerFromPointer(event))')
    expect(canvas).toContain('beginCanvasSemanticDrop(')
    expect(canvas).toContain('const cancelSemanticDrop = () =>')
    expect(canvas).toContain('onDirectProjectViewDrop(hit.target.id, item.ids)')
    // Semantic Drop 是交互本身；右键只是最快触发，另有 Alt+左拖 / 拖拽把手
    expect(canvas).toContain('data-semantic-drop-handle')
    expect(canvas).not.toContain('onDirectProjectViewDrop?.(directDrop.id')
    // 只抑制 active right-drag 期间的浏览器菜单，不全局禁用普通右键
    expect(canvas).toContain('contextMenuGuard.current = (menuEvent: Event) =>')
    expect(canvas).toContain("window.addEventListener('contextmenu', contextMenuGuard.current, true)")
  })

  it('keeps R3 legacy-drop removal intact (no DropShelf / stage transfer revival)', () => {
    expect(app).not.toContain('stagedTransfer')
    expect(app).not.toContain('<DropShelf')
    expect(canvas).not.toContain('onStageTransfer')
    expect(canvas).not.toContain('dropStageAnchor')
    expect(canvas).not.toContain('停住以投送')
  })
})
