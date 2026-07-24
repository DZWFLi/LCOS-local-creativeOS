import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileText,
  FolderOpen,
  GitCompareArrows,
  Layers3,
  Link2,
  Maximize2,
  MessageSquareText,
  PanelRightClose,
  Pin,
  PinOff,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Target,
} from 'lucide-react'
import type { ActiveRun, CanvasNode, CanvasScope, TargetContextInference, Workspace } from '../../model'
import { nodeMeta, runStatusLabel } from '../../model'
import { canBeTarget } from '../../state/workContext'
import { deriveWorkRailMode, isRunBusy, type WorkRailMode } from '../../state/workRailMode'
import { PreviewSurface } from './PreviewSurface'

interface Props {
  workspace: Workspace
  scope: CanvasScope
  nodes: CanvasNode[]
  selectedNodes: CanvasNode[]
  focusNode: CanvasNode | null
  relationNodes: CanvasNode[]
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
  onSelectTarget: (id: string) => void
  onToggleContext: (id: string) => void
  onMoveRole: (id: string, role: 'target' | 'context') => void
  onFocusPreview: (id: string | null) => void
  onEnterScope: (scopeId: string) => void
  onContinue: (answer: '35%' | '30%') => void
  onAccept: () => void
  onRetry: () => void
  onContinueModify: () => void
  onOpenNative: (node: CanvasNode) => void
  onTogglePositionLock: (nodeId: string) => void
  onShowRun: () => void
}

type DetailPanel = 'none' | 'relations' | 'context'

export function WorkRail(props: Props) {
  const [detailPanel, setDetailPanel] = useState<DetailPanel>('none')
  const primary = props.focusNode ?? props.selectedNodes.at(-1) ?? null
  const mode = deriveWorkRailMode({
    activeRun: props.activeRun,
    selectedNodes: props.selectedNodes,
    focusNode: props.focusNode,
    pendingNode: props.pendingNode,
  })
  const modeKey = `${mode}:${props.focusNode?.id ?? ''}:${props.selectedNodes.map((node) => node.id).join(',')}`

  useEffect(() => setDetailPanel('none'), [modeKey])

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
    return <aside className="work-rail compact" data-testid="work-rail" data-mode={mode} aria-label="工作栏已折叠">
      <button className="work-rail-expand" aria-label="展开工作栏" title="展开工作栏" onClick={props.onExpand}><ChevronLeft size={17} /></button>
      <div className="compact-focus-mark" title={primary?.title ?? props.workspace.label}><span className={primary ? `kind-${primary.kind}` : 'kind-workspace'} /></div>
      {props.activeRun && <button className={`compact-run status-${props.activeRun.status}`} title={`${props.activeRun.id} · ${runStatusLabel[props.activeRun.status]}`} onClick={() => { props.onShowRun(); props.onExpand() }}><Play size={15} /></button>}
      <button className="compact-compose" title="输入指令" onClick={props.onRequestComposerFocus}><Sparkles size={16} /></button>
    </aside>
  }

  return <aside className="work-rail" data-testid="work-rail" data-mode={mode} style={{ width: props.width }}>
    <WorkRailHeader mode={mode} primary={primary} activeRun={props.activeRun} workspace={props.workspace} scope={props.scope} focusNode={props.focusNode} onCollapse={props.onCollapse} onFocusPreview={props.onFocusPreview} />
    <div className="work-rail-body" data-testid="work-rail-body">
      {mode === 'waiting-input'
        ? <WaitingState onContinue={props.onContinue} />
        : mode === 'review' && props.activeRun && props.pendingNode
          ? <ReviewState node={props.pendingNode} run={props.activeRun} onAccept={props.onAccept} onContinueModify={props.onContinueModify} />
          : mode === 'run' && props.activeRun
            ? <RunState run={props.activeRun} nodes={props.nodes} onRetry={props.onRetry} />
            : mode === 'multi-selection'
              ? <MultiSelectionState nodes={props.selectedNodes} inference={props.inference} allNodes={props.nodes} onSelectTarget={props.onSelectTarget} onMoveRole={props.onMoveRole} />
              : mode === 'selection' && primary
                ? <SelectionState node={primary} focus={Boolean(props.focusNode)} relationNodes={props.relationNodes} detailPanel={detailPanel} inference={props.inference} allNodes={props.nodes} activeRun={props.activeRun} onDetailPanel={setDetailPanel} onToggleContext={props.onToggleContext} onFocusPreview={props.onFocusPreview} onEnterScope={props.onEnterScope} onOpenNative={props.onOpenNative} onTogglePositionLock={props.onTogglePositionLock} />
                : mode === 'completed' && props.activeRun
                  ? <CompletedState run={props.activeRun} nodes={props.nodes} />
                  : <WorkspaceSummary workspace={props.workspace} scope={props.scope} nodes={props.nodes} />}
    </div>
    <Composer {...props} mode={mode} />
  </aside>
}

