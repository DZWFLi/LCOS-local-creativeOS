import { CheckCircle2, History, Play, SquareStack } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'
import { LcosSignalGlyph } from '../../design/DotGlyph'
import { LightSegment } from '../visual/LightSegment'
import { resolveSpatialSignal, shouldShowSignal, type SpatialRuntimeSignal } from '../visual/spatialSignal'
import { WebWorkbench } from '../../workbench/WebWorkbench'

function bindingLabel(element: SurfaceComponentRenderProps['element']) {
  const entry = Object.entries(element.binding ?? {}).find(([, value]) => typeof value === 'string' ? value.length > 0 : Array.isArray(value) && value.length > 0)
  if (!entry) return '还没有连接到真实工作对象'
  const [kind, value] = entry
  return Array.isArray(value)
    ? `已连接 ${value.length} 个真实对象`
    : `已连接 · ${String(value).slice(0, 18)}`
}

function Header({ icon, title, hint, selected, semantic, runtime = 'idle', lightMode = 'static', lightProgress, lightCheckpoint }: { icon: ReactNode; title: string; hint: string; selected?: boolean; semantic?: string; runtime?: SpatialRuntimeSignal; lightMode?: 'static' | 'progress' | 'checkpoint' | 'flow'; lightProgress?: number; lightCheckpoint?: number }) {
  const signal = resolveSpatialSignal({ selected, semantic, runtime })
  return <header className="lcos-workflow-component-header" data-spatial-signal={signal.state}><span className="lcos-workflow-component-icon">{icon}</span><span><strong>{title}</strong><small>{hint}</small></span><LightSegment axis="horizontal" length={26} mode={lightMode} progress={lightProgress} checkpointIndex={lightCheckpoint} active={signal.segmentActive}/>{shouldShowSignal(signal) && <LcosSignalGlyph state={signal.state}/>}</header>
}

export function WorkflowStepComponent({ element, selected }: SurfaceComponentRenderProps) {
  const bound = Boolean(element.binding && Object.keys(element.binding).length)
  return <div className={`lcos-workflow-component workflow-step ${selected ? 'is-selected' : ''}`} data-workflow-component="workflow-step"><Header icon={<Play size={14}/>} title="步骤" hint="当前工作中的一个真实动作" semantic={element.presentation?.variant} selected={selected} lightMode={bound ? 'flow' : 'static'}/><strong className="lcos-workflow-component-binding">{bindingLabel(element)}</strong><footer>动作本身与执行工具分开保存</footer></div>
}

export function ReviewComponent({ element, selected, context }: SurfaceComponentRenderProps) {
  const bound = Boolean(element.binding && Object.keys(element.binding).length)
  const review = context?.reviews?.find((item) => item.runId === element.binding?.runId)
  const semantic = element.presentation?.variant ?? (bound ? 'waiting review' : 'candidate')
  return <div className={`lcos-workflow-component workflow-review ${selected ? 'is-selected' : ''}`} data-workflow-component="review"><Header icon={<CheckCircle2 size={14}/>} title="确认" hint="回看这次修改，再决定保留还是撤回" semantic={semantic} selected={selected} lightMode="checkpoint" lightCheckpoint={2}/><button type="button" className="lcos-workflow-review-state" disabled={!review} onClick={() => review && context?.onOpenReview?.(review.runId)}><span>{review?.phase ?? (bound ? '待判断' : '待连接')}</span><b>{review?.label ?? bindingLabel(element)}</b></button><footer>只会对真实记录过的修改执行保留或撤回</footer></div>
}

export function CheckpointComponent({ element, selected, context }: SurfaceComponentRenderProps) {
  const bound = Boolean(element.binding?.checkpointId)
  const checkpoint = context?.checkpoints?.find((item) => item.checkpointId === element.binding?.checkpointId)
  const semantic = element.presentation?.variant ?? (bound ? 'protected' : 'candidate')
  return <div className={`lcos-workflow-component workflow-checkpoint ${selected ? 'is-selected' : ''}`} data-workflow-component="checkpoint"><Header icon={<History size={14}/>} title="版本" hint="可以从这里恢复工作现场" semantic={semantic} selected={selected} lightMode="checkpoint" lightCheckpoint={1}/><div className="lcos-workflow-checkpoint-row"><span>{checkpoint?.createdAt.slice(0, 10) ?? (bound ? '恢复点' : '待连接')}</span><strong>{checkpoint?.label ?? bindingLabel(element)}</strong></div><footer>只显示真实保存过的现场</footer></div>
}

export function WorkbenchFrameComponent({ element, selected, context }: SurfaceComponentRenderProps) {
  const semantic = element.presentation?.variant ?? 'candidate'
  const ids = new Set([element.binding?.projectViewId, ...(element.binding?.projectViewIds ?? [])].filter((id): id is string => Boolean(id)))
  const pages = (context?.nodes ?? []).filter((node) => ids.has(node.id))
  return <div className={`lcos-workflow-component workflow-workbench ${selected ? 'is-selected' : ''}`} data-workflow-component="workbench"><Header icon={<SquareStack size={14}/>} title="工作材料" hint="当前任务会用到的页面和临时内容" semantic={semantic} selected={selected}/><WebWorkbench pages={pages} onOpenPage={context?.onOpenNode} projectId={context?.projectId}/><footer>{bindingLabel(element)}</footer></div>
}
