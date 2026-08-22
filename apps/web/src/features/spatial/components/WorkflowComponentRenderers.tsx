import { CheckCircle2, History, Play, SquareStack } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'
import { LcosGlyph } from '../visual/LcosGlyph'
import { LightSegment } from '../visual/LightSegment'
import { resolveSpatialSignal, type SpatialRuntimeSignal } from '../visual/spatialSignal'

function bindingLabel(element: SurfaceComponentRenderProps['element']) {
  const entry = Object.entries(element.binding ?? {}).find(([, value]) => typeof value === 'string' && value.length > 0)
  return entry ? `${entry[0].replace(/Id$/, '')} · ${entry[1]}` : '等待绑定真实 Workflow 对象'
}

function Header({ icon, title, hint, selected, semantic, runtime = 'idle' }: { icon: ReactNode; title: string; hint: string; selected?: boolean; semantic?: string; runtime?: SpatialRuntimeSignal }) {
  const signal = resolveSpatialSignal({ selected, semantic, runtime })
  return <header className="lcos-workflow-component-header" data-spatial-signal={signal.glyph}><span className="lcos-workflow-component-icon">{icon}</span><span><strong>{title}</strong><small>{hint}</small></span><LightSegment axis="horizontal" length={20} active={signal.segmentActive}/><LcosGlyph state={signal.glyph}/></header>
}

export function WorkflowStepComponent({ element, selected }: SurfaceComponentRenderProps) {
  return <div className={`lcos-workflow-component workflow-step ${selected ? 'is-selected' : ''}`} data-workflow-component="workflow-step"><Header icon={<Play size={14}/>} title="步骤" hint="真实 WorkflowAction 的空间适配" semantic={element.presentation?.variant} selected={selected}/><strong className="lcos-workflow-component-binding">{bindingLabel(element)}</strong><footer>Step identity · Executor 独立</footer></div>
}

export function ReviewComponent({ element, selected }: SurfaceComponentRenderProps) {
  const bound = Boolean(element.binding && Object.keys(element.binding).length)
  const semantic = element.presentation?.variant ?? (bound ? 'waiting review' : 'candidate')
  return <div className={`lcos-workflow-component workflow-review ${selected ? 'is-selected' : ''}`} data-workflow-component="review"><Header icon={<CheckCircle2 size={14}/>} title="Review" hint="人工判断与 ChangeSet 回看" semantic={semantic} selected={selected}/><div className="lcos-workflow-review-state"><span>{bound ? '待判断' : '待绑定'}</span><b>{bindingLabel(element)}</b></div><footer>Keep / Revert 由真实 ChangeSet 决定</footer></div>
}

export function CheckpointComponent({ element, selected }: SurfaceComponentRenderProps) {
  const bound = Boolean(element.binding?.checkpointId)
  const semantic = element.presentation?.variant ?? (bound ? 'protected' : 'candidate')
  return <div className={`lcos-workflow-component workflow-checkpoint ${selected ? 'is-selected' : ''}`} data-workflow-component="checkpoint"><Header icon={<History size={14}/>} title="Checkpoint" hint="可恢复的工作现场锚点" semantic={semantic} selected={selected}/><div className="lcos-workflow-checkpoint-row"><span>{bound ? '恢复点' : '待绑定'}</span><strong>{bindingLabel(element)}</strong></div><footer>只绑定 revision / checkpoint identity</footer></div>
}

export function WorkbenchFrameComponent({ element, selected }: SurfaceComponentRenderProps) {
  const semantic = element.presentation?.variant ?? 'candidate'
  return <div className={`lcos-workflow-component workflow-workbench ${selected ? 'is-selected' : ''}`} data-workflow-component="workbench"><Header icon={<SquareStack size={14}/>} title="Workbench" hint="工具宿主外框；真实工具尚未接通" semantic={semantic} selected={selected}/><div className="lcos-workbench-slots"><span>Input</span><span>Tool</span><span>Output</span></div><footer>{bindingLabel(element)}</footer></div>
}
