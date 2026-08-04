import type { CSSProperties, ReactNode } from 'react'
import { ArrowUp, Bot, ChevronDown, FolderInput, History, Layers3, Plus, Sparkles, Target, X } from 'lucide-react'
import type { RuntimeProviderStatus } from '@local-creative-os/contracts'
import type { CanvasNode, Workspace } from '../../model'
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
  provider: string
  createAsNewNode: boolean
  baseRevision?: ArtifactRevisionProvenance
  providers: readonly RuntimeProviderStatus[]
  activeWorkspace: Workspace | null
  workspaces: readonly Workspace[]
  busy: boolean
  proposalSummary?: string
  ambiguityQuestion?: string
  onPromptChange: (value: string) => void
  onProviderChange: (value: string) => void
  onCreateAsNewNodeChange: (value: boolean) => void
  onToggleContext: (id: string) => void
  onSend: () => void
  onAddToWorkspace: () => void
  onRemoveFromWorkspace: () => void
  onMoveToWorkspace: (workspaceId: string) => void
  onClose: () => void
}

interface MenuOption<Value extends string> {
  value: Value
  label: string
  description: string
  icon: ReactNode
}

function ComposerMenu<Value extends string>(props: {
  label: string
  value: Value
  options: readonly MenuOption<Value>[]
  onChange: (value: Value) => void
}) {
  const selected = props.options.find((option) => option.value === props.value) ?? props.options[0]
  return <details className="composer-menu">
    <summary><span className="composer-menu-icon">{selected?.icon}</span><span><small>{props.label}</small><b>{selected?.label}</b></span><ChevronDown size={12} /></summary>
    <div className="composer-menu-popover" role="menu">
      {props.options.map((option) => <button key={option.value} type="button" role="menuitemradio" aria-checked={option.value === props.value} onClick={(event) => {
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
  const visibleContextIds = Array.from(new Set(props.contextIds))
  const contexts = visibleContextIds.map((id) => props.nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  const contextCandidates = props.nodes.filter((node) => node.kind !== 'process' && !visibleContextIds.includes(node.id))
  const editable = selected.filter((node) => node.managed === true && node.artifactId && node.revisionId)
  const inferredTarget = !props.createAsNewNode && editable.length === 1 ? editable[0] : null
  const allInWorkspace = Boolean(props.activeWorkspace && selected.length && selected.every((node) => node.workspaceIds?.includes(props.activeWorkspace!.id)))
  const automaticProviders = props.providers.filter((item) => item.provider !== 'auto' && item.executionMode === 'automatic' && ['ready', 'busy'].includes(item.availability))
  const selectedProvider = props.provider === 'auto' ? null : automaticProviders.find((item) => item.provider === props.provider) ?? null
  const providerBlocked = automaticProviders.length === 0 || (props.provider !== 'auto' && selectedProvider === null)
  const disabled = props.busy || providerBlocked || !props.prompt.trim()
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
  const providerOptions: readonly MenuOption<string>[] = automaticProviders.length ? [
    { value: 'auto', label: '自动选择', description: '使用当前可自动执行的本地 Agent', icon: <Sparkles size={14} /> },
    ...automaticProviders.map((item) => ({
      value: item.provider,
      label: item.provider === 'workbuddy' ? 'WorkBuddy' : 'Codex',
      description: item.availability === 'ready' ? '可自动执行' : '当前忙碌，任务会排队',
      icon: <Bot size={14} />,
    })),
  ] : [{ value: 'unavailable', label: '暂无可用 Agent', description: '请先启动本地 Agent 服务', icon: <Bot size={14} /> }]
  const actionSummary = props.createAsNewNode
    ? `将参考 ${contexts.length} 项内容，并把结果放成新节点。`
    : inferredTarget
      ? `将修改《${inferredTarget.title}》，并参考另外 ${Math.max(0, contexts.filter((node) => node.id !== inferredTarget.id).length)} 项内容。`
      : editable.length > 1
        ? `Agent 将从 ${editable.length} 个可修改内容中判断目标；有歧义时再询问。`
        : `Agent 将先理解要求；需要产出文件时会建议作为新节点。`

  return <section
    className="selection-composer"
    data-testid="selection-composer"
    style={{ left: props.x, top: props.y, '--selection-composer-scale': String(1 / Math.sqrt(Math.max(.24, props.zoom))) } as CSSProperties}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
  >
    <header className="selection-composer-header">
      <div>
        <span><Layers3 size={12} />给 Agent 参考的内容</span>
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
        <button type="button" className="icon-only" aria-label="关闭输入框" onClick={props.onClose}><X size={13} /></button>
      </div>
    </header>

    {provenance && <div className="selection-provenance">
      <History size={12} />
      <div><b>{provenance.label}{provenance.provider ? ` · ${provenance.provider}` : ''}</b><span>{provenance.prompt ?? 'Agent 会基于这个版本工作；原版本不会被静默覆盖。'}</span></div>
    </div>}

    <div className="selection-context-shelf" aria-label="给 Agent 参考的内容">
      <div className="selection-context-chips">
        {contexts.map((node) => inferredTarget?.id === node.id
          ? <span key={node.id} className="context-chip is-target" title="系统当前推断为要修改的内容"><Target size={11} /><span>{node.title}</span><small>将修改</small></span>
          : <button key={node.id} type="button" className="context-chip" title={`移除 ${node.title}`} onClick={() => props.onToggleContext(node.id)}><Layers3 size={11} /><span>{node.title}</span><X size={10} /></button>)}
        <details className="context-add-menu">
          <summary title="添加参考内容"><Plus size={12} />添加</summary>
          <div>{contextCandidates.length ? contextCandidates.map((node) => <button key={node.id} type="button" onClick={(event) => { props.onToggleContext(node.id); event.currentTarget.closest('details')?.removeAttribute('open') }}><Plus size={11} /><span>{node.title}</span></button>) : <p>当前画布没有更多可加入内容</p>}</div>
        </details>
      </div>
    </div>

    <div className="selection-composer-input">
      <textarea
        data-testid="selection-composer-input"
        value={props.prompt}
        onChange={(event) => props.onPromptChange(event.target.value)}
        placeholder="告诉 Agent 你想做什么……"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !disabled) {
            event.preventDefault()
            props.onSend()
          }
        }}
      />
      <button type="button" className="selection-send" disabled={disabled} onClick={props.onSend} title={providerBlocked ? '本地 Agent 暂不可用，请查看诊断状态' : disabled ? '先写下你想让 Agent 做什么' : '发送 · Ctrl/Cmd+Enter'}><ArrowUp size={16} /></button>
    </div>

    <div className="proposal-summary"><Sparkles size={11} />{props.proposalSummary ?? actionSummary}</div>
    {props.ambiguityQuestion && <div className="proposal-ambiguity"><Target size={11} />{props.ambiguityQuestion}</div>}

    <footer className="selection-composer-options simple-composer-options">
      <ComposerMenu label="Agent" value={providerOptions.some((item) => item.value === props.provider) ? props.provider : providerOptions[0]!.value} options={providerOptions} onChange={providerBlocked ? () => undefined : props.onProviderChange} />
      <label className="create-new-node-toggle">
        <input type="checkbox" checked={props.createAsNewNode} onChange={(event) => props.onCreateAsNewNodeChange(event.target.checked)} />
        <span>结果作为新节点</span>
      </label>
    </footer>
  </section>
}