function WorkRailHeader({ mode, primary, activeRun, workspace, scope, focusNode, onCollapse, onFocusPreview }: {
  mode: WorkRailMode
  primary: CanvasNode | null
  activeRun: ActiveRun | null
  workspace: Workspace
  scope: CanvasScope
  focusNode: CanvasNode | null
  onCollapse: () => void
  onFocusPreview: (id: string | null) => void
}) {
  const followsRun = Boolean(activeRun && ['run', 'waiting-input', 'review', 'completed'].includes(mode))
  const title = followsRun && activeRun ? `${activeRun.id} · ${runStatusLabel[activeRun.status]}` : primary?.title ?? workspace.label
  const meta = followsRun
    ? mode === 'review' ? '结果确认' : mode === 'waiting-input' ? '需要你的确认' : '当前任务'
    : primary
      ? `${nodeMeta[primary.kind].label}${primary.current ? ' · 当前版本' : primary.draft ? ' · 待确认' : ''}`
      : scope.label
  return <header className="work-rail-header">
    {focusNode ? <button aria-label="退出放大预览" onClick={() => onFocusPreview(null)}><ChevronLeft size={17} /></button> : <span className="work-rail-focus-dot" />}
    <div><span>{meta}</span><h2>{title}</h2></div>
    <button aria-label="折叠工作栏" title="折叠工作栏" onClick={onCollapse}><PanelRightClose size={17} /></button>
  </header>
}

function WorkspaceSummary({ workspace, scope, nodes }: { workspace: Workspace; scope: CanvasScope; nodes: CanvasNode[] }) {
  const scopeNodes = nodes.filter((node) => (node.scopeId ?? 'scope-root') === scope.id)
  const latest = scopeNodes.filter((node) => node.kind !== 'process').slice(0, 3)
  const pending = scopeNodes.filter((node) => node.draft)
  return <div className="rail-section workspace-summary" data-testid="rail-workspace-summary">
    <div className="rail-summary-hero"><span className={`intent-swatch intent-${workspace.intent ?? 'blank'}`} /><div><small>当前工作视角</small><h3>{workspace.label}</h3><p>{scope.label} · {scopeNodes.length} 个对象</p></div></div>
    <section><header><h4>最近修改</h4><span>{latest.length}</span></header>{latest.map((node) => <div className="rail-list-row" key={node.id}><FileText size={15} /><div><b>{node.title}</b><small>{node.subtitle}</small></div></div>)}</section>
    <section><header><h4>待处理</h4><span>{pending.length}</span></header>{pending.length ? pending.map((node) => <div className="rail-list-row pending" key={node.id}><Sparkles size={15} /><div><b>{node.title}</b><small>等待确认</small></div></div>) : <p className="rail-empty-copy">当前没有待确认结果。</p>}</section>
    <div className="rail-context-lens"><Layers3 size={15} /><span>系统会自动使用当前视角的相关资料，不需要先创建上下文节点。</span></div>
  </div>
}

