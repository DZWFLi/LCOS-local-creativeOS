import { useEffect, type RefObject } from 'react'
import {
  Check,
  ChevronLeft,
  CircleAlert,
  GitCompareArrows,
  Layers3,
  PanelRightClose,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Target,
} from 'lucide-react'
import type { ActiveRun, CanvasNode, TargetContextInference, Workspace } from '../../model'
import { runStatusLabel } from '../../model'
import { deriveWorkRailMode, isRunBusy, type WorkRailMode } from '../../state/workRailMode'
import { PreviewSurface } from './PreviewSurface'

interface Props {
  workspace: Workspace
  nodes: CanvasNode[]
  inference: TargetContextInference
  activeRun: ActiveRun | null
  pendingNode: CanvasNode | null
  collapsed: boolean
  width: number
  composerText: string
  composerRef: RefObject<HTMLTextAreaElement | null>
  composerFocusRequest: number
  onRequestComposerFocus: () => void
  onCollapse: () => void
  onExpand: () => void
  onComposerChange: (value: string) => void
  onSend: () => void
  onContinue: (answer: '35%' | '30%') => void
  onAccept: () => void
  onReject: () => void
  onRetry: () => void
  onSyncRun: () => void
  onContinueModify: () => void
  onShowRun: () => void
}

export function WorkRail(props: Props) {
  const primary = props.pendingNode
  const mode = deriveWorkRailMode({ activeRun: props.activeRun, pendingNode: props.pendingNode })

  useEffect(() => {
    if (props.collapsed || props.composerFocusRequest <= 0) return
    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const composer = props.composerRef.current
        if (!composer) return
        composer.focus({ preventScroll: true })
        const end = composer.value.length
        composer.setSelectionRange(end, end)
      })
    })
    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) window.cancelAnimationFrame(secondFrame)
    }
  }, [props.collapsed, props.composerFocusRequest, props.composerRef])

  if (props.collapsed) {
    return <aside className="work-rail compact" data-testid="work-rail" data-mode={mode} aria-label="AI 工作栏已折叠">
      <button className="work-rail-expand pressable" aria-label="展开 AI 工作栏" title="展开 AI 工作栏" onClick={props.onExpand}><ChevronLeft size={15} /></button>
      {props.activeRun && <button className={`compact-run status-${props.activeRun.status} pressable`} title={`${props.activeRun.id} · ${runStatusLabel[props.activeRun.status]}`} onClick={() => { props.onShowRun(); props.onExpand() }}><Play size={14} /></button>}
      <button className="compact-compose pressable" title="输入 AI 指令" onClick={props.onRequestComposerFocus}><Sparkles size={15} /></button>
    </aside>
  }

  return <aside className="work-rail" data-testid="work-rail" data-mode={mode} style={{ width: props.width }}>
    <WorkRailHeader mode={mode} activeRun={props.activeRun} onCollapse={props.onCollapse} />
    <div className="work-rail-body" data-testid="work-rail-body">
      {mode === 'waiting-input'
        ? <WaitingState onContinue={props.onContinue} />
        : mode === 'review' && props.activeRun && primary
          ? <ReviewState node={primary} run={props.activeRun} onAccept={props.onAccept} onReject={props.onReject} onRetry={props.onRetry} onContinueModify={props.onContinueModify} />
          : mode === 'run' && props.activeRun
            ? <RunState run={props.activeRun} nodes={props.nodes} onRetry={props.onRetry} onSync={props.onSyncRun} />
            : mode === 'completed' && props.activeRun
              ? <CompletedState run={props.activeRun} nodes={props.nodes} />
              : <RailIdleState />}
    </div>
    <Composer {...props} mode={mode} />
  </aside>
}

