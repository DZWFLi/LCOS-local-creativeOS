import { useEffect, useState, type CSSProperties, type RefObject } from 'react'
import type { RunEvent, RunReview, RuntimeProviderStatus } from '@local-creative-os/contracts'
import {
  Check,
  ChevronDown,
  CircleAlert,
  GitCompareArrows,
  PanelRightClose,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import type { ExecutionItemAction } from '@local-creative-os/contracts'
import type { ActiveRun, CanvasNode, Workspace } from '../../model'
import { runStatusLabel } from '../../model'
import { deriveWorkRailMode, isRunBusy, type WorkRailMode } from '../../state/workRailMode'
import { ToolResultCard, type ToolResultSnapshot } from '../workflow/ToolResultCard'
import { RunOutlinePanel } from '../workflow/RunOutlinePanel'
import { buildRunOutline, type RunOutlineItem, type RunOutlineStep } from '../workflow/RunOutlineProvider'
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
  contextScope: 'workspace' | 'scope' | 'project'
  onContextScope: (scope: 'workspace' | 'scope' | 'project') => void
  /** Run 大纲的步骤链（技能重放的 Run 由 App 经 deriveSkillRunSteps 映射；普通 Run 缺省空）。 */
  runSteps?: readonly RunOutlineStep[]
  composerText: string
  composerRef: RefObject<HTMLTextAreaElement | null>
  composerFocusRequest: number
  composerVisible: boolean
  provider: string
  createAsNewNode: boolean
  providers: readonly RuntimeProviderStatus[]
  onCollapse: () => void
  onExpand: () => void
  onComposerChange: (value: string) => void
  onComposerClose: () => void
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
  runReviews: readonly RunReview[]
  onOpenRunReview: (review: RunReview) => void
  runEventsError: string | null
  runtimeRecovering: boolean
  onRecoverRun: () => void
  onAnswerInput: (input: { readonly requestId: string; readonly text?: string; readonly selectedOptions?: readonly string[] }) => void
  onContinueModify: () => void
  onUpgradeWithFeedback: () => void
  onShowRun: () => void
  /** S1 alignment: Core-derived available actions for the active run. When present, control rendering fail-closes on allowed actions. */
  runActions?: readonly ExecutionItemAction[]
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

  if (props.collapsed) return null

  // Run 过程大纲投影（第一梯队 ④）：纯只读；技能重放的 Run 由 App 映射步骤链
  // （deriveSkillRunSteps 从 instruction 反解），普通 Run 传空数组。
  const runOutline: readonly RunOutlineItem[] = props.activeRun ? buildRunOutline(props.activeRun, props.runSteps ?? [], props.runEvents) : []


  return <aside className="work-rail" data-testid="work-rail" data-mode={mode} style={{ width: props.width, '--lcos-runtime-rail-width': `${props.width}px` } as CSSProperties} onContextMenu={(event) => event.preventDefault()}>
    <WorkRailHeader mode={mode} activeRun={props.activeRun} contextLabel={props.contextLabel} contextCount={props.contextCount} contextScope={props.contextScope} onContextScope={props.onContextScope} onCollapse={props.onCollapse} />
    <div className="work-rail-body" data-testid="work-rail-body">
      <RunList activeRun={props.activeRun} reviews={props.runReviews} onOpen={props.onOpenRunReview} />
      {mode === 'waiting-input' && props.activeRun
        ? <WaitingState run={props.activeRun} onSync={props.onSyncRun} onAnswer={props.onAnswerInput} runActions={props.runActions} />
        : mode === 'review' && props.activeRun && primary
          ? <ReviewState node={primary} run={props.activeRun} onAccept={props.onAccept} onReject={props.onReject} onRetry={props.onRetry} onContinueModify={props.onContinueModify} runActions={props.runActions} />
          : mode === 'run' && props.activeRun
            ? <RunState run={props.activeRun} nodes={props.nodes} outline={runOutline} onRetry={props.onRetry} onSync={props.onSyncRun} onCancel={props.onCancelRun} onRecover={props.onRecoverRun} recovering={props.runtimeRecovering} runActions={props.runActions} />
            : mode === 'completed' && props.activeRun
              ? <CompletedState run={props.activeRun} nodes={props.nodes} outline={runOutline} onUpgradeWithFeedback={props.onUpgradeWithFeedback} />
              : <RailIdleState contextLabel={props.contextLabel} contextCount={props.contextCount} />}
      {props.activeRun && <RunActivity events={props.runEvents} error={props.runEventsError} />}
    </div>
    {props.composerVisible ? <Composer {...props} mode={mode} /> : null}
  </aside>
}