function SelectionState({ node, focus, relationNodes, detailPanel, inference, allNodes, activeRun, onDetailPanel, onToggleContext, onFocusPreview, onEnterScope, onOpenNative, onTogglePositionLock }: {
  node: CanvasNode
  focus: boolean
  relationNodes: CanvasNode[]
  detailPanel: DetailPanel
  inference: TargetContextInference
  allNodes: CanvasNode[]
  activeRun: ActiveRun | null
  onDetailPanel: (panel: DetailPanel) => void
  onToggleContext: (id: string) => void
  onFocusPreview: (id: string | null) => void
  onEnterScope: (scopeId: string) => void
  onOpenNative: (node: CanvasNode) => void
  onTogglePositionLock: (nodeId: string) => void
}) {
  const inContext = inference.contextIds.includes(node.id)
  if (detailPanel === 'relations') return <RelationsDetail node={node} relations={relationNodes} onBack={() => onDetailPanel('none')} />
  if (detailPanel === 'context') return <ContextDetail inference={inference} allNodes={allNodes} onBack={() => onDetailPanel('none')} onToggleContext={onToggleContext} />

  const acceptedHere = activeRun?.status === 'completed' && activeRun.pendingArtifactId === node.id
  return <div className={`rail-section selection-state ${focus ? 'focus-preview' : ''}`} data-testid="rail-selection">
    {acceptedHere && <div className="accepted-result-banner"><Check size={15} /><span><b>已接受为当前版本</b><small>{activeRun.id} 的修改已归位，可继续输入下一轮调整。</small></span></div>}
    <PreviewSurface node={node} />
    <div className="selection-title"><div><small>{nodeMeta[node.kind].label}</small><h3>{node.title}</h3><p>{node.subtitle}</p></div>{node.opensScopeId && <button onClick={() => onEnterScope(node.opensScopeId!)}><FolderOpen size={15} />进入集合</button>}</div>
    <section className="selection-note"><label><MessageSquareText size={14} />备注</label><textarea defaultValue={node.id === 'feedback' ? '利益点需要更直接，保留品牌蓝，不改封面。' : ''} placeholder="记录判断，系统会自动关联到当前文件或页面" /></section>
    <div className="selection-actions"><button onClick={() => onFocusPreview(focus ? null : node.id)}><Maximize2 size={14} />{focus ? '退出大预览' : '大预览'}</button><button onClick={() => onOpenNative(node)}>在本地打开</button><button onClick={() => onTogglePositionLock(node.id)}>{node.positionLocked ? <PinOff size={14} /> : <Pin size={14} />}{node.positionLocked ? '允许自动排列' : '固定位置'}</button></div>
    <div className="selection-links"><button onClick={() => onDetailPanel('relations')}><Link2 size={14} />关联 {relationNodes.length}<ChevronRight size={14} /></button><button onClick={() => onDetailPanel('context')}><Layers3 size={14} />本次参考 {inference.contextIds.length}<ChevronRight size={14} /></button></div>
    <button className={inContext ? 'context-toggle active' : 'context-toggle'} onClick={() => onToggleContext(node.id)}>{inContext ? <Check size={14} /> : <Layers3 size={14} />}{inContext ? '已作为参考资料' : '加入本次参考'}</button>
  </div>
}

function MultiSelectionState({ nodes, inference, allNodes, onSelectTarget, onMoveRole }: {
  nodes: CanvasNode[]
  inference: TargetContextInference
  allNodes: CanvasNode[]
  onSelectTarget: (id: string) => void
  onMoveRole: (id: string, role: 'target' | 'context') => void
}) {
  return <div className="rail-section multi-selection-state" data-testid="rail-multi-selection">
    <div className="multi-selection-hero"><Layers3 size={18} /><div><small>已选择</small><h3>{nodes.length} 个对象</h3><p>系统已自动判断修改目标与参考资料。</p></div></div>
    {inference.ambiguousTargetIds.length > 0 && <section className="target-question"><h4>这次主要修改哪个文件？</h4><p>只需选一个主要目标，其他内容会自动作为参考。</p>{inference.ambiguousTargetIds.map((id) => { const node = allNodes.find((item) => item.id === id); return node ? <button key={id} onClick={() => onSelectTarget(id)}><Target size={14} /><span>{node.title}</span></button> : null })}</section>}
    <RoleBucket title="修改目标" icon={<Target size={15} />} ids={inference.targetIds} allNodes={allNodes} empty="等待确认主要目标" onMove={(id) => onMoveRole(id, 'context')} />
    <RoleBucket title="参考资料" icon={<Layers3 size={15} />} ids={inference.contextIds} allNodes={allNodes} empty="系统会补充工作视角相关资料" onMove={(id) => onMoveRole(id, 'target')} canMove={canBeTarget} />
    <p className="inference-reason">{inference.reason}</p>
  </div>
}

