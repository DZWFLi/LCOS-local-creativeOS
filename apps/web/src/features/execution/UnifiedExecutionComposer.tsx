import type { CSSProperties } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Crosshair, History, Plus, Settings2, Sparkles, X } from 'lucide-react'
import type { ConnectedConversationV1, RuntimeProviderStatus } from '@local-creative-os/contracts'
import type { CanvasNode } from '../../model'
import type { ArtifactRevisionProvenance } from '../../runtime/projectionAdapters'
import type { ComposerIntent, ComposerResultPolicy } from '../canvas/SelectionComposer'
import { detectFileIdentity } from '../canvas/CanvasNodeVisual'
import { referenceCandidates } from './commandDraft'

interface Props {
  nodes: readonly CanvasNode[]
  selectedIds: readonly string[]
  referenceIds: readonly string[]
  receivers: readonly ConnectedConversationV1[]
  activeReceiverId: string | null
  receiverId: string | null
  reachCount?: number
  x: number
  y: number
  prompt: string
  provider: string
  createAsNewNode: boolean
  intent?: ComposerIntent
  resultPolicy?: ComposerResultPolicy
  baseRevision?: ArtifactRevisionProvenance
  providers: readonly RuntimeProviderStatus[]
  busy: boolean
  ambiguityQuestion?: string
  referencePickActive?: boolean
  referencePickAvailable?: boolean
  referencePickUnavailableReason?: string
  executionBlockedReason?: string
  resultSlot?: { readonly id: string; readonly status: 'empty' | 'running' | 'review' | 'materialized'; readonly title: string }
  onPromptChange: (value: string) => void
  onProviderChange: (value: string) => void
  onCreateAsNewNodeChange: (value: boolean) => void
  onIntentChange?: (value: ComposerIntent) => void
  onResultPolicyChange?: (value: ComposerResultPolicy) => void
  onReceiverChange: (connectedConversationId: string) => void
  onRemoveReference: (id: string) => void
  onMoveReference: (id: string, delta: -1 | 1) => void
  onStartReferencePick: () => void
  onFinishReferencePick: () => void
  onSend: () => void
  onClose: () => void
}

function receiverLabel(receiver: ConnectedConversationV1): string {
  return receiver.label?.trim() || receiver.conversationRef
}

function referenceKindLabel(node: CanvasNode): string {
  if (node.entityKind === 'conversation') return 'Conversation'
  if (node.entityKind === 'context') return 'Context'
  if (node.entityKind === 'workflow') return 'Workflow'
  if (node.entityKind === 'collection') return 'Collection'
  if (node.entityKind === 'workspace') return 'Scene'
  if (node.kind === 'note') return 'Note'
  return detectFileIdentity(node).toUpperCase()
}