function WorkRailHeader({ mode, activeRun, onCollapse }: {
  mode: WorkRailMode
  activeRun: ActiveRun | null
  onCollapse: () => void
}) {
  const followsRun = Boolean(activeRun && ['run', 'waiting-input', 'review', 'completed'].includes(mode))
  const title = followsRun && activeRun ? `${activeRun.id} · ${runStatusLabel[activeRun.status]}` : 'AI 工作栏'
  const meta = followsRun
    ? mode === 'review' ? '结果确认' : mode === 'waiting-input' ? '需要你的确认' : '当前任务'
    : '输入与执行'
  return <header className="work-rail-header">
    <span className="work-rail-focus-dot" />
    <div><span>{meta}</span><h2>{title}</h2></div>
    <button className="pressable" aria-label="折叠 AI 工作栏" title="折叠 AI 工作栏" onClick={onCollapse}><PanelRightClose size={15} /></button>
  </header>
}

function RailIdleState() {
  return <div className="rail-section rail-idle">
    <h3>直接告诉 AI 要做什么</h3>
    <p>先在画布上选择目标，再点击节点上方的“AI 修改”或按 C。节点信息与高频操作留在画布附近。</p>
    <div className="idle-shortcuts"><kbd>C</kbd><kbd>Ctrl / Cmd + Enter</kbd></div>
  </div>
}

function RunState({ run, nodes, onRetry, onSync }: { run: ActiveRun; nodes: CanvasNode[]; onRetry: () => void; onSync: () => void }) {
  const targets = run.targetIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  return <div className="rail-section run-state" data-testid="rail-run">
    <div className={`run-hero status-${run.status}`}><span><Play size={16} fill="currentColor" /></span><div><small>{run.id}</small><h3>{runStatusLabel[run.status]}</h3><p>{run.command}</p></div></div>
    <ol className="run-stages">{['queued','running','waiting_input','review','completed'].map((status, index) => <li className={status === run.status ? 'active' : ''} key={status}><span>{index + 1}</span>{runStatusLabel[status as ActiveRun['status']]}</li>)}</ol>
    <section className="run-targets"><h4>修改目标</h4>{targets.map((node) => <b key={node.id}>{node.title}</b>)}</section>
    <section className="changed-files"><h4>变化文件</h4>{run.changedFiles.length ? run.changedFiles.map((file) => <b key={file}>{file}</b>) : <p>执行器返回后显示文件变化。</p>}</section>
    {run.runtime && <button className="rail-secondary pressable" onClick={onSync}><RefreshCw size={14} />刷新执行状态</button>}
    {run.providerError && <p className="rail-empty-copy">{run.providerError}</p>}
    {run.status === 'failed' && <button className="rail-primary pressable" onClick={onRetry}><RotateCcw size={14} />重新执行</button>}
  </div>
}

function WaitingState({ onContinue }: { onContinue: (answer: '35%' | '30%') => void }) {
  return <div className="rail-section waiting-state" data-testid="rail-waiting-input">
    <div className="waiting-hero"><CircleAlert size={19} /><div><small>需要你的确认</small><h3>第 5 页使用哪个节能数据？</h3><p>客户反馈提出 35%，当前版本仍保留旧版 30%。</p></div></div>
    <button className="waiting-option recommended pressable" onClick={() => onContinue('35%')}><b>使用客户反馈 35%</b><span>推荐 · 客户反馈 07/17</span></button>
    <button className="waiting-option pressable" onClick={() => onContinue('30%')}><b>保留旧版 30%</b><span>不修改当前数值</span></button>
    <div className="waiting-sources"><span>参考</span><b>客户反馈 07/17</b><b>当前提案 V3</b></div>
  </div>
}

