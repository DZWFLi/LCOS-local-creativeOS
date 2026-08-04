import type { CSSProperties, ReactNode } from 'react'
import { ArrowUp, Bot, Brain, ChevronDown, CornerDownRight, FilePenLine, Files, FolderInput, History, Layers3, MessageSquareText, PencilLine, Plus, Sparkles, Target, WandSparkles, X } from 'lucide-react'
import type { RuntimeProviderStatus } from '@local-creative-os/contracts'
import type { CanvasNode, Workspace } from '../../model'
import type { RunOutputIntent } from '../../runtime/v07UiContracts'
import type { ArtifactRevisionProvenance } from '../../runtime/projectionAdapters'

export type ComposerResultPolicy = 'reply_only' | 'create_artifact' | 'create_collection' | 'draft_revision_per_target'

interface Props {
  nodes: CanvasNode[]
  selectedIds: string[]
  contextIds: string[]
  zoom: number
  x: number
  y: number
  prompt: string
  intent: RunOutputIntent
  provider: string
  resultPolicy: ComposerResultPolicy
  targetId: string | null
  baseRevision?: ArtifactRevisionProvenance
  providers: readonly RuntimeProviderStatus[]
  activeWorkspace: Workspace | null
  workspaces: readonly Workspace[]
  busy: boolean
  proposalSummary?: string
  ambiguityQuestion?: string
  onPromptChange: (value: string) => void
  onIntentChange: (value: RunOutputIntent) => void
  onProviderChange: (value: string) => void
  onResultPolicyChange: (value: ComposerResultPolicy) => void
  onTargetChange: (value: string | null) => void
  onToggleContext: (id: string) => void
  onSend: () => void
  onAddToWorkspace: () => void
  onRemoveFromWorkspace: () => void
  onMoveToWorkspace: (workspaceId: string) => void
  onClose: () => void
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

interface MenuOption<Value extends string> {
  value: Value
  label: string
  description: string
  icon: ReactNode
  disabled?: boolean
}

function ComposerMenu<Value extends string>(props: {
  label: string
  value: Value
  options: readonly MenuOption<Value>[]
  onChange: (value: Value) => void
  className?: string
}) {
  const selected = props.options.find((option) => option.value === props.value) ?? props.options[0]
  return <details className={`composer-menu ${props.className ?? ''}`}>
    <summary><span className="composer-menu-icon">{selected?.icon}</span><span><small>{props.label}</small><b>{selected?.label}</b></span><ChevronDown size={12} /></summary>
    <div className="composer-menu-popover" role="menu">
      {props.options.map((option) => <button key={option.value} type="button" role="menuitemradio" aria-checked={option.value === props.value} disabled={option.disabled} onClick={(event) => {
        props.onChange(option.value)
        event.currentTarget.closest('details')?.removeAttribute('open')
      }}>
        <span className="composer-menu-icon">{option.icon}</span>
        <span><b>{option.label}</b><small>{option.description}</small></span>
      </button>)}
    </div>
  </details>
}

export function SelectionComposer(props: Props) {
  const selected = props.selectedIds.map((id) => props.nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  const visibleContextIds = Array.from(new Set([...(props.targetId ? [props.targetId] : []), ...props.contextIds]))
  const contexts = visibleContextIds.map((id) => props.nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  const contextCandidates = props.nodes.filter((node) => node.kind !== 'process' && !visibleContextIds.includes(node.id))
  const editable = selected.filter((node) => node.managed === true && node.artifactId && node.revisionId)
  const target = props.targetId ? selected.find((node) => node.id === props.targetId) ?? null : null
  const allInWorkspace = Boolean(props.activeWorkspace && selected.length && selected.every((node) => node.workspaceIds?.includes(props.activeWorkspace!.id)))
  const selectedProvider = props.provider === 'auto' ? null : props.providers.find((item) => item.provider === props.provider) ?? null
  const providerBlocked = selectedProvider?.availability === 'offline'
  const disabled = props.busy || providerBlocked || !props.prompt.trim() || (props.intent === 'revise' && target === null)
  const provenanceNode = selected.length === 1 ? selected[0] : null
  const provenance = props.baseRevision ?? ((provenanceNode?.historical || provenanceNode?.sourceRunId) ? {
    id: provenanceNode.revisionId ?? 'unknown',
    label: provenanceNode.revisionLabel ?? '历史版本',
    createdAt: provenanceNode.createdAt,
    runId: provenanceNode.sourceRunId,
    prompt: provenanceNode.sourcePrompt,
    provider: provenanceNode.sourceProvider,
    current: Boolean(provenanceNode.current),
    draft: Boolean(provenanceNode.draft),
  } : null)
  const availableIntents = editable.length ? ['analyze', 'create', 'revise'] as const : ['analyze', 'create'] as const
  const availablePolicies = props.intent === 'analyze'
    ? ['reply_only', 'create_artifact'] as const
    : props.intent === 'create'
      ? ['create_artifact', 'create_collection'] as const
      : ['draft_revision_per_target'] as const
  const intentOptions: readonly MenuOption<RunOutputIntent>[] = availableIntents.map((value) => ({
    value,
    label: intentLabels[value],
    description: value === 'analyze' ? '判断与归纳，不要求生成文件' : value === 'create' ? '基于参考创建新的内容' : '基于指定版本生成 Draft',
    icon: value === 'analyze' ? <Brain size={14} /> : value === 'create' ? <WandSparkles size={14} /> : <PencilLine size={14} />,
  }))
  const providerOptions: readonly MenuOption<string>[] = [
    { value: 'auto', label: '自动选择', description: '由 LCOS 选择可用执行者', icon: <Sparkles size={14} /> },
    ...props.providers.filter((item) => item.provider !== 'auto').map((item) => ({
      value: item.provider,
      label: item.provider === 'workbuddy' ? 'WorkBuddy' : 'Codex',
      description: item.availability === 'ready' ? '可自动执行' : item.availability === 'busy' ? '当前忙碌' : item.availability === 'offline' ? '当前离线' : '需要本地 Agent 接取',
      icon: <Bot size={14} />,
      disabled: item.availability === 'offline',
    })),
  ]
  const resultOptions: readonly MenuOption<ComposerResultPolicy>[] = availablePolicies.map((value) => ({
    value,
    label: resultLabels[value],
    description: value === 'reply_only' ? '结果只进入 Run Activity' : value === 'create_artifact' ? '创建一个新内容对象' : value === 'create_collection' ? '允许返回多个新内容' : '不覆盖 Current，生成待确认版本',
    icon: value === 'reply_only' ? <MessageSquareText size={14} /> : value === 'draft_revision_per_target' ? <FilePenLine size={14} /> : <Files size={14} />,
  }))
  const targetOptions: readonly MenuOption<string>[] = [
    { value: '', label: '不设编辑对象', description: '仅分析或创建时使用', icon: <Target size={14} />, disabled: props.intent === 'revise' },
    ...editable.map((node) => ({ value: node.id, label: node.title, description: node.id === props.targetId && props.baseRevision ? props.baseRevision.label : node.revisionLabel ?? 'Current', icon: <FilePenLine size={14} /> })),
  ]

  return <section
    className="selection-composer"
    data-testid="selection-composer"
    style={{ left: props.x, top: props.y, '--selection-composer-scale': String(1 / Math.sqrt(Math.max(.24, props.zoom))) } as CSSProperties}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
  >
    <header className="selection-composer-header">
      <div>
        <span><Layers3 size={12} />本次 Agent 可见上下文</span>
        <strong>{selected.length === 1 ? selected[0]?.title : selected.slice(0, 2).map((node) => node.title).join('、')}{selected.length > 2 ? ` 等 ${selected.length} 项` : ''}</strong>
      </div>
      <div className="selection-composer-header-actions">
        {props.activeWorkspace && <button type="button" className="workspace-membership-action" onClick={allInWorkspace ? props.onRemoveFromWorkspace : props.onAddToWorkspace} title={allInWorkspace ? '从当前工作空间移出' : '加入当前工作空间'}>
          <FolderInput size={12} />{allInWorkspace ? '移出空间' : '加入空间'}
        </button>}
        {props.activeWorkspace && allInWorkspace && props.workspaces.length > 1 && <label className="workspace-move-action" title="把所选内容移到另一个工作空间">
          <span>移至</span>
          <select value="" onChange={(event) => { if (event.target.value) props.onMoveToWorkspace(event.target.value) }}>
            <option value="">选择空间</option>
            {props.workspaces.filter((workspace) => workspace.id !== props.activeWorkspace?.id).map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.label}</option>)}
          </select>
          <ChevronDown size={11} />
        </label>}
        <button type="button" className="icon-only" aria-label="关闭选区输入" onClick={props.onClose}><X size={13} /></button>
      </div>
    </header>

    {provenance && <div className="selection-provenance">
      <History size={12} />
      <div><b>{provenance.label}{provenance.runId ? ` · ${provenance.runId}` : ''}{provenance.provider ? ` · ${provenance.provider}` : ''}</b><span>{provenance.prompt ?? '将基于这个 Revision 创建新的 Draft，不会覆盖历史版本。'}</span></div>
    </div>}

    <div className="selection-context-shelf" aria-label="本次 Run 上下文">
      <div className="selection-context-chips">
        {contexts.map((node) => node.id === props.targetId
          ? <span key={node.id} className="context-chip is-target" title="当前编辑对象会作为 Base Revision 进入 Run"><Target size={11} /><span>{node.title}</span><small>目标</small></span>
          : <button key={node.id} type="button" className="context-chip" title={`移除 ${node.title}`} onClick={() => props.onToggleContext(node.id)}><Layers3 size={11} /><span>{node.title}</span><X size={10} /></button>)}
        <details className="context-add-menu">
          <summary title="加入上下文"><Plus size={12} />加入参考</summary>
          <div>{contextCandidates.length ? contextCandidates.map((node) => <button key={node.id} type="button" onClick={(event) => { props.onToggleContext(node.id); event.currentTarget.closest('details')?.removeAttribute('open') }}><Plus size={11} /><span>{node.title}</span></button>) : <p>当前画布没有更多可加入内容</p>}</div>
        </details>
      </div>
      <small>{contexts.some((node) => node.id !== props.targetId) ? `当前显示 ${contexts.filter((node) => node.id !== props.targetId).length} 个参考；移除后不会发送给 Agent。` : '这里显示什么，Agent 就只读取什么。'}</small>
    </div>

    <div className="selection-composer-input">
      <textarea
        data-testid="selection-composer-input"
        value={props.prompt}
        onChange={(event) => props.onPromptChange(event.target.value)}
        placeholder={props.intent === 'revise' ? '告诉本地 Agent 需要怎么修改…' : props.intent === 'create' ? '描述要基于这些内容创建什么…' : '告诉本地 Agent 要分析、归纳或判断什么…'}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !disabled) {
            event.preventDefault()
            props.onSend()
          }
        }}
      />
      <button type="button" className="selection-send" disabled={disabled} onClick={props.onSend} title={providerBlocked ? '所选 Agent 当前离线' : disabled ? '补全指令与编辑对象后执行' : '开始 Run · Ctrl/Cmd+Enter'}><ArrowUp size={16} /></button>
    </div>

    {props.proposalSummary && <div className="proposal-summary"><Sparkles size={11} />{props.proposalSummary}</div>}
    {props.ambiguityQuestion && <div className="proposal-ambiguity"><CornerDownRight size={11} />{props.ambiguityQuestion}</div>}

    <footer className="selection-composer-options">
      <ComposerMenu label="工作方式" value={props.intent} options={intentOptions} onChange={props.onIntentChange} />
      <ComposerMenu label="执行者" value={props.provider} options={providerOptions} onChange={props.onProviderChange} />
      <ComposerMenu label="结果去向" value={props.resultPolicy} options={resultOptions} onChange={props.onResultPolicyChange} />
      {editable.length > 0 && <ComposerMenu className="target-option" label="编辑对象" value={props.targetId ?? ''} options={targetOptions} onChange={(value) => props.onTargetChange(value || null)} />}
    </footer>
  </section>
}