function RunList({ activeRun, reviews, onOpen }: { activeRun: ActiveRun | null; reviews: readonly RunReview[]; onOpen: (review: RunReview) => void }) {
  const allUnique = reviews.filter((review, index, all) => all.findIndex((item) => String(item.run.id) === String(review.run.id)) === index)
  const activeId = activeRun?.id
  const unique = [...allUnique].sort((a, b) => {
    const score = (review: RunReview) => String(review.run.id) === activeId ? 0 : ['waiting_input', 'review', 'failed'].includes(review.presentationPhase) ? 1 : 2
    return score(a) - score(b)
  }).slice(0, 7)
  return <section className="rail-section lcos-run-list" data-testid="run-list">
    <header><div><span className="lcos-run-list-dot"/><h3>执行</h3></div><small>{unique.length ? `${unique.length} 条优先显示${allUnique.length > unique.length ? ` · 共 ${allUnique.length} 条` : ''}` : activeRun ? '当前任务' : '暂无任务'}</small></header>
    <div className="lcos-run-list-items">
      {unique.map((review) => {
        const id = String(review.run.id)
        const status = review.presentationPhase
        const attention = status === 'waiting_input' || status === 'review' || status === 'failed'
        return <button type="button" key={id} className={`${id===activeId?'active ':''}${attention?'attention':''}`} onClick={() => onOpen(review)} title={review.run.instruction}>
          <i className={`status-${status}`}/><span><strong>{review.run.instruction.slice(0, 36) || id}</strong><small>{humanRunListStatus(status)} · {String(review.run.provider || 'Agent')}</small></span>
        </button>
      })}
      {!unique.length && activeRun && <div className="lcos-run-list-current"><i className={`status-${activeRun.status}`}/><span><strong>{activeRun.command.slice(0, 36)}</strong><small>{runStatusLabel[activeRun.status]}</small></span></div>}
      {!unique.length && !activeRun && <p className="rail-empty-copy">从画布或工作流发起任务后，会在这里出现。</p>}
    </div>
  </section>
}

function humanRunListStatus(status: string): string {
  if (status === 'queued' || status === 'created') return '排队中'
  if (status === 'running') return '执行中'
  if (status === 'waiting_input') return '等待输入'
  if (status === 'review') return '待确认'
  if (status === 'completed') return '已完成'
  if (status === 'cancelled') return '已撤回'
  if (status === 'failed') return '失败'
  return status
}

/** 0.5 波轻接线：把现有 Run 数据映射为工具结果卡快照（kind='run'）。 */
function runToolResultSnapshot(run: ActiveRun): ToolResultSnapshot {
  return {
    toolCallId: run.id,
    kind: 'run',
    status: run.status === 'failed' ? 'failed' : run.status === 'completed' ? 'done' : ['queued', 'cancelled'].includes(run.status) ? 'pending' : 'running',
    command: run.command,
    output: run.resultSummary ?? run.providerError,
    isStreaming: run.status === 'running',
  }
}