function RoleBucket({ title, icon, ids, allNodes, empty, onMove, canMove }: { title: string; icon: ReactNode; ids: string[]; allNodes: CanvasNode[]; empty: string; onMove: (id: string) => void; canMove?: (node: CanvasNode) => boolean }) {
  return <section className="role-bucket"><header>{icon}<h4>{title}</h4><span>{ids.length}</span></header>{ids.length ? <div className="role-chips">{ids.map((id) => { const node = allNodes.find((item) => item.id === id); if (!node) return null; const movable = canMove ? canMove(node) : true; return <button disabled={!movable} title={movable ? '点击移动到另一组' : '该对象只能作为参考资料'} key={id} onClick={() => movable && onMove(id)}>{node.title}</button> })}</div> : <p>{empty}</p>}</section>
}

function RunState({ run, nodes, onRetry }: { run: ActiveRun; nodes: CanvasNode[]; onRetry: () => void }) {
  const targets = run.targetIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  return <div className="rail-section run-state" data-testid="rail-run">
    <div className={`run-hero status-${run.status}`}><span><Play size={16} fill="currentColor" /></span><div><small>{run.id}</small><h3>{runStatusLabel[run.status]}</h3><p>{run.command}</p></div></div>
    <ol className="run-stages">{['queued','running','waiting_input','review','completed'].map((status, index) => <li className={status === run.status ? 'active' : ''} key={status}><span>{index + 1}</span>{runStatusLabel[status as ActiveRun['status']]}</li>)}</ol>
    <section className="run-targets"><h4>修改目标</h4>{targets.map((node) => <b key={node.id}>{node.title}</b>)}</section>
    <section className="changed-files"><h4>变化文件</h4>{run.changedFiles.length ? run.changedFiles.map((file) => <b key={file}>{file}</b>) : <p>执行器返回后显示文件变化。</p>}</section>
    {run.status === 'failed' && <button className="rail-primary" onClick={onRetry}><RotateCcw size={14} />重新执行</button>}
  </div>
}

function WaitingState({ onContinue }: { onContinue: (answer: '35%' | '30%') => void }) {
  return <div className="rail-section waiting-state" data-testid="rail-waiting-input">
    <div className="waiting-hero"><CircleAlert size={19} /><div><small>需要你的确认</small><h3>第 5 页使用哪个节能数据？</h3><p>客户反馈提出 35%，当前版本仍保留旧版 30%。</p></div></div>
    <button className="waiting-option recommended" onClick={() => onContinue('35%')}><b>使用客户反馈 35%</b><span>推荐 · 客户反馈 07/17</span></button>
    <button className="waiting-option" onClick={() => onContinue('30%')}><b>保留旧版 30%</b><span>不修改当前数值</span></button>
    <div className="waiting-sources"><span>参考</span><b>客户反馈 07/17</b><b>当前提案 V3</b></div>
  </div>
}

