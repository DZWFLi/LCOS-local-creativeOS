import { useEffect, useState, type RefObject } from 'react'
import type { RunEvent, RuntimeProviderStatus } from '@local-creative-os/contracts'
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
} from 'lucide-react'
import type { ActiveRun, CanvasNode, Workspace } from '../../model'
import { runStatusLabel } from '../../model'
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
  provider: string
  createAsNewNode: boolean
  providers: readonly RuntimeProviderStatus[]
  onRequestComposerFocus: () => void
  onCollapse: () => void
  onExpand: () => void
  onComposerChange: (value: string) => void
  onProviderChange: (value: string) => void
  onCreateAsNewNodeChange: (value: boolean) => void
  onSend: () => void
  onSaveWorkspaceState: () => void
  onOpenWorkspaceStates: () => void
  onAccept: () => void
  onReject: () => void
  onRetry: () => void
  onSyncRun: () => void
  onCancelRun: () => void
  runEvents: readonly RunEvent[]
  runEventsError: string | null
  runtimeRecovering: boolean
  onRecoverRun: () => void
  onAnswerInput: (input: { readonly requestId: string; readonly text?: string; readonly selectedOptions?: readonly string[] }) => void
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
      {props.activeRun && <button className={`compact-run status-${props.activeRun.status} pressable`} title={runStatusLabel[props.activeRun.status]} onClick={() => { props.onShowRun(); props.onExpand() }}><Play size={14} /></button>}
      <button className="compact-compose pressable" title={`对${props.contextLabel}执行`} onClick={props.onRequestComposerFocus}><Sparkles size={15} /></button>
    </aside>
  }

  return <aside className="work-rail" data-testid="work-rail" data-mode={mode} style={{ width: props.width }}>
    <WorkRailHeader mode={mode} activeRun={props.activeRun} contextLabel={props.contextLabel} contextCount={props.contextCount} onSaveWorkspaceState={props.onSaveWorkspaceState} onOpenWorkspaceStates={props.onOpenWorkspaceStates} onCollapse={props.onCollapse} />
    <div className="work-rail-body" data-testid="work-rail-body">
      {mode === 'waiting-input' && props.activeRun
        ? <WaitingState run={props.activeRun} onSync={props.onSyncRun} onAnswer={props.onAnswerInput} />
        : mode === 'review' && props.activeRun && primary
          ? <ReviewState node={primary} run={props.activeRun} onAccept={props.onAccept} onReject={props.onReject} onRetry={props.onRetry} onContinueModify={props.onContinueModify} />
          : mode === 'run' && props.activeRun
            ? <RunState run={props.activeRun} nodes={props.nodes} onRetry={props.onRetry} onSync={props.onSyncRun} onCancel={props.onCancelRun} onRecover={props.onRecoverRun} recovering={props.runtimeRecovering} />
            : mode === 'completed' && props.activeRun
              ? <CompletedState run={props.activeRun} nodes={props.nodes} onSaveWorkspaceState={props.onSaveWorkspaceState} />
              : <RailIdleState contextLabel={props.contextLabel} contextCount={props.contextCount} />}
      {props.activeRun && <RunActivity events={props.runEvents} error={props.runEventsError} />}
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
  const title = followsRun && activeRun ? `Agent 任务 · ${runStatusLabel[activeRun.status]}` : '全局 Agent'
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

function RunState({ run, nodes, onRetry, onSync, onCancel, onRecover, recovering }: { run: ActiveRun; nodes: CanvasNode[]; onRetry: () => void; onSync: () => void; onCancel: () => void; onRecover: () => void; recovering: boolean }) {
  const targets = run.targetIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  const stages: ActiveRun['status'][] = run.status === 'cancelled'
    ? ['queued', 'running', 'cancelled']
    : ['queued', 'running', 'waiting_input', 'review', 'completed']
  return <div className="rail-section run-state" data-testid="rail-run">
    <div className={`run-hero status-${run.status}`}><span><Play size={16} fill="currentColor" /></span><div><small>本地 Agent 任务</small><h3>{runStatusLabel[run.status]}</h3><p>{run.command}</p></div></div>
    {run.proposalSummary && <p className="run-proposal-summary">{run.proposalSummary}</p>}
    <ol className="run-stages">{stages.map((status, index) => <li className={status === run.status ? 'active' : ''} key={status}><span>{index + 1}</span>{runStatusLabel[status]}</li>)}</ol>
    <section className="run-targets"><h4>{targets.length ? '将修改的内容' : '参考范围'}</h4>{targets.length ? targets.map((node) => <b key={node.id}>{node.title}</b>) : <p>{run.contextIds.length} 项上下文，无直接覆盖目标。</p>}</section>
    <section className="changed-files"><h4>文件变化</h4>{run.changedFiles.length ? run.changedFiles.map((file) => <b key={file}>{file}</b>) : <p>Agent 返回后会显示文件变化。</p>}</section>
    {run.runtime && <button className="rail-secondary pressable" onClick={onSync}><RefreshCw size={14} />刷新执行状态</button>}
    {['queued', 'running'].includes(run.status) && <button className="rail-secondary danger pressable" data-testid="cancel-runtime" onClick={onCancel}>撤回任务</button>}
    {run.providerError && <p className="rail-empty-copy">{humanizeRunError(run.providerError)}</p>}
    {run.runtime && (run.status === 'failed' || Boolean(run.providerError)) && <button className="rail-primary pressable" disabled={recovering} onClick={onRecover}><RefreshCw size={14} />{recovering ? '正在重新连接…' : '重新连接并继续任务'}</button>}
    {run.status === 'failed' && <button className="rail-secondary pressable" onClick={onRetry}><RotateCcw size={14} />重新执行为新任务</button>}
  </div>
}