function WorkRailHeader({ mode, activeRun, contextLabel, contextCount, contextScope, onContextScope, onCollapse }: {
  mode: WorkRailMode
  activeRun: ActiveRun | null
  contextLabel: string
  contextCount: number
  contextScope: 'workspace' | 'scope' | 'project'
  onContextScope: (scope: 'workspace' | 'scope' | 'project') => void
  onCollapse: () => void
}) {
  const followsRun = Boolean(activeRun && ['run', 'waiting-input', 'review', 'completed'].includes(mode))
  const title = followsRun && activeRun ? `Agent 任务 · ${runStatusLabel[activeRun.status]}` : '项目协作'
  const meta = followsRun
    ? mode === 'review' ? '结果确认' : mode === 'waiting-input' ? '需要你的确认' : '当前任务'
    : `${contextLabel} · ${contextCount} 项上下文`
  return <header className="work-rail-header">
    <span className="work-rail-focus-dot" />
    <div><span>{meta}</span><h2>{title}</h2></div>
    <div className="work-rail-header-actions">
      {!followsRun && <label className="lcos-global-context-scope" title="Agent 参考范围"><select aria-label="Agent 参考范围" value={contextScope} onChange={(event) => onContextScope(event.target.value as 'workspace' | 'scope' | 'project')}><option value="workspace">当前工作空间</option><option value="scope">当前空间</option><option value="project">整个项目</option></select><ChevronDown size={10}/></label>}
      <button className="pressable" aria-label="关闭全局 Agent" title="关闭全局 Agent" onClick={onCollapse}><PanelRightClose size={15} /></button>
    </div>
  </header>
}

function RailIdleState({ contextLabel, contextCount }: { contextLabel: string; contextCount: number }) {
  return <div className="rail-section rail-idle">
    <h3>当前没有正在执行的任务</h3>
    <p>{contextLabel} 里有 {contextCount} 个对象可作为上下文。需要 AI 时再主动召唤，平时这里仅保留执行与返回状态。</p>
    <div className="idle-shortcuts"><kbd>C</kbd><span>召唤临时输入</span></div>
  </div>
}

function RunState({ run, nodes, outline, onRetry, onSync, onCancel, onRecover, recovering, runActions }: { run: ActiveRun; nodes: CanvasNode[]; outline: readonly RunOutlineItem[]; onRetry: () => void; onSync: () => void; onCancel: () => void; onRecover: () => void; recovering: boolean; runActions?: readonly ExecutionItemAction[] }) {
  const targets = run.targetIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  const stages: ActiveRun['status'][] = run.status === 'cancelled'
    ? ['queued', 'running', 'cancelled']
    : ['queued', 'running', 'waiting_input', 'review', 'completed']
  return <div className="rail-section run-state" data-testid="rail-run">
    <div className={`run-hero status-${run.status}`}><span><Play size={16} fill="currentColor" /></span><div><small>本地 Agent 任务</small><h3>{runStatusLabel[run.status]}</h3><p>{run.command}</p></div></div>
    {run.proposalSummary && <p className="run-proposal-summary">{run.proposalSummary}</p>}
    <RunOutlinePanel status={run.status} items={outline} />
    <ToolResultCard snapshot={runToolResultSnapshot(run)} />
    <ol className="run-stages">{stages.map((status, index) => <li className={status === run.status ? 'active' : ''} key={status}><span>{index + 1}</span>{runStatusLabel[status]}</li>)}</ol>
    <section className="run-targets"><h4>{targets.length ? '将修改的内容' : '参考范围'}</h4>{targets.length ? targets.map((node) => <b key={node.id}>{node.title}</b>) : <p>{run.contextIds.length} 项上下文，无直接覆盖目标。</p>}</section>
    <section className="changed-files"><h4>文件变化</h4>{run.changedFiles.length ? run.changedFiles.map((file) => <b key={file}>{file}</b>) : <p>Agent 返回后会显示文件变化。</p>}</section>
    {run.runtime && <button className="rail-secondary pressable" onClick={onSync}><RefreshCw size={14} />刷新执行状态</button>}
    {['queued', 'running'].includes(run.status) && canAct(runActions, 'cancel') && <button className="rail-secondary danger pressable" data-testid="cancel-runtime" onClick={onCancel}>撤回任务</button>}
    {run.providerError && <p className="rail-empty-copy">{humanizeRunError(run.providerError)}</p>}
    {run.runtime && (run.status === 'failed' || Boolean(run.providerError)) && <button className="rail-primary pressable" disabled={recovering} onClick={onRecover}><RefreshCw size={14} />{recovering ? '正在重新连接…' : '重新连接并继续任务'}</button>}
    {run.status === 'failed' && canAct(runActions, 'retry') && <button className="rail-secondary pressable" onClick={onRetry}><RotateCcw size={14} />重新执行为新任务</button>}
  </div>
}