function ReviewState({ node, run, onAccept, onContinueModify }: { node: CanvasNode; run: ActiveRun; onAccept: () => void; onContinueModify: () => void }) {
  return <div className="rail-section review-state" data-testid="rail-review">
    <div className="review-heading"><GitCompareArrows size={18} /><div><small>{run.id} · 结果已返回</small><h3>确认这次修改</h3><p>第 6 页构图和产品距离已调整。</p></div></div>
    <div className="review-previews"><PreviewSurface node={{ ...node, kind: 'working', title: '当前 V3' }} variant="before" /><PreviewSurface node={node} variant="after" /></div>
    <section className="review-summary"><h4>修改摘要</h4><ul><li>拉开产品与雕像距离</li><li>优化人物比例</li><li>保留 0–6 秒缓慢拉镜与三句字幕</li></ul></section>
    <section className="changed-files"><h4>变化文件</h4>{run.changedFiles.map((file) => <b key={file}>{file}</b>)}</section>
    <button className="rail-primary" data-testid="accept-current" onClick={onAccept}><Check size={15} />接受为当前版本</button>
    <button className="rail-secondary" data-testid="continue-modify" onClick={onContinueModify}>继续修改</button>
  </div>
}


function CompletedState({ run, nodes }: { run: ActiveRun; nodes: CanvasNode[] }) {
  const current = run.pendingArtifactId ? nodes.find((node) => node.id === run.pendingArtifactId) : null
  return <div className="rail-section completed-state" data-testid="rail-completed">
    <div className="completed-hero"><Check size={19} /><div><small>{run.id}</small><h3>修改已归位</h3><p>{current?.title ?? run.changedFiles[0] ?? '新版本'} 已成为当前版本。</p></div></div>
    <section className="review-summary"><h4>接下来</h4><ul><li>继续输入下一轮修改</li><li>在 Canvas 中查看版本关系</li><li>创建检查点保存稳定修改集</li></ul></section>
  </div>
}

function RelationsDetail({ node, relations, onBack }: { node: CanvasNode; relations: CanvasNode[]; onBack: () => void }) {
  return <div className="rail-section rail-detail"><button className="rail-detail-back" onClick={onBack}><ChevronLeft size={14} />返回文件</button><div className="rail-detail-title"><Link2 size={17} /><div><small>一度关联</small><h3>{node.title}</h3></div></div>{relations.length ? relations.map((item) => <div className="rail-list-row" key={item.id}><FileText size={15} /><div><b>{item.title}</b><small>{nodeMeta[item.kind].label} · {item.subtitle}</small></div></div>) : <p className="rail-empty-copy">暂无直接关联。</p>}</div>
}

function ContextDetail({ inference, allNodes, onBack, onToggleContext }: { inference: TargetContextInference; allNodes: CanvasNode[]; onBack: () => void; onToggleContext: (id: string) => void }) {
  return <div className="rail-section rail-detail"><button className="rail-detail-back" onClick={onBack}><ChevronLeft size={14} />返回当前内容</button><div className="rail-detail-title"><Layers3 size={17} /><div><small>系统自动组织</small><h3>本次参考</h3></div></div><div className="context-lens-summary">已包含 {inference.contextIds.length} 个对象 · 2 条关键决策 · 最近 2 次相关对话摘要</div>{inference.contextIds.map((id) => { const node = allNodes.find((item) => item.id === id); return node ? <button className="context-detail-row" key={id} onClick={() => onToggleContext(id)}><Check size={13} /><span><b>{node.title}</b><small>{nodeMeta[node.kind].label}</small></span></button> : null })}</div>
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
    <div className="composer-context-line"><span><Target size={12} />目标：{targetNames[0] ?? '待确认'}</span><span><Layers3 size={12} />参考：{contextNames.length ? `${contextNames[0]}${contextNames.length > 1 ? ` 等 ${contextNames.length} 项` : ''}` : '当前工作视角'}</span><span><Sparkles size={12} />执行：Codex</span></div>
    <div className="composer-box"><textarea data-testid="work-rail-composer-input" ref={props.composerRef} value={props.composerText} onChange={(event) => props.onComposerChange(event.target.value)} onKeyDown={(event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        event.nativeEvent.stopImmediatePropagation()
        if (!disabled) props.onSend()
      }
    }} placeholder={placeholder} /><button disabled={disabled} aria-label="发送指令" title={busy ? '当前任务执行中' : '检查并执行 · Ctrl/Cmd+Enter'} onClick={props.onSend}><Send size={17} /></button></div>
    <div className="composer-footer"><span>{reason}</span><kbd>C</kbd><span>聚焦输入</span></div>
  </footer>
}

