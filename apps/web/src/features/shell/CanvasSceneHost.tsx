import type { ComponentProps, CSSProperties } from 'react'
import { Play } from 'lucide-react'
import { WorkspaceDock } from '../workspace/WorkspaceDock'
import { ProjectCanvas } from '../canvas/ProjectCanvas'
import { CanvasMiniMap } from '../canvas/CanvasMiniMap'
import { CapabilityPopover } from './CapabilityPopover'
import { NodeInfoPopover } from '../canvas/NodeInfoPopover'
import { AgentContextSurface } from './AgentContextSurface'

export interface CanvasSceneHostProps {
  readonly sceneStyle: CSSProperties
  readonly sceneData: {
    readonly projectId: string
    readonly scopeId: string | null
    readonly workspaceId: string | null
    readonly workspaceIntent: string
  }
  readonly capability: ComponentProps<typeof CapabilityPopover> | null
  readonly dock: ComponentProps<typeof WorkspaceDock>
  readonly canvas: ComponentProps<typeof ProjectCanvas>
  readonly miniMap: ComponentProps<typeof CanvasMiniMap>
  readonly breadcrumbs: {
    readonly projectLabel: string
    readonly items: ReadonlyArray<{ readonly id: string; readonly label: string; readonly current: boolean }>
    readonly onEnter: (id: string) => void
    readonly onBack: (() => void) | null
  }
  readonly shortcutHintVisible: boolean
  readonly runPill: { readonly status: string; readonly label: string; readonly onClick: () => void } | null
  readonly layoutPreview: { readonly onApply: () => void; readonly onCancel: () => void } | null
  readonly notice: string | null
  readonly nodeInfo: ComponentProps<typeof NodeInfoPopover> | null
  readonly agentSurface: ComponentProps<typeof AgentContextSurface> | null
}

/** 主场景宿主：Dock、Canvas、Mini-map、能力 Popover、面包屑与状态浮层。 */
export function CanvasSceneHost(props: CanvasSceneHostProps) {
  return <section className={`scene intent-${props.sceneData.workspaceIntent}`} style={props.sceneStyle} data-project-id={props.sceneData.projectId} data-scope-id={props.sceneData.scopeId ?? undefined} data-workspace-id={props.sceneData.workspaceId ?? 'project-overview'} data-workspace-intent={props.sceneData.workspaceIntent}>
    {props.capability && <CapabilityPopover {...props.capability} />}
    <WorkspaceDock {...props.dock} />
    <ProjectCanvas {...props.canvas} />
    <div className="canvas-hud" data-testid="canvas-hud"><CanvasMiniMap {...props.miniMap} /></div>
    {props.agentSurface && <AgentContextSurface {...props.agentSurface} />}
    {props.nodeInfo && <NodeInfoPopover {...props.nodeInfo} />}
    {props.runPill && <button className={`run-pill ${props.runPill.status}`} title={props.runPill.status} onClick={props.runPill.onClick}><Play size={13} /> Agent 任务 · {props.runPill.label}</button>}
    <nav className="scene-title v06-breadcrumbs" aria-label="画布层级">{props.breadcrumbs.items.map((scope, index) => (
      <button key={scope.id} data-testid={`scope-crumb-${scope.id}`} aria-current={scope.current ? 'page' : undefined} disabled={scope.current} onClick={() => props.breadcrumbs.onEnter(scope.id)}>{index > 0 && <span>/</span>}{scope.label}</button>
    ))}{props.breadcrumbs.onBack && <button className="scope-back" data-testid="scope-back" onClick={props.breadcrumbs.onBack}>返回上级</button>}</nav>
    {props.shortcutHintVisible && <div className="shortcut-hint"><span aria-hidden="true">⌘</span> 单击内容 · C 输入指令 · Ctrl/Cmd+Enter 执行</div>}
    {props.layoutPreview && <div className="layout-preview-banner"><span>预览自动布局 · 只移动当前子画布中的视图</span><button onClick={props.layoutPreview.onApply}>应用</button><button onClick={props.layoutPreview.onCancel}>取消</button></div>}
    {props.notice && <div data-testid="toast" className="notice" role="status" aria-live="polite">{props.notice}</div>}
  </section>
}