function ReviewState({ node, run, onAccept, onReject, onRetry, onContinueModify }: { node: CanvasNode; run: ActiveRun; onAccept: () => void; onReject: () => void; onRetry: () => void; onContinueModify: () => void }) {
  return <div className="rail-section review-state" data-testid="rail-review">
    <div className="review-heading"><GitCompareArrows size={18} /><div><small>{run.id} · 结果已返回</small><h3>确认这次修改</h3><p>WorkBuddy 已返回新的 Draft，原 Current 尚未改变。</p></div></div>
    <div className="review-previews"><PreviewSurface node={{ ...node, kind: 'working', title: '当前版本', draft: false }} variant="before" /><PreviewSurface node={node} variant="after" /></div>
    <section className="review-summary"><h4>本次执行</h4><ul><li>{run.command}</li><li>新版本：{node.revisionId ?? node.title}</li><li>接受后才会切换 Current；拒绝会保留审计记录。</li></ul></section>
    <section className="changed-files"><h4>变化文件</h4>{run.changedFiles.map((file) => <b key={file}>{file}</b>)}</section>
    <button className="rail-primary pressable" data-testid="accept-current" onClick={onAccept}><Check size={15} />接受为当前版本</button>
    <button className="rail-secondary pressable" data-testid="continue-modify" onClick={onContinueModify}>补充修改要求</button>
    <button className="rail-secondary pressable" data-testid="retry-runtime" onClick={onRetry}><RotateCcw size={14} />重新执行</button>
    <button className="rail-secondary danger pressable" data-testid="reject-runtime" onClick={onReject}>拒绝此版本</button>
  </div>
}

function CompletedState({ run, nodes }: { run: ActiveRun; nodes: CanvasNode[] }) {
  const current = run.pendingArtifactId ? nodes.find((node) => node.id === run.pendingArtifactId) : null
  return <div className="rail-section completed-state" data-testid="rail-completed">
    <div className="completed-hero"><Check size={19} /><div><small>{run.id}</small><h3>修改已归位</h3><p>{current?.title ?? run.changedFiles[0] ?? '新版本'} 已成为当前版本。</p></div></div>
    <section className="review-summary"><h4>接下来</h4><ul><li>继续输入下一轮修改</li><li>在 Canvas 中查看版本关系</li><li>创建检查点保存稳定修改集</li></ul></section>
  </div>
}

function Composer(props: Props & { mode: WorkRailMode }) {
  const targetNames = props.inference.targetIds.map((id) => props.nodes.find((node) => node.id === id)?.title).filter(Boolean)
  const contextNames = props.inference.contextIds.map((id) => props.nodes.find((node) => node.id === id)?.title).filter(Boolean)
  const hasResolvableTarget = props.inference.targetIds.length > 0 || props.inference.ambiguousTargetIds.length > 0
  const busy = isRunBusy(props.activeRun)
  const disabled = !props.composerText.trim() || !hasResolvableTarget || busy
  const placeholder = busy ? '当前任务执行中，可以先记录下一步想法……' : props.mode === 'review' ? '继续告诉 AI 还要怎么改……' : '告诉 AI 你想怎么改……'
  const reason = busy ? `${props.activeRun?.id ?? '任务'} 正在执行，完成或需要确认时工作栏会自动切换。` : props.inference.reason
  return <footer className={`work-rail-composer ${busy ? 'is-busy' : ''}`} data-testid="work-rail-composer">
    <div className="composer-context-line"><span><Target size={12} />目标：{targetNames[0] ?? '待确认'}</span><span><Layers3 size={12} />参考：{contextNames.length ? `${contextNames[0]}${contextNames.length > 1 ? ` 等 ${contextNames.length} 项` : ''}` : '当前工作视角'}</span><span><Sparkles size={12} />执行：WorkBuddy</span></div>
    <div className="composer-box"><textarea data-testid="work-rail-composer-input" ref={props.composerRef} value={props.composerText} onChange={(event) => props.onComposerChange(event.target.value)} onKeyDown={(event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        event.nativeEvent.stopImmediatePropagation()
        if (!disabled) props.onSend()
      }
    }} placeholder={placeholder} /><button className="pressable" disabled={disabled} aria-label="发送指令" title={busy ? '当前任务执行中' : '检查并执行 · Ctrl/Cmd+Enter'} onClick={props.onSend}><Send size={16} /></button></div>
    <div className="composer-footer"><span>{reason}</span><kbd>C</kbd><span>聚焦输入</span></div>
  </footer>
}