function WaitingState({ run, onSync, onAnswer }: {
  run: ActiveRun
  onSync: () => void
  onAnswer: (input: { readonly requestId: string; readonly text?: string; readonly selectedOptions?: readonly string[] }) => void
}) {
  const [text, setText] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const request = run.inputRequest
  const canSubmit = request !== undefined && (text.trim().length > 0 || selectedOptions.length > 0)
  return <div className="rail-section waiting-state" data-testid="rail-waiting-input">
    <div className="waiting-hero"><CircleAlert size={19} /><div><small>Agent 已暂停</small><h3>需要你补充一点信息</h3><p>{request?.question ?? '你的原内容和任务记录都已保留。补充后会继续同一个任务。'}</p></div></div>
    {request?.options.length ? <section className="waiting-options"><h4>可以直接选择</h4>{request.options.map((option) => <label key={option}><input type="checkbox" checked={selectedOptions.includes(option)} onChange={() => setSelectedOptions((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option])} /><span>{option}</span></label>)}</section> : null}
    {request?.allowFreeText !== false && <textarea data-testid="run-input-answer" value={text} onChange={(event) => setText(event.target.value)} placeholder="补充你的要求……" />}
    {request && <button className="rail-primary pressable" data-testid="answer-runtime-input" disabled={!canSubmit} onClick={() => onAnswer({ requestId: request.requestId, ...(text.trim() ? { text: text.trim() } : {}), selectedOptions })}><Send size={14} />继续这个任务</button>}
    <section className="review-summary"><h4>内容已保留</h4><ul><li>{run.command}</li><li>当前版本没有被改动。</li><li>任务不会因为等待而自动取消。</li></ul></section>
    {run.runtime && <button className="rail-secondary pressable" onClick={onSync}><RefreshCw size={14} />刷新处理状态</button>}
  </div>
}

function ReviewState({ node, run, onAccept, onReject, onRetry, onContinueModify }: { node: CanvasNode; run: ActiveRun; onAccept: () => void; onReject: () => void; onRetry: () => void; onContinueModify: () => void }) {
  return <div className="rail-section review-state" data-testid="rail-review">
    <div className="review-heading"><GitCompareArrows size={18} /><div><small>Agent 结果已返回</small><h3>确认这次修改</h3><p>新的待确认版本已经准备好，当前版本尚未改变。</p></div></div>
    <div className="review-previews"><PreviewSurface node={{ ...node, kind: 'working', title: '当前版本', draft: false }} variant="before" /><PreviewSurface node={node} variant="after" /></div>
    <section className="review-summary"><h4>本次执行</h4><ul><li>{run.command}</li><li>新版本：{node.revisionId ?? node.title}</li><li>只有使用这个版本后，当前版本才会切换；放弃结果仍会保留过程记录。</li></ul></section>
    <section className="changed-files"><h4>文件变化</h4>{run.changedFiles.map((file) => <b key={file}>{file}</b>)}</section>
    <button className="rail-primary pressable" data-testid="accept-current" onClick={onAccept}><Check size={15} />使用这个版本</button>
    <button className="rail-secondary pressable" data-testid="continue-modify" onClick={onContinueModify}>补充修改要求</button>
    <button className="rail-secondary pressable" data-testid="retry-runtime" onClick={onRetry}><RotateCcw size={14} />重新执行</button>
    <button className="rail-secondary danger pressable" data-testid="reject-runtime" onClick={onReject}>放弃这个结果</button>
  </div>
}

function CompletedState({ run, nodes, onSaveWorkspaceState }: { run: ActiveRun; nodes: CanvasNode[]; onSaveWorkspaceState: () => void }) {
  const current = run.pendingArtifactId ? nodes.find((node) => node.id === run.pendingArtifactId) : null
  return <div className="rail-section completed-state" data-testid="rail-completed">
    <div className="completed-hero"><Check size={19} /><div><small>Agent 任务</small><h3>{run.resultSummary ? '分析完成' : '结果已归位'}</h3><p>{run.resultSummary ?? `${current?.title ?? run.changedFiles[0] ?? '本次结果'} 已写入项目过程与版本记录。`}</p></div></div>
    <section className="review-summary"><h4>接下来</h4><ul><li>继续在节点下方输入下一轮要求</li><li>在 Canvas 中查看任务与版本来源</li><li>需要阶段留档时保存当前工作现场</li></ul></section>
    <button className="rail-secondary pressable" onClick={onSaveWorkspaceState}><History size={14} />保存当前工作现场</button>
  </div>
}


