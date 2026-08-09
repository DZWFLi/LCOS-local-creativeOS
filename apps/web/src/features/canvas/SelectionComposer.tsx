import type { CSSProperties, ReactNode } from 'react'
import { ArrowUp, Bot, ChevronDown, FilePlus2, History, MessageSquareText, PencilLine, Sparkles, Target, X } from 'lucide-react'
import type { RuntimeProviderStatus } from '@local-creative-os/contracts'
import type { CanvasNode, Workspace } from '../../model'
import type { ArtifactRevisionProvenance } from '../../runtime/projectionAdapters'

export type ComposerResultPolicy = 'reply_only' | 'create_artifact' | 'create_collection' | 'draft_revision_per_target'
export type ComposerIntent = 'analyze' | 'create' | 'revise'

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
  intent?: ComposerIntent
  resultPolicy?: ComposerResultPolicy
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
  onIntentChange?: (value: ComposerIntent) => void
  onResultPolicyChange?: (value: ComposerResultPolicy) => void
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
  hint: string
  icon: ReactNode
}

function ComposerMenu<Value extends string>({ label, value, options, onChange }: { label: string; value: Value; options: readonly MenuOption<Value>[]; onChange: (value: Value) => void }) {
  const selected = options.find((option) => option.value === value) ?? options[0]
  return <details className="lcos-composer-menu">
    <summary title={`${label}：${selected?.label ?? ''}`}><span>{selected?.icon}</span><b>{selected?.label}</b><ChevronDown size={11}/></summary>
    <div className="lcos-composer-menu-popover" role="menu">
      <small>{label}</small>
      {options.map((option) => <button key={option.value} type="button" role="menuitemradio" aria-checked={option.value === value} onClick={(event) => { onChange(option.value); event.currentTarget.closest('details')?.removeAttribute('open') }}><span>{option.icon}</span><div><b>{option.label}</b><small>{option.hint}</small></div></button>)}
    </div>
  </details>
}

export function SelectionComposer(props: Props) {
  const selected = props.selectedIds.map((id) => props.nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  const contexts = Array.from(new Set(props.contextIds)).map((id) => props.nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  const editable = selected.filter((node) => node.managed === true && node.artifactId && node.revisionId)
  const inferredIntent: ComposerIntent = props.intent ?? (props.createAsNewNode ? 'create' : editable.length === 1 ? 'revise' : 'analyze')
  const inferredResult: ComposerResultPolicy = props.resultPolicy ?? (inferredIntent === 'create' ? 'create_artifact' : inferredIntent === 'revise' ? 'draft_revision_per_target' : 'reply_only')
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

  const intentOptions: readonly MenuOption<ComposerIntent>[] = [
    { value: 'analyze', label: '分析', hint: '只读当前 Context', icon: <MessageSquareText size={13}/> },
    { value: 'create', label: '创建', hint: '产出新的 Artifact', icon: <FilePlus2 size={13}/> },
    { value: 'revise', label: '修改', hint: '基于目标创建 Draft', icon: <PencilLine size={13}/> },
  ]
  const providerOptions: readonly MenuOption<string>[] = automaticProviders.length ? [
    { value: 'auto', label: 'Auto', hint: '自动选择可执行 Agent', icon: <Sparkles size={13}/> },
    ...automaticProviders.map((item) => ({ value: item.provider, label: item.provider === 'workbuddy' ? 'WorkBuddy' : item.provider === 'codex' ? 'Codex' : item.provider, hint: item.availability === 'ready' ? 'Ready' : 'Busy · 会排队', icon: <Bot size={13}/> })),
  ] : [{ value: 'unavailable', label: '无 Agent', hint: '请启动本地 Agent', icon: <Bot size={13}/> }]
  const resultOptions: readonly MenuOption<ComposerResultPolicy>[] = inferredIntent === 'analyze'
    ? [{ value: 'reply_only', label: '回复', hint: '不创建项目对象', icon: <MessageSquareText size={13}/> }]
    : inferredIntent === 'revise'
      ? [{ value: 'draft_revision_per_target', label: '新 Draft', hint: '不覆盖历史版本', icon: <History size={13}/> }]
      : [
        { value: 'create_artifact', label: '新 Artifact', hint: '创建项目内容', icon: <FilePlus2 size={13}/> },
        { value: 'create_collection', label: 'Collection', hint: '把结果组织成集合', icon: <Target size={13}/> },
      ]

  const changeIntent = (next: ComposerIntent) => {
    props.onIntentChange?.(next)
    props.onCreateAsNewNodeChange(next === 'create')
    const nextResult: ComposerResultPolicy = next === 'analyze' ? 'reply_only' : next === 'revise' ? 'draft_revision_per_target' : 'create_artifact'
    props.onResultPolicyChange?.(nextResult)
  }

  return <section className="selection-composer lcos-nearfield-composer" data-testid="selection-composer" style={{ left: props.x, top: props.y } as CSSProperties} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
    <div className="lcos-composer-input-row">
      <textarea data-testid="selection-composer-input" value={props.prompt} onChange={(event) => props.onPromptChange(event.target.value)} placeholder={selected.length === 1 ? `对「${selected[0]?.title ?? '当前对象'}」做什么…` : `基于已选 ${selected.length} 项继续…`} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !disabled) { event.preventDefault(); props.onSend() } }}/>
      <button type="button" className="lcos-composer-send" disabled={disabled} onClick={props.onSend} title={providerBlocked ? '本地 Agent 暂不可用' : '发送 · Ctrl/Cmd+Enter'}><ArrowUp size={15}/></button>
    </div>

    <div className="lcos-composer-controls">
      <ComposerMenu label="操作" value={inferredIntent} options={intentOptions} onChange={changeIntent}/>
      <ComposerMenu label="Agent" value={providerOptions.some((item) => item.value === props.provider) ? props.provider : providerOptions[0]!.value} options={providerOptions} onChange={providerBlocked ? () => undefined : props.onProviderChange}/>
      <ComposerMenu label="结果" value={resultOptions.some((item) => item.value === inferredResult) ? inferredResult : resultOptions[0]!.value} options={resultOptions} onChange={(value) => props.onResultPolicyChange?.(value)}/>
      <details className="lcos-context-peek">
        <summary title="查看本次 Context"><Target size={12}/><span>{contexts.length}</span></summary>
        <div className="lcos-context-peek-popover"><small>本次 Context</small>{contexts.map((node) => <button key={node.id} type="button" onClick={() => props.onToggleContext(node.id)}><span>{node.title}</span><X size={10}/></button>)}</div>
      </details>
      <button type="button" className="lcos-composer-close" aria-label="关闭" onClick={props.onClose}><X size={12}/></button>
    </div>

    {provenance && <div className="lcos-composer-provenance"><History size={11}/><span>{provenance.label}{provenance.provider ? ` · ${provenance.provider}` : ''}</span>{provenance.createdAt && <small>{new Date(provenance.createdAt).toLocaleString()}</small>}</div>}
    {props.ambiguityQuestion && <div className="lcos-composer-ambiguity"><Target size={11}/>{props.ambiguityQuestion}</div>}
  </section>
}
