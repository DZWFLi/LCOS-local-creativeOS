import type { CSSProperties } from 'react'
import { ArrowUp, ChevronDown, CornerDownRight, FolderInput, History, Layers3, Sparkles, Target, X } from 'lucide-react'
import type { RuntimeProviderStatus } from '@local-creative-os/contracts'
import type { CanvasNode, Workspace } from '../../model'
import type { RunOutputIntent } from '../../runtime/v07UiContracts'
import type { ArtifactRevisionProvenance } from '../../runtime/projectionAdapters'

export type ComposerResultPolicy = 'reply_only' | 'create_artifact' | 'create_collection' | 'draft_revision_per_target'

interface Props {
  nodes: CanvasNode[]
  selectedIds: string[]
  linkedCount: number
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

export function SelectionComposer(props: Props) {
  const selected = props.selectedIds.map((id) => props.nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
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

  return <section
    className="selection-composer"
    data-testid="selection-composer"
    style={{ left: props.x, top: props.y, '--selection-composer-scale': String(1 / Math.max(.24, props.zoom)) } as CSSProperties}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
  >
    <header className="selection-composer-header">
      <div>
        <span><Layers3 size={12} />{selected.length === 1 ? `当前对象 + ${props.linkedCount} 个直接关联` : `严格使用已选 ${selected.length} 项`}</span>
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
      <label><span>范式</span><select value={props.intent} onChange={(event) => props.onIntentChange(event.target.value as RunOutputIntent)}>{availableIntents.map((value) => <option key={value} value={value}>{intentLabels[value]}</option>)}</select><ChevronDown size={11} /></label>
      <label><span>Agent</span><select value={props.provider} onChange={(event) => props.onProviderChange(event.target.value)}><option value="auto">Auto</option>{props.providers.filter((item) => item.provider !== 'auto').map((item) => <option key={item.provider} value={item.provider} disabled={item.availability === 'offline'}>{item.provider === 'workbuddy' ? 'WorkBuddy' : 'Codex'} · {item.availability}</option>)}</select><ChevronDown size={11} /></label>
      <label><span>结果</span><select value={props.resultPolicy} onChange={(event) => props.onResultPolicyChange(event.target.value as ComposerResultPolicy)}>{availablePolicies.map((value) => <option key={value} value={value}>{resultLabels[value]}</option>)}</select><ChevronDown size={11} /></label>
      {editable.length > 0 && <label className="target-option"><span><Target size={10} />编辑对象</span><select value={props.targetId ?? ''} disabled={props.intent !== 'revise'} onChange={(event) => props.onTargetChange(event.target.value || null)}><option value="">不设目标</option>{editable.map((node) => <option key={node.id} value={node.id}>{node.title} · {node.id === props.targetId && props.baseRevision ? props.baseRevision.label : node.revisionLabel ?? 'Current'}</option>)}</select><ChevronDown size={11} /></label>}
    </footer>
  </section>
}
