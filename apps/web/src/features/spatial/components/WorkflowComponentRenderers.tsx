import { CheckCircle2, History, Play, SquareStack } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'
import { WebWorkbench } from '../../workbench/WebWorkbench'

function bindingLabel(element: SurfaceComponentRenderProps['element']) {
  const entry = Object.entries(element.binding ?? {}).find(([, value]) => typeof value === 'string' && value.length > 0)
  return entry ? `${entry[0].replace(/Id$/, '')} · ${entry[1]}` : '等待绑定真实 Workflow 对象'
}

function Header({ icon, title, hint, selected }: { icon: ReactNode; title: string; hint: string; selected?: boolean }) {
  return <header className="lcos-workflow-component-header"><span className="lcos-workflow-component-icon">{icon}</span><span><strong>{title}</strong><small>{hint}</small></span><i className={selected ? 'is-active' : ''}/></header>
}

export function WorkflowStepComponent({ element, selected }: SurfaceComponentRenderProps) {
  return <div className={`lcos-workflow-component workflow-step ${selected ? 'is-selected' : ''}`} data-workflow-component="workflow-step"><Header icon={<Play size={14}/>} title="步骤" hint="真实 WorkflowAction 的空间适配" selected={selected}/><strong className="lcos-workflow-component-binding">{bindingLabel(element)}</strong><footer>Step identity · Executor 独立</footer></div>
}

export function ReviewComponent({ element, selected }: SurfaceComponentRenderProps) {
  return <div className={`lcos-workflow-component workflow-review ${selected ? 'is-selected' : ''}`} data-workflow-component="review"><Header icon={<CheckCircle2 size={14}/>} title="Review" hint="人工判断与 ChangeSet 回看" selected={selected}/><div className="lcos-workflow-review-state"><span>待判断</span><b>{bindingLabel(element)}</b></div><footer>Keep / Revert 由真实 ChangeSet 决定</footer></div>
}

export function CheckpointComponent({ element, selected }: SurfaceComponentRenderProps) {
  return <div className={`lcos-workflow-component workflow-checkpoint ${selected ? 'is-selected' : ''}`} data-workflow-component="checkpoint"><Header icon={<History size={14}/>} title="Checkpoint" hint="可恢复的工作现场锚点" selected={selected}/><div className="lcos-workflow-checkpoint-row"><span>恢复点</span><strong>{bindingLabel(element)}</strong></div><footer>只绑定 revision / checkpoint identity</footer></div>
}

export function WorkbenchFrameComponent({ element, selected }: SurfaceComponentRenderProps) {
  return <div className={`lcos-workflow-component workflow-workbench ${selected ? 'is-selected' : ''}`} data-workflow-component="workbench"><Header icon={<SquareStack size={14}/>} title="Workbench" hint="工具宿主外框，不拥有内部 runtime" selected={selected}/><WebWorkbench/><footer>{bindingLabel(element)}</footer></div>
}