export function UnifiedExecutionComposer(props: Props) {
  const selected = props.selectedIds.map((id) => props.nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  const references = referenceCandidates(props.referenceIds, props.nodes, props.receiverId, props.receivers)
  const editable = selected.filter((node) => node.managed === true && node.artifactId && node.revisionId)
  const inferredIntent: ComposerIntent = props.resultSlot ? 'create' : props.intent ?? (props.createAsNewNode ? 'create' : editable.length === 1 ? 'revise' : 'analyze')
  const inferredResult: ComposerResultPolicy = props.resultPolicy ?? (inferredIntent === 'create' ? 'create_artifact' : inferredIntent === 'revise' ? 'draft_revision_per_target' : 'reply_only')
  const automaticProviders = props.providers.filter((item) => item.provider !== 'auto' && item.executionMode === 'automatic' && ['ready', 'busy'].includes(item.availability))
  const selectedProvider = props.provider === 'auto' ? null : automaticProviders.find((item) => item.provider === props.provider) ?? null
  const providerBlocked = automaticProviders.length === 0 || (props.provider !== 'auto' && selectedProvider === null)
  const receiver = props.receiverId === null ? null : props.receivers.find((item) => item.id === props.receiverId) ?? null
  const unsupportedReferences = references.filter((item) => !item.supported)
  const blockedReason = props.executionBlockedReason ?? (receiver === null ? '请选择一只已链接的 Receiver Glyth。' : unsupportedReferences[0]?.reason)
  const disabled = props.busy || providerBlocked || !props.prompt.trim() || Boolean(blockedReason)
  const provenanceNode = selected.length === 1 ? selected[0] : null
  const provenance = props.baseRevision ?? ((provenanceNode?.historical || provenanceNode?.sourceRunId) ? {
    id: provenanceNode.revisionId ?? 'unknown', label: provenanceNode.revisionLabel ?? '历史版本', createdAt: provenanceNode.createdAt,
    runId: provenanceNode.sourceRunId, prompt: provenanceNode.sourcePrompt, provider: provenanceNode.sourceProvider,
    current: Boolean(provenanceNode.current), draft: Boolean(provenanceNode.draft),
  } : null)

  const changeIntent = (next: ComposerIntent) => {
    props.onIntentChange?.(next)
    props.onCreateAsNewNodeChange(next === 'create')
    props.onResultPolicyChange?.(next === 'analyze' ? 'reply_only' : next === 'revise' ? 'draft_revision_per_target' : 'create_artifact')
  }

  return <section className="selection-composer lcos-nearfield-composer lcos-unified-execution-composer" data-testid="selection-composer" data-reference-pick={props.referencePickActive || undefined} style={{ left: props.x, top: props.y } as CSSProperties} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
    <div className="lcos-command-draft-head">
      <label className="lcos-receiver-select" title="这次 Run 交给哪段 Conversation；不会修改全局 Active Receiver">
        <Sparkles size={12}/>
        <select value={props.receiverId ?? ''} onChange={(event) => props.onReceiverChange(event.target.value)} aria-label="Receiver Glyth">
          <option value="" disabled>选择 Receiver Glyth</option>
          {props.receivers.map((item) => <option key={item.id} value={item.id}>{receiverLabel(item)}{item.id === props.activeReceiverId ? ' · 当前' : ''}{item.conversationSessionId ? '' : ' · 未链接'}</option>)}
        </select>
        <ChevronDown size={10}/>
      </label>
      {props.resultSlot && <span className={`lcos-result-target is-${props.resultSlot.status}`} title="Blank Result 是这次 Return 的明确落点，不是 Reference">Result · {props.resultSlot.title}</span>}
      <span className="lcos-reach-summary" title="Conversation Reach 是背景可达范围，不等于本次显式 References">Reach {props.reachCount ?? 0}</span>
    </div>

    <div className="lcos-reference-tray" aria-label="本次显式引用">
      <div className="lcos-reference-tray-head"><span>References</span><small>{references.length} 项 · 顺序会冻结进 ContextManifest</small></div>
      <div className="lcos-reference-chips">
        {references.map((candidate, index) => <div key={candidate.node.id} className={`lcos-reference-chip ${candidate.supported ? '' : 'is-unsupported'}`} data-reference-id={candidate.node.id} data-reference-order={index + 1} title={candidate.reason ?? candidate.node.title}>
          <b>{index + 1}</b>
          {candidate.node.previewUrl && detectFileIdentity(candidate.node) === 'image'
            ? <img src={candidate.node.previewUrl} alt="" />
            : <i>{referenceKindLabel(candidate.node)}</i>}
          <span>{candidate.node.title}</span>
          <div className="lcos-reference-chip-actions">
            <button type="button" disabled={index === 0} aria-label={`上移 ${candidate.node.title}`} onClick={() => props.onMoveReference(candidate.node.id, -1)}><ArrowUp size={10}/></button>
            <button type="button" disabled={index === references.length - 1} aria-label={`下移 ${candidate.node.title}`} onClick={() => props.onMoveReference(candidate.node.id, 1)}><ArrowDown size={10}/></button>
            <button type="button" aria-label={`移除引用 ${candidate.node.title}`} onClick={() => props.onRemoveReference(candidate.node.id)}><X size={10}/></button>
          </div>
        </div>)}
        {!references.length && <span className="lcos-reference-empty">没有显式引用；Receiver Reach 仍可作为背景范围。</span>}
      </div>
      <div className="lcos-reference-actions">
        <button type="button" className={`lcos-reference-pick ${props.referencePickActive ? 'is-active' : ''}`} disabled={props.referencePickAvailable === false} title={props.referencePickAvailable === false ? props.referencePickUnavailableReason : undefined} onClick={props.referencePickActive ? props.onFinishReferencePick : props.onStartReferencePick}><Crosshair size={11}/>{props.referencePickActive ? '完成画布选择' : '从画布选择'}</button>
        <button type="button" className="lcos-reference-add" disabled title="Project Search / Assembly 引用入口将在同一 Reference Tray 接入，不另造第二套选择器"><Plus size={11}/>更多来源</button>
      </div>
    </div>

    <div className="lcos-composer-input-row">
      <textarea data-testid="selection-composer-input" value={props.prompt} onChange={(event) => props.onPromptChange(event.target.value)} placeholder={receiver ? `对「${receiverLabel(receiver)}」说要做什么…` : '先选择 Receiver Glyth…'} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !disabled) { event.preventDefault(); props.onSend() } }}/>
      <button type="button" className="lcos-composer-send" disabled={disabled} onClick={props.onSend} title={blockedReason ?? (providerBlocked ? '本地 Agent 暂不可用' : '发送 · Ctrl/Cmd+Enter')}><ArrowUp size={15}/></button>
    </div>

    <div className="lcos-composer-controls lcos-composer-controls-quiet">
      <span className="lcos-command-scope-note">{receiver ? `${receiverLabel(receiver)} · ${references.length} 显式引用${props.resultSlot ? ' · 1 结果位' : ''}` : 'Receiver 未定'}</span>
      <details className="lcos-composer-advanced">
        <summary title="高级设置"><Settings2 size={12}/><span>高级</span></summary>
        <div className="lcos-composer-advanced-popover">
          <small>Provider 是执行器，不是用户层 Receiver</small>
          <label><span>处理方式</span><select value={inferredIntent} onChange={(event) => changeIntent(event.target.value as ComposerIntent)}><option value="analyze">只回答</option><option value="create">创建新内容</option><option value="revise">修改现有内容</option></select></label>
          <label><span>执行器</span><select disabled={automaticProviders.length === 0} value={automaticProviders.length === 0 ? 'unavailable' : automaticProviders.some((item) => item.provider === props.provider) ? props.provider : 'auto'} onChange={(event) => props.onProviderChange(event.target.value)}>{automaticProviders.length === 0 ? <option value="unavailable">暂无可用 Agent</option> : <><option value="auto">自动选择</option>{automaticProviders.map((item) => <option key={item.provider} value={item.provider}>{item.provider === 'workbuddy' ? 'WorkBuddy' : item.provider === 'codex' ? 'Codex' : item.provider}</option>)}</>}</select></label>
          {inferredIntent === 'create' && <label><span>结果</span><select value={inferredResult === 'create_collection' ? 'create_collection' : 'create_artifact'} onChange={(event) => props.onResultPolicyChange?.(event.target.value as ComposerResultPolicy)}><option value="create_artifact">新内容</option><option value="create_collection">Collection</option></select></label>}
          <small className="lcos-composer-advanced-note">选择一次 Receiver 不会偷偷修改 Project Active Receiver。</small>
        </div>
      </details>
      <button type="button" className="lcos-composer-close" aria-label="关闭" onClick={props.onClose}><X size={12}/></button>
    </div>

    {blockedReason && <div className="lcos-composer-ambiguity"><Crosshair size={11}/><span>{blockedReason}</span></div>}
    {provenance && <div className="lcos-composer-provenance"><History size={11}/><span>{provenance.label}{provenance.provider ? ` · ${provenance.provider}` : ''}</span>{provenance.createdAt && <small>{new Date(provenance.createdAt).toLocaleString()}</small>}</div>}
    {props.ambiguityQuestion && <div className="lcos-composer-ambiguity"><Crosshair size={11}/>{props.ambiguityQuestion}</div>}
  </section>
}
