import { CheckCircle2, History, Play, SquareStack } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'
import { LcosGlyph } from '../visual/LcosGlyph'
import { LightSegment } from '../visual/LightSegment'
import { resolveSpatialSignal, type SpatialRuntimeSignal } from '../visual/spatialSignal'
import { WebWorkbench } from '../../workbench/WebWorkbench'

function bindingLabel(element: SurfaceComponentRenderProps['element']) {
  const entry = Object.entries(element.binding ?? {}).find(([, value]) => typeof value === 'string' ? value.length > 0 : Array.isArray(value) && value.length > 0)
  if (!entry) return '等待绑定真实 Workflow 对象'
  const [kind, value] = entry
  return Array.isArray(value)
    ? `${kind.replace(/Ids$/, '')} · ${value.length} 个真实对象`
    : `${kind.replace(/Id$/, '')} · ${value}`
}

function Header({ icon, title, hint, selected, semantic, runtime = 'idle' }: { icon: ReactNode; title: string; hint: string; selected?: boolean; semantic?: string; runtime?: SpatialRuntimeSignal }) {
  const signal = resolveSpatialSignal({ selected, semantic, runtime })
  return <header className="lcos-workflow-component-header" data-spatial-signal={signal.glyph}><span className="lcos-workflow-component-icon">{icon}</span><span><strong>{title}</strong><small>{hint}</small></span><LightSegment axis="horizontal" length={20} active={signal.segmentActive}/><LcosGlyph state={signal.glyph}/></header>
}

export function WorkflowStepComponent({ element, selected }: SurfaceComponentRenderProps) {
  return <div className={`lcos-workflow-component workflow-step ${selected ? 'is-selected' : ''}`} data-workflow-component="workflow-step"><Header icon={<Play size={14}/>} title="步骤" hint="真实 WorkflowAction 的空间适配" semantic={element.presentation?.variant} selected={selected}/><strong className="lcos-workflow-component-binding">{bindingLabel(element)}</strong><footer>Step identity · Executor 独立</footer></div>
}

export function ReviewComponent({ element, selected, context }: SurfaceComponentRenderProps) {
  const bound = Boolean(element.binding && Object.keys(element.binding).length)
  const review = context?.reviews?.find((item) => item.runId === element.binding?.runId)
  const semantic = element.presentation?.variant ?? (bound ? 'waiting review' : 'candidate')
  return <div className={`lcos-workflow-component workflow-review ${selected ? 'is-selected' : ''}`} data-workflow-component="review"><Header icon={<CheckCircle2 size={14}/>} title="Review" hint="人工判断与 ChangeSet 回看" semantic={semantic} selected={selected}/><button type="button" className="lcos-workflow-review-state" disabled={!review} onClick={() => review && context?.onOpenReview?.(review.runId)}><span>{review?.phase ?? (bound ? '待判断' : '待绑定')}</span><b>{review?.label ?? bindingLabel(element)}</b></button><footer>Keep / Revert 由真实 ChangeSet 决定</footer></div>
}

export function CheckpointComponent({ element, selected, context }: SurfaceComponentRenderProps) {
  const bound = Boolean(element.binding?.checkpointId)
  const checkpoint = context?.checkpoints?.find((item) => item.checkpointId === element.binding?.checkpointId)
  const semantic = element.presentation?.variant ?? (bound ? 'protected' : 'candidate')
  return <div className={`lcos-workflow-component workflow-checkpoint ${selected ? 'is-selected' : ''}`} data-workflow-component="checkpoint"><Header icon={<History size={14}/>} title="Checkpoint" hint="可恢复的工作现场锚点" semantic={semantic} selected={selected}/><div className="lcos-workflow-checkpoint-row"><span>{checkpoint?.createdAt.slice(0, 10) ?? (bound ? '恢复点' : '待绑定')}</span><strong>{checkpoint?.label ?? bindingLabel(element)}</strong></div><footer>只绑定真实 checkpoint identity</footer></div>
}

export function WorkbenchFrameComponent({ element, selected, context }: SurfaceComponentRenderProps) {
  const semantic = element.presentation?.variant ?? 'candidate'
  const ids = new Set([element.binding?.projectViewId, ...(element.binding?.projectViewIds ?? [])].filter((id): id is string => Boolean(id)))
  const pages = (context?.nodes ?? []).filter((node) => ids.has(node.id))
  return <div className={`lcos-workflow-component workflow-workbench ${selected ? 'is-selected' : ''}`} data-workflow-component="workbench"><Header icon={<SquareStack size={14}/>} title="Workbench" hint="项目页面与临时工作材料" semantic={semantic} selected={selected}/><WebWorkbench pages={pages} onOpenPage={context?.onOpenNode}/><footer>{bindingLabel(element)}</footer></div>
}
