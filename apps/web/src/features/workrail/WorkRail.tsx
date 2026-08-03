import { useEffect, type RefObject } from 'react'
import type { RuntimeProviderStatus } from '@local-creative-os/contracts'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  GitCompareArrows,
  History,
  PanelRightClose,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Target,
} from 'lucide-react'
import type { ActiveRun, CanvasNode, Workspace } from '../../model'
import { runStatusLabel } from '../../model'
import type { RunOutputIntent } from '../../runtime/v07UiContracts'
import type { ComposerResultPolicy } from '../canvas/SelectionComposer'
import { deriveWorkRailMode, isRunBusy, type WorkRailMode } from '../../state/workRailMode'
import { PreviewSurface } from './PreviewSurface'

interface Props {
  workspace: Workspace
  nodes: CanvasNode[]
  activeRun: ActiveRun | null
  pendingNode: CanvasNode | null
  collapsed: boolean
  width: number
  contextLabel: string
  contextCount: number
  composerText: string
  composerRef: RefObject<HTMLTextAreaElement | null>
  composerFocusRequest: number
  intent: RunOutputIntent
  provider: string
  resultPolicy: ComposerResultPolicy
  targetId: string | null
  providers: readonly RuntimeProviderStatus[]
  targetCandidates: readonly CanvasNode[]
  onRequestComposerFocus: () => void
  onCollapse: () => void
  onExpand: () => void
  onComposerChange: (value: string) => void
  onIntentChange: (value: RunOutputIntent) => void
  onProviderChange: (value: string) => void
  onResultPolicyChange: (value: ComposerResultPolicy) => void
  onTargetChange: (value: string | null) => void
  onSend: () => void
  onSaveWorkspaceState: () => void
  onOpenWorkspaceStates: () => void
  onAccept: () => void
  onReject: () => void
  onRetry: () => void
  onSyncRun: () => void
  onContinueModify: () => void
  onShowRun: () => void
}

const intentLabels: Record<RunOutputIntent, string> = {
  analyze: '分析',
  create: '创建',
  revise: '修改',
}

const resultLabels: Record<ComposerResultPolicy, string> = {
  reply_only: '仅返回对话',
  create_artifact: '新建内容',
  create_collection: '新建集合',
  draft_revision_per_target: '新版本',
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
      <button className="compact-compose pressable" title={`对${props.contextLabel}执行`} onClick={props.onRequestComposerFocus}><Sparkles size={15} /></button>
    </aside>
  }

  return <aside className="work-rail" data-testid="work-rail" data-mode={mode} style={{ width: props.width }}>
    <WorkRailHeader mode={mode} activeRun={props.activeRun} contextLabel={props.contextLabel} contextCount={props.contextCount} onSaveWorkspaceState={props.onSaveWorkspaceState} onOpenWorkspaceStates={props.onOpenWorkspaceStates} onCollapse={props.onCollapse} />
    <div className="work-rail-body" data-testid="work-rail-body">
      {mode === 'waiting-input' && props.activeRun
        ? <WaitingState run={props.activeRun} onSync={props.onSyncRun} />
        : mode === 'review' && props.activeRun && primary
          ? <ReviewState node={primary} run={props.activeRun} onAccept={props.onAccept} onReject={props.onReject} onRetry={props.onRetry} onContinueModify={props.onContinueModify} />
          : mode === 'run' && props.activeRun
            ? <RunState run={props.activeRun} nodes={props.nodes} onRetry={props.onRetry} onSync={props.onSyncRun} />
            : mode === 'completed' && props.activeRun
              ? <CompletedState run={props.activeRun} nodes={props.nodes} onSaveWorkspaceState={props.onSaveWorkspaceState} />
              : <RailIdleState contextLabel={props.contextLabel} contextCount={props.contextCount} />}
    </div>
    <Composer {...props} mode={mode} />
  </aside>
}

function WorkRailHeader({ mode, activeRun, contextLabel, contextCount, onSaveWorkspaceState, onOpenWorkspaceStates, onCollapse }: {
  mode: WorkRailMode
  activeRun: ActiveRun | null
  contextLabel: string
  contextCount: number
  onSaveWorkspaceState: () => void
  onOpenWorkspaceStates: () => void
  onCollapse: () => void
}) {
  const followsRun = Boolean(activeRun && ['run', 'waiting-input', 'review', 'completed'].includes(mode))
  const title = followsRun && activeRun ? `${activeRun.id} · ${runStatusLabel[activeRun.status]}` : '全局 Agent'
  const meta = followsRun
    ? mode === 'review' ? '结果确认' : mode === 'waiting-input' ? '需要你的确认' : '当前任务'
    : `${contextLabel} · ${contextCount} 项上下文`
  return <header className="work-rail-header">
    <span className="work-rail-focus-dot" />
    <div><span>{meta}</span><h2>{title}</h2></div>
    <div className="work-rail-header-actions">
      <button className="pressable" aria-label="保存当前工作现场" title="保存当前工作现场" onClick={onSaveWorkspaceState}><History size={14} /></button>
      <button className="pressable" aria-label="查看工作现场历史" title="查看工作现场历史" onClick={onOpenWorkspaceStates}><RotateCcw size={14} /></button>
      <button className="pressable" aria-label="折叠 AI 工作栏" title="折叠 AI 工作栏" onClick={onCollapse}><PanelRightClose size={15} /></button>
    </div>
  </header>
}

