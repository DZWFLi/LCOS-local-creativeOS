import { Activity, ChevronRight, Layers3, PanelRight, X } from 'lucide-react'
import type { CanvasScope, ProjectPackage, RunStatus } from '../../model'

interface Props {
  projects: ProjectPackage[]
  openProjectIds: string[]
  activeProjectId: string
  scopePath: CanvasScope[]
  saveStatus: 'idle' | 'saving' | 'saved' | 'unsaved'
  runStatus: RunStatus | null
  workRailCollapsed: boolean
  onOpenDrive: () => void
  onOpenProject: (id: string) => void
  onCloseProject: (id: string) => void
  onOpenScope: (id: string) => void
  onToggleWorkRail: () => void
}

export function V07TopBar(props: Props) {
  return <header className="v07-topbar">
    <button className="v07-brand" onClick={props.onOpenDrive}><Layers3 size={17} /><span>Local Creative OS</span></button>
    <div className="v07-project-tabs" role="tablist">
      {props.openProjectIds.map((id) => {
        const project = props.projects.find((item) => item.id === id)
        if (!project) return null
        return <div key={id} className={id === props.activeProjectId ? 'v07-project-tab active' : 'v07-project-tab'}>
          <button role="tab" aria-selected={id === props.activeProjectId} onClick={() => props.onOpenProject(id)}>{project.label}</button>
          <button aria-label={`关闭 ${project.label}`} onClick={() => props.onCloseProject(id)}><X size={12} /></button>
        </div>
      })}
      <button className="v07-add-project" aria-label="打开项目" onClick={props.onOpenDrive}>+</button>
    </div>
    <nav className="v07-scope-path">
      {props.scopePath.map((scope, index) => <span key={scope.id}>
        {index > 0 && <ChevronRight size={12} />}
        <button disabled={index === props.scopePath.length - 1} onClick={() => props.onOpenScope(scope.id)}>{scope.label}</button>
      </span>)}
    </nav>
    <div className="v07-topbar-status">
      {props.runStatus && <span className={`v07-activity-status status-${props.runStatus}`}><Activity size={13} />{props.runStatus === 'review' ? '结果待确认' : props.runStatus}</span>}
      <span className={`v07-save-status ${props.saveStatus}`}>{props.saveStatus === 'saving' ? '正在保存' : props.saveStatus === 'unsaved' ? '保存失败' : '项目已保存'}</span>
      <button className={props.workRailCollapsed ? '' : 'active'} onClick={props.onToggleWorkRail}><PanelRight size={16} /></button>
    </div>
  </header>
}