function WaitingState({ run, onSync, onAnswer, runActions }: {
  run: ActiveRun
  onSync: () => void
  onAnswer: (input: { readonly requestId: string; readonly text?: string; readonly selectedOptions?: readonly string[] }) => void
  runActions?: readonly ExecutionItemAction[]
}) {
  const [text, setText] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const request = run.inputRequest
  const canSubmit = request !== undefined && (text.trim().length > 0 || selectedOptions.length > 0)
  return <div className="rail-section waiting-state" data-testid="rail-waiting-input">
    <div className="waiting-hero"><CircleAlert size={19} /><div><small>Agent 已暂停</small><h3>需要你补充一点信息</h3><p>{request?.question ?? '你的原内容和任务记录都已保留。补充后会继续同一个任务。'}</p></div></div>
    {request?.options.length ? <section className="waiting-options"><h4>可以直接选择</h4>{request.options.map((option) => <label key={option}><input type="checkbox" checked={selectedOptions.includes(option)} onChange={() => setSelectedOptions((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option])} /><span>{option}</span></label>)}</section> : null}
    {request?.allowFreeText !== false && <textarea data-testid="run-input-answer" value={text} onChange={(event) => setText(event.target.value)} placeholder="补充你的要求……" />}
    {request && canAct(runActions, 'answer_input') && <button className="rail-primary pressable" data-testid="answer-runtime-input" disabled={!canSubmit} onClick={() => onAnswer({ requestId: request.requestId, ...(text.trim() ? { text: text.trim() } : {}), selectedOptions })}><Send size={14} />继续这个任务</button>}
    <section className="review-summary"><h4>内容已保留</h4><ul><li>{run.command}</li><li>当前版本没有被改动。</li><li>任务不会因为等待而自动取消。</li></ul></section>
    {run.runtime && <button className="rail-secondary pressable" onClick={onSync}><RefreshCw size={14} />刷新处理状态</button>}
  </div>
}

function ReviewState({ node, run, onAccept, onReject, onRetry, onContinueModify, runActions }: { node: CanvasNode; run: ActiveRun; onAccept: () => void; onReject: () => void; onRetry: () => void; onContinueModify: () => void; runActions?: readonly ExecutionItemAction[] }) {
  return <div className="rail-section review-state" data-testid="rail-review">
    <div className="review-heading"><GitCompareArrows size={18} /><div><small>Agent 结果已返回</small><h3>确认这次修改</h3><p>新的待确认版本已经准备好，当前版本尚未改变。</p></div></div>
    <div className="review-previews"><PreviewSurface node={{ ...node, kind: 'working', title: '当前版本', draft: false }} variant="before" /><PreviewSurface node={node} variant="after" /></div>
    <section className="review-summary"><h4>本次执行</h4><ul><li>{run.command}</li><li>新版本：{node.revisionId ?? node.title}</li><li>只有使用这个版本后，当前版本才会切换；放弃结果仍会保留过程记录。</li></ul></section>
    <section className="changed-files"><h4>文件变化</h4>{run.changedFiles.map((file) => <b key={file}>{file}</b>)}</section>
    <button className="rail-primary pressable" data-testid="accept-current" onClick={onAccept}><Check size={15} />使用这个版本</button>
    <button className="rail-secondary pressable" data-testid="continue-modify" onClick={onContinueModify}>补充修改要求</button>
    {canAct(runActions, 'retry') && <button className="rail-secondary pressable" data-testid="retry-runtime" onClick={onRetry}><RotateCcw size={14} />重新执行</button>}
    <button className="rail-secondary danger pressable" data-testid="reject-runtime" onClick={onReject}>放弃这个结果</button>
  </div>
}