function RailIdleState({ contextLabel, contextCount }: { contextLabel: string; contextCount: number }) {
  return <div className="rail-section rail-idle">
    <h3>对整个{contextLabel}直接工作</h3>
    <p>这里会把当前范围内的 {contextCount} 个对象作为上下文。针对单个节点或框选内容的任务，请直接在选区下方输入。</p>
    <div className="idle-shortcuts"><kbd>C</kbd><span>聚焦全局输入</span><kbd>Ctrl / Cmd + Enter</kbd><span>执行</span></div>
  </div>
}

function RunState({ run, nodes, onRetry, onSync }: { run: ActiveRun; nodes: CanvasNode[]; onRetry: () => void; onSync: () => void }) {
  const targets = run.targetIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  return <div className="rail-section run-state" data-testid="rail-run">
    <div className={`run-hero status-${run.status}`}><span><Play size={16} fill="currentColor" /></span><div><small>{run.id}</small><h3>{runStatusLabel[run.status]}</h3><p>{run.command}</p></div></div>
    <div className="run-contract-summary"><span>{run.outputIntent ?? 'analyze'}</span><span>{run.provider ?? 'auto'}</span><span>{run.resultPolicy ?? 'reply_only'}</span></div>
    {run.proposalSummary && <p className="run-proposal-summary">{run.proposalSummary}</p>}
    <ol className="run-stages">{['queued','running','waiting_input','review','completed'].map((status, index) => <li className={status === run.status ? 'active' : ''} key={status}><span>{index + 1}</span>{runStatusLabel[status as ActiveRun['status']]}</li>)}</ol>
    <section className="run-targets"><h4>{targets.length ? '编辑对象' : '执行范围'}</h4>{targets.length ? targets.map((node) => <b key={node.id}>{node.title}</b>) : <p>{run.contextIds.length} 项上下文，无直接覆盖目标。</p>}</section>
    <section className="changed-files"><h4>变化文件</h4>{run.changedFiles.length ? run.changedFiles.map((file) => <b key={file}>{file}</b>) : <p>执行器返回后显示文件变化。</p>}</section>
    {run.runtime && <button className="rail-secondary pressable" onClick={onSync}><RefreshCw size={14} />刷新执行状态</button>}
    {run.providerError && <p className="rail-empty-copy">{run.providerError}</p>}
    {run.status === 'failed' && <button className="rail-primary pressable" onClick={onRetry}><RotateCcw size={14} />重新执行</button>}
  </div>
}

function WaitingState({ run, onSync }: { run: ActiveRun; onSync: () => void }) {
  return <div className="rail-section waiting-state" data-testid="rail-waiting-input">
    <div className="waiting-hero"><CircleAlert size={19} /><div><small>{run.id} · 执行器暂停</small><h3>等待输入协议尚未开放</h3><p>LCOS 不会伪造选项。补充要求请在结果节点下方重新发起，或刷新真实 Runtime 状态。</p></div></div>
    <section className="review-summary"><h4>当前指令</h4><ul><li>{run.command}</li><li>Agent：{run.provider ?? 'auto'}</li><li>Current 与历史 Revision 均未改变。</li></ul></section>
    {run.runtime && <button className="rail-secondary pressable" onClick={onSync}><RefreshCw size={14} />刷新执行状态</button>}
  </div>
}

function ReviewState({ node, run, onAccept, onReject, onRetry, onContinueModify }: { node: CanvasNode; run: ActiveRun; onAccept: () => void; onReject: () => void; onRetry: () => void; onContinueModify: () => void }) {
  return <div className="rail-section review-state" data-testid="rail-review">
    <div className="review-heading"><GitCompareArrows size={18} /><div><small>{run.id} · 结果已返回</small><h3>确认这次修改</h3><p>本地 Agent 已返回新的 Draft，原 Current 尚未改变。</p></div></div>
    <div className="review-previews"><PreviewSurface node={{ ...node, kind: 'working', title: '当前版本', draft: false }} variant="before" /><PreviewSurface node={node} variant="after" /></div>
    <section className="review-summary"><h4>本次执行</h4><ul><li>{run.command}</li><li>新版本：{node.revisionId ?? node.title}</li><li>接受后才会切换 Current；拒绝会保留审计记录。</li></ul></section>
    <section className="changed-files"><h4>变化文件</h4>{run.changedFiles.map((file) => <b key={file}>{file}</b>)}</section>
    <button className="rail-primary pressable" data-testid="accept-current" onClick={onAccept}><Check size={15} />接受为当前版本</button>
    <button className="rail-secondary pressable" data-testid="continue-modify" onClick={onContinueModify}>补充修改要求</button>
    <button className="rail-secondary pressable" data-testid="retry-runtime" onClick={onRetry}><RotateCcw size={14} />重新执行</button>
    <button className="rail-secondary danger pressable" data-testid="reject-runtime" onClick={onReject}>拒绝此版本</button>
  </div>
}

