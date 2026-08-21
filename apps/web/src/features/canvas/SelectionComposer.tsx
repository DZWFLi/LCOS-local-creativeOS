import type { CSSProperties } from 'react'
import { ArrowUp, History, Settings2, Target, X } from 'lucide-react'
import type { RuntimeProviderStatus } from '@local-creative-os/contracts'
import type { CanvasNode } from '../../model'
import type { ArtifactRevisionProvenance } from '../../runtime/projectionAdapters'

export type ComposerResultPolicy = 'reply_only' | 'create_artifact' | 'create_collection' | 'draft_revision_per_target'
export type ComposerIntent = 'analyze' | 'create' | 'revise'

interface Props {
  nodes: CanvasNode[]
  selectedIds: string[]
  contextIds: string[]
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
  onPromptChange: (value: string) => void
  onProviderChange: (value: string) => void
  onCreateAsNewNodeChange: (value: boolean) => void
  onIntentChange?: (value: ComposerIntent) => void
  onResultPolicyChange?: (value: ComposerResultPolicy) => void
  onToggleContext: (id: string) => void
  onSend: () => void
  onClose: () => void
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

  const changeIntent = (next: ComposerIntent) => {
    props.onIntentChange?.(next)
    props.onCreateAsNewNodeChange(next === 'create')
    props.onResultPolicyChange?.(next === 'analyze' ? 'reply_only' : next === 'revise' ? 'draft_revision_per_target' : 'create_artifact')
  }

  return <section className="selection-composer lcos-nearfield-composer" data-testid="selection-composer" style={{ left: props.x, top: props.y } as CSSProperties} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
    <div className="lcos-composer-input-row">
      <textarea data-testid="selection-composer-input" value={props.prompt} onChange={(event) => props.onPromptChange(event.target.value)} placeholder={selected.length === 1 ? `对「${selected[0]?.title ?? '当前对象'}」说点什么…` : `基于已选 ${selected.length} 项说点什么…`} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !disabled) { event.preventDefault(); props.onSend() } }}/>
      <button type="button" className="lcos-composer-send" disabled={disabled} onClick={props.onSend} title={providerBlocked ? '本地 Agent 暂不可用' : '发送 · Ctrl/Cmd+Enter'}><ArrowUp size={15}/></button>
    </div>

    <div className="lcos-composer-controls lcos-composer-controls-quiet">
      <details className="lcos-context-peek">
        <summary title="查看本次参考"><Target size={12}/><span>{contexts.length} 项参考</span></summary>
        <div className="lcos-context-peek-popover"><small>本次参考</small>{contexts.map((node) => <button key={node.id} type="button" onClick={() => props.onToggleContext(node.id)}><span>{node.title}</span><X size={10}/></button>)}</div>
      </details>
      <details className="lcos-composer-advanced">
        <summary title="高级设置"><Settings2 size={12}/><span>高级</span></summary>
        <div className="lcos-composer-advanced-popover">
          <small>通常不需要设置这些</small>
          <label><span>处理方式</span><select value={inferredIntent} onChange={(event) => changeIntent(event.target.value as ComposerIntent)}><option value="analyze">只回答</option><option value="create">创建新内容</option><option value="revise">修改现有内容</option></select></label>
          <label><span>Agent</span><select disabled={automaticProviders.length === 0} value={automaticProviders.length === 0 ? 'unavailable' : automaticProviders.some((item) => item.provider === props.provider) ? props.provider : 'auto'} onChange={(event) => props.onProviderChange(event.target.value)}>{automaticProviders.length === 0 ? <option value="unavailable">暂无可用 Agent</option> : <><option value="auto">自动选择</option>{automaticProviders.map((item) => <option key={item.provider} value={item.provider}>{item.provider === 'workbuddy' ? 'WorkBuddy' : item.provider === 'codex' ? 'Codex' : item.provider}</option>)}</>}</select></label>
          {inferredIntent === 'create' && <label><span>结果</span><select value={inferredResult === 'create_collection' ? 'create_collection' : 'create_artifact'} onChange={(event) => props.onResultPolicyChange?.(event.target.value as ComposerResultPolicy)}><option value="create_artifact">新内容</option><option value="create_collection">Collection</option></select></label>}
          <small className="lcos-composer-advanced-note">默认让系统根据你的话和当前选择判断，不需要先选模式。</small>
        </div>
      </details>
      <button type="button" className="lcos-composer-close" aria-label="关闭" onClick={props.onClose}><X size={12}/></button>
    </div>

    {provenance && <div className="lcos-composer-provenance"><History size={11}/><span>{provenance.label}{provenance.provider ? ` · ${provenance.provider}` : ''}</span>{provenance.createdAt && <small>{new Date(provenance.createdAt).toLocaleString()}</small>}</div>}
    {props.ambiguityQuestion && <div className="lcos-composer-ambiguity"><Target size={11}/>{props.ambiguityQuestion}</div>}
  </section>
}