const RUN_EVENT_LABELS: Record<RunEvent['type'], string> = {
  'run.queued': '任务已进入等待队列',
  'run.started': 'Agent 已开始处理',
  'run.waiting_input': 'Agent 正在等待你的补充',
  'run.input_resolved': '补充信息已收到',
  'run.review_ready': '结果已经返回，等待确认',
  'run.completed': '任务已经完成',
  'run.failed': '任务未能完成',
  'run.cancel_requested': '已发出撤回请求',
  'run.cancelled': '任务已撤回',
  'run.retry_queued': '已创建新的重试任务',
}

function RunActivity({ events, error }: { events: readonly RunEvent[]; error: string | null }) {
  const visible = events.slice(-8).reverse()
  return <section className="rail-section run-activity" data-testid="run-activity">
    <h3>任务过程</h3>
    {visible.length === 0
      ? <p className="rail-empty-copy">任务开始后，这里会显示关键进度。</p>
      : <ol>{visible.map((event) => <li key={String(event.id)}><span>{new Date(String(event.occurredAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><b>{RUN_EVENT_LABELS[event.type]}</b></li>)}</ol>}
    {error && <p className="rail-empty-copy">暂时无法读取任务过程，当前任务本身不受影响。</p>}
  </section>
}

function humanizeRunError(message: string): string {
  if (/offline|unavailable|ECONNREFUSED|fetch failed|bridge/i.test(message)) return '本地 Agent 连接暂时中断。任务记录和已返回结果都已保留，可以重新连接后继续。'
  if (/timeout|timed out/i.test(message)) return 'Agent 响应时间过长，本次任务可以从已有记录继续恢复。'
  if (/session|resume/i.test(message)) return '原来的 Agent 会话暂时无法继续，系统会优先恢复；确实失效时才会创建一次新会话。'
  if (/stale|version|conflict/i.test(message)) return '项目内容已经发生变化，需要重新读取最新版本后继续。'
  return message
}

function Composer(props: Props & { mode: WorkRailMode }) {
  const busy = isRunBusy(props.activeRun)
  const automaticProviders = props.providers.filter((item) => item.provider !== 'auto' && item.executionMode === 'automatic' && ['ready', 'busy'].includes(item.availability))
  const selectedProvider = props.provider === 'auto' ? null : automaticProviders.find((item) => item.provider === props.provider)
  const providerUnavailable = automaticProviders.length === 0 || (props.provider !== 'auto' && selectedProvider === undefined)
  const disabled = !props.composerText.trim() || busy || providerUnavailable
  const placeholder = busy ? '当前任务执行中，可以先记录下一步想法……' : props.mode === 'review' ? '继续告诉 Agent 还要怎么改……' : `告诉 Agent 你想对${props.contextLabel}做什么……`
  const reason = busy
    ? `${props.activeRun?.id ?? '任务'} 正在处理，输入内容会自动保存。`
    : providerUnavailable
      ? '本地 Agent 暂不可用；输入内容已保存，可在诊断页恢复服务。'
      : `${props.contextLabel}内 ${props.contextCount} 项可作为参考；Agent 会自行判断如何使用。`
  return <footer className={`work-rail-composer global-context-composer ${busy ? 'is-busy' : ''}`} data-testid="work-rail-composer">
    <div className="composer-context-line"><span><Sparkles size={12} />{props.contextLabel}</span><span>{props.contextCount} 项参考</span></div>
    <div className="composer-box"><textarea data-testid="work-rail-composer-input" ref={props.composerRef} value={props.composerText} onChange={(event) => props.onComposerChange(event.target.value)} onKeyDown={(event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        event.nativeEvent.stopImmediatePropagation()
        if (!disabled) props.onSend()
      }
    }} placeholder={placeholder} /><button className="pressable" disabled={disabled} aria-label="发送指令" title={busy ? '当前任务执行中' : '发送 · Ctrl/Cmd+Enter'} onClick={props.onSend}><Send size={16} /></button></div>
    <div className="global-composer-options simple-composer-options">
      <label><span>Agent</span><select disabled={automaticProviders.length === 0} value={automaticProviders.length === 0 ? 'unavailable' : automaticProviders.some((item) => item.provider === props.provider) ? props.provider : 'auto'} onChange={(event) => props.onProviderChange(event.target.value)}>{automaticProviders.length === 0 ? <option value="unavailable">暂无可用 Agent</option> : <><option value="auto">自动选择</option>{automaticProviders.map((item) => <option key={item.provider} value={item.provider}>{item.provider === 'workbuddy' ? 'WorkBuddy' : 'Codex'}{item.availability === 'busy' ? ' · 排队中' : ''}</option>)}</>}</select><ChevronDown size={11} /></label>
      <label className="create-new-node-toggle"><input type="checkbox" checked={props.createAsNewNode} onChange={(event) => props.onCreateAsNewNodeChange(event.target.checked)} /><span>结果作为新节点</span></label>
    </div>
    <div className="composer-footer"><span>{reason}</span><kbd>C</kbd><span>聚焦输入</span></div>
  </footer>
}