function CompletedState({ run, nodes, outline, onUpgradeWithFeedback }: { run: ActiveRun; nodes: CanvasNode[]; outline: readonly RunOutlineItem[]; onUpgradeWithFeedback: () => void }) {
  const current = run.resultNodeId
    ? nodes.find((node) => node.id === run.resultNodeId) ?? null
    : run.resultArtifactId
      ? nodes.find((node) => node.artifactId === run.resultArtifactId && (!run.resultRevisionId || node.revisionId === run.resultRevisionId)) ?? null
      : run.pendingArtifactId ? nodes.find((node) => node.id === run.pendingArtifactId) ?? null : null
  return <div className="rail-section completed-state" data-testid="rail-completed">
    <div className="completed-hero"><Check size={19} /><div><small>Agent 任务</small><h3>{run.resultSummary ? '分析完成' : '结果已归位'}</h3><p>{run.resultSummary ?? `${current?.title ?? run.changedFiles[0] ?? '本次结果'} 已写入项目过程与版本记录。`}</p></div></div>
    <RunOutlinePanel status={run.status} items={outline} />
    <ToolResultCard expanded snapshot={runToolResultSnapshot(run)} />
    <section className="review-summary"><h4>接下来</h4><ul><li>继续在节点下方输入下一轮要求</li><li>在 Canvas 中查看任务与版本来源</li><li>需要回看细节时，从对应对话记录或来源信息进入</li></ul></section>
    {current?.artifactId && current.revisionId && <button className="rail-secondary pressable" data-testid="upgrade-agent-result" onClick={onUpgradeWithFeedback}>基于反馈生成下一版</button>}
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

function canAct(runActions: readonly ExecutionItemAction[] | undefined, action: ExecutionItemAction): boolean {
  return runActions?.includes(action) === true
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
  const placeholder = busy ? '当前任务执行中，可以先记下补充要求……' : props.mode === 'review' ? '继续告诉 Agent 还要怎么改……' : `告诉 Agent 你想对${props.contextLabel}做什么……`
  const reason = busy
    ? `${props.activeRun?.id ?? '任务'} 正在处理，输入内容会自动保存。`
    : providerUnavailable
      ? '本地 Agent 暂不可用；输入内容已保存，可在诊断页恢复服务。'
      : `${props.contextLabel}内 ${props.contextCount} 项可作为参考；Agent 会自行判断如何使用。`
  return <footer className={`work-rail-composer global-context-composer ${busy ? 'is-busy' : ''}`} data-testid="work-rail-composer">
    <div className="composer-context-line"><span><Sparkles size={12} />{props.contextLabel}</span><span>{props.contextCount} 项参考</span><button type="button" className="composer-close" aria-label="关闭临时输入" title="关闭" onClick={props.onComposerClose}><X size={12}/></button></div>
    <div className="composer-box"><textarea data-testid="work-rail-composer-input" ref={props.composerRef} value={props.composerText} onChange={(event) => props.onComposerChange(event.target.value)} onKeyDown={(event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        event.nativeEvent.stopImmediatePropagation()
        if (!disabled) props.onSend()
      }
    }} placeholder={placeholder} /><button className="pressable" disabled={disabled} aria-label="发送指令" title={busy ? '当前任务执行中' : '发送 · Ctrl/Cmd+Enter'} onClick={props.onSend}><Send size={16} /></button></div>
    <details className="global-composer-advanced">
      <summary>高级</summary>
      <div className="global-composer-options simple-composer-options">
        <label><span>Agent</span><select disabled={automaticProviders.length === 0} value={automaticProviders.length === 0 ? 'unavailable' : automaticProviders.some((item) => item.provider === props.provider) ? props.provider : 'auto'} onChange={(event) => props.onProviderChange(event.target.value)}>{automaticProviders.length === 0 ? <option value="unavailable">暂无可用 Agent</option> : <><option value="auto">自动选择</option>{automaticProviders.map((item) => <option key={item.provider} value={item.provider}>{item.provider === 'workbuddy' ? 'WorkBuddy' : item.provider === 'codex' ? 'Codex' : item.provider}{item.availability === 'busy' ? ' · 排队中' : ''}</option>)}</>}</select><ChevronDown size={11} /></label>
        <label className="create-new-node-toggle"><input type="checkbox" checked={props.createAsNewNode} onChange={(event) => props.onCreateAsNewNodeChange(event.target.checked)} /><span>结果作为新节点</span></label>
      </div>
    </details>
    <div className="composer-footer"><span>{reason}</span><kbd>C</kbd><span>聚焦输入</span></div>
  </footer>
}
