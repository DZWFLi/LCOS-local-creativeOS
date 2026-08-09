import type { ComponentProps, CSSProperties } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { ProjectCanvas } from '../canvas/ProjectCanvas'
import { CanvasMiniMap } from '../canvas/CanvasMiniMap'
import { CapabilityPopover } from './CapabilityPopover'
import { NodeInfoPopover } from '../canvas/NodeInfoPopover'
import { AgentContextSurface } from './AgentContextSurface'
import { WorkspaceRailVNext } from './WorkspaceRailVNext'
import { SurfaceDock, type SurfaceId } from './SurfaceDock'
import { ProjectionSurface } from '../surfaces/ProjectionSurfaces'
import { SurfaceComposerBar } from '../surfaces/SurfaceComposerBar'
import { DropShelf } from '../drop/DropShelf'
import { CanvasEmptyState, FirstArtifactGuide } from '../onboarding/CanvasEmptyState'

export interface CanvasSceneHostProps {
  readonly sceneStyle: CSSProperties
  readonly sceneData: { readonly projectId: string; readonly scopeId: string | null; readonly workspaceId: string | null; readonly workspaceIntent: string }
  readonly capability: ComponentProps<typeof CapabilityPopover> | null
  readonly workspaceRail: ComponentProps<typeof WorkspaceRailVNext>
  readonly surface: SurfaceId
  readonly canvas: ComponentProps<typeof ProjectCanvas>
  readonly projection: ComponentProps<typeof ProjectionSurface>
  readonly composer: ComponentProps<typeof SurfaceComposerBar> | null
  readonly surfaceDock: ComponentProps<typeof SurfaceDock>
  readonly dropShelf: ComponentProps<typeof DropShelf>
  readonly miniMap: ComponentProps<typeof CanvasMiniMap>
  readonly breadcrumbs: { readonly projectLabel: string; readonly items: ReadonlyArray<{ readonly id: string; readonly label: string; readonly current: boolean }>; readonly onEnter: (id: string) => void; readonly onBack: (() => void) | null }
  readonly shortcutHintVisible: boolean
  readonly runPill: { readonly status: string; readonly label: string; readonly onClick: () => void } | null
  readonly layoutPreview: { readonly onApply: () => void; readonly onCancel: () => void } | null
  readonly notice: string | null
  readonly nodeInfo: ComponentProps<typeof NodeInfoPopover> | null
  readonly agentSurface: ComponentProps<typeof AgentContextSurface> | null
  readonly emptyState: ComponentProps<typeof CanvasEmptyState> | null
  readonly firstArtifactGuide: ComponentProps<typeof FirstArtifactGuide> | null
}

/** Persistent shell. Project/Scope/Selection persist while each Lens owns its renderer. */
export function CanvasSceneHost(props: CanvasSceneHostProps) {
  return <section className={`scene lcos-scene intent-${props.sceneData.workspaceIntent} ${props.agentSurface ? 'agent-browser-mode' : ''}`} style={props.sceneStyle} data-project-id={props.sceneData.projectId} data-scope-id={props.sceneData.scopeId ?? undefined} data-workspace-id={props.sceneData.workspaceId ?? 'project-overview'} data-workspace-intent={props.sceneData.workspaceIntent}>
    {props.capability && <CapabilityPopover {...props.capability}/>} 
    <WorkspaceRailVNext {...props.workspaceRail}/>
    {props.surface === 'arrange' && <nav className="canvas-context-bar" aria-label="当前位置与画布状态">
      {props.breadcrumbs.onBack && <button type="button" className="canvas-context-back" aria-label="返回上一层" title="返回上一层" onClick={props.breadcrumbs.onBack}><ArrowLeft size={14}/></button>}
      <div className="canvas-context-path">
        {props.breadcrumbs.items.map((item, index) => <span key={item.id}>{index > 0 && <ChevronRight size={11}/>}<button type="button" className={item.current ? 'current' : ''} disabled={item.current} onClick={() => props.breadcrumbs.onEnter(item.id)}>{item.label}</button></span>)}
      </div>
      {props.shortcutHintVisible && <small className="canvas-context-hint">双击打开 · C 创建 · Ctrl+A 全选</small>}
      {props.runPill && <button type="button" className={`canvas-run-pill status-${props.runPill.status}`} onClick={props.runPill.onClick}><i/>{props.runPill.label}</button>}
    </nav>}
    <div className="vnext-surface-host lcos-surface-host" data-surface={props.surface}>
      <div className="lcos-surface-mount" data-surface-mount={props.surface}>
        {props.surface === 'arrange' ? <ProjectCanvas {...props.canvas}/> : <ProjectionSurface {...props.projection}/>}
      </div>
      {props.surface === 'arrange' && props.emptyState && <CanvasEmptyState {...props.emptyState}/>}
    </div>
    {props.surface === 'arrange' && !props.emptyState && <div className="canvas-hud lcos-canvas-hud" data-testid="canvas-hud"><CanvasMiniMap {...props.miniMap}/></div>}
    {props.surface === 'arrange' && props.firstArtifactGuide && <FirstArtifactGuide {...props.firstArtifactGuide}/>}
    {props.surface !== 'arrange' && props.composer && <SurfaceComposerBar {...props.composer}/>} 
    <SurfaceDock {...props.surfaceDock}/>
    <DropShelf {...props.dropShelf}/>
    {props.agentSurface && <AgentContextSurface {...props.agentSurface}/>} 
    {props.nodeInfo && <NodeInfoPopover {...props.nodeInfo}/>} 
    {props.layoutPreview && <div className="layout-preview-banner lcos-layout-preview"><span>预览布局</span><button onClick={props.layoutPreview.onApply}>应用</button><button onClick={props.layoutPreview.onCancel}>取消</button></div>}
    {props.notice && <div data-testid="toast" className="notice" role="status" aria-live="polite">{props.notice}</div>}
  </section>
}