function CompletedState({ run, nodes, onSaveWorkspaceState }: { run: ActiveRun; nodes: CanvasNode[]; onSaveWorkspaceState: () => void }) {
  const current = run.pendingArtifactId ? nodes.find((node) => node.id === run.pendingArtifactId) : null
  return <div className="rail-section completed-state" data-testid="rail-completed">
    <div className="completed-hero"><Check size={19} /><div><small>{run.id}</small><h3>结果已归位</h3><p>{current?.title ?? run.changedFiles[0] ?? '本次结果'} 已写入项目过程与版本记录。</p></div></div>
    <section className="review-summary"><h4>接下来</h4><ul><li>继续在节点下方输入下一轮修改</li><li>在 Canvas 中查看 Run、Prompt 与版本来源</li><li>需要阶段留档时保存当前工作现场</li></ul></section>
    <button className="rail-secondary pressable" onClick={onSaveWorkspaceState}><History size={14} />保存当前工作现场</button>
  </div>
}

function Composer(props: Props & { mode: WorkRailMode }) {
  const busy = isRunBusy(props.activeRun)
  const selectedProvider = props.providers.find((item) => item.provider === props.provider)
  const providerUnavailable = selectedProvider?.availability === 'offline'
  const reviseWithoutTarget = props.intent === 'revise' && !props.targetId
  const disabled = !props.composerText.trim() || busy || providerUnavailable || reviseWithoutTarget
  const placeholder = busy ? '当前任务执行中，可以先记录下一步想法……' : props.mode === 'review' ? '继续告诉 Agent 还要怎么改……' : `对${props.contextLabel}提问、分析、创建或修改……`
  const availablePolicies = props.intent === 'analyze'
    ? ['reply_only', 'create_artifact'] as const
    : props.intent === 'create'
      ? ['create_artifact', 'create_collection'] as const
      : ['draft_revision_per_target'] as const
  const reason = busy
    ? `${props.activeRun?.id ?? '任务'} 正在执行，完成或需要确认时工作栏会自动切换。`
    : providerUnavailable
      ? '所选 Agent 当前离线，不能发送。'
      : reviseWithoutTarget
        ? '修改需要先选择一个受管内容作为编辑对象。'
        : `${props.contextLabel}内 ${props.contextCount} 项将进入本次上下文。`
  return <footer className={`work-rail-composer global-context-composer ${busy ? 'is-busy' : ''}`} data-testid="work-rail-composer">
    <div className="composer-context-line"><span><Sparkles size={12} />范围：{props.contextLabel}</span><span>{props.contextCount} 项</span>{props.intent === 'revise' && <span><Target size={12} />{props.targetCandidates.find((node) => node.id === props.targetId)?.title ?? '待选编辑对象'}</span>}</div>
    <div className="composer-box"><textarea data-testid="work-rail-composer-input" ref={props.composerRef} value={props.composerText} onChange={(event) => props.onComposerChange(event.target.value)} onKeyDown={(event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        event.nativeEvent.stopImmediatePropagation()
        if (!disabled) props.onSend()
      }
    }} placeholder={placeholder} /><button className="pressable" disabled={disabled} aria-label="发送指令" title={busy ? '当前任务执行中' : '立即执行 · Ctrl/Cmd+Enter'} onClick={props.onSend}><Send size={16} /></button></div>
    <div className="global-composer-options">
      <label><span>范式</span><select value={props.intent} onChange={(event) => props.onIntentChange(event.target.value as RunOutputIntent)}>{(['analyze', 'create', 'revise'] as const).map((value) => <option key={value} value={value}>{intentLabels[value]}</option>)}</select><ChevronDown size={11} /></label>
      <label><span>Agent</span><select value={props.provider} onChange={(event) => props.onProviderChange(event.target.value)}>{props.providers.map((item) => <option key={item.provider} value={item.provider} disabled={item.availability === 'offline'}>{item.provider === 'workbuddy' ? 'WorkBuddy' : item.provider === 'codex' ? 'Codex' : 'Auto'} · {item.availability}</option>)}</select><ChevronDown size={11} /></label>
      <label><span>结果</span><select value={props.resultPolicy} onChange={(event) => props.onResultPolicyChange(event.target.value as ComposerResultPolicy)}>{availablePolicies.map((value) => <option key={value} value={value}>{resultLabels[value]}</option>)}</select><ChevronDown size={11} /></label>
      {props.intent === 'revise' && <label className="global-target-option"><span>编辑对象</span><select value={props.targetId ?? ''} onChange={(event) => props.onTargetChange(event.target.value || null)}><option value="">选择受管内容</option>{props.targetCandidates.map((node) => <option key={node.id} value={node.id}>{node.title} · {node.revisionLabel ?? 'Current'}</option>)}</select><ChevronDown size={11} /></label>}
    </div>
    <div className="composer-footer"><span>{reason}</span><kbd>C</kbd><span>聚焦输入</span></div>
  </footer>
}
