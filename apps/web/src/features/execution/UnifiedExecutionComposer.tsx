import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Crosshair, History, LoaderCircle, Mic, RotateCcw, Settings2, Sparkles, Square, X } from 'lucide-react'
import type { ConnectedConversationV1, RuntimeProviderStatus } from '@local-creative-os/contracts'
import type { CanvasNode } from '../../model'
import type { ArtifactRevisionProvenance } from '../../runtime/projectionAdapters'
import { useLocalCoreClientOrNull } from '../../runtime/LocalCoreClientContext'
import type { ComposerIntent, ComposerResultPolicy } from '../canvas/SelectionComposer'
import { detectFileIdentity } from '../canvas/CanvasNodeVisual'
import { dismissTop, queryStack, register as registerOverlay } from '../ui/overlayStack'
import { resolveSpatialOverlayPlacement, type SpatialOverlayPlacementInput } from '../ui/spatialOverlayPlacement'
import { referenceCandidates } from './commandDraft'
import { appendVoiceTranscript, voiceErrorLabel, voiceErrorState, voiceModeActive } from './voiceComposerInput'
import { createLocalCoreVoiceTranscribePort, DefaultVoiceOrchestrator, type VoiceOrchestrationSnapshot, type VoiceOrchestrator } from './voiceOrchestration'

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
  spatialPlacement?: Omit<SpatialOverlayPlacementInput, 'overlaySize'>
  spatialPlacementOrigin?: { readonly x: number; readonly y: number }
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
  if (node.entityKind === 'conversation') return '对话'
  if (node.entityKind === 'context') return '上下文'
  if (node.entityKind === 'workflow') return '工作流'
  if (node.entityKind === 'collection') return '集合'
  if (node.entityKind === 'workspace') return '工作现场'
  if (node.kind === 'note') return '文本'
  return detectFileIdentity(node).toUpperCase()
}

const IDLE_VOICE_SNAPSHOT: VoiceOrchestrationSnapshot = { state: 'idle', transcript: null, error: null }

export function UnifiedExecutionComposer(props: Props) {
  const rootRef = useRef<HTMLElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const localCoreClient = useLocalCoreClientOrNull()
  const voiceOrchestratorRef = useRef<VoiceOrchestrator | null>(null)
  const voiceStateRef = useRef(IDLE_VOICE_SNAPSHOT.state)
  const promptRef = useRef(props.prompt)
  const onPromptChangeRef = useRef(props.onPromptChange)
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceOrchestrationSnapshot>(IDLE_VOICE_SNAPSHOT)
  const [measuredOverlaySize, setMeasuredOverlaySize] = useState({ width: 380, height: 132 })
  const overlayId = useId()
  const onCloseRef = useRef(props.onClose)
  useEffect(() => { onCloseRef.current = props.onClose }, [props.onClose])
  useEffect(() => { promptRef.current = props.prompt }, [props.prompt])
  useEffect(() => { onPromptChangeRef.current = props.onPromptChange }, [props.onPromptChange])
  useEffect(() => { voiceStateRef.current = voiceSnapshot.state }, [voiceSnapshot.state])
  useEffect(() => {
    if (!localCoreClient) {
      voiceOrchestratorRef.current = null
      setVoiceSnapshot(IDLE_VOICE_SNAPSHOT)
      return
    }
    const orchestrator = new DefaultVoiceOrchestrator({ transcribe: createLocalCoreVoiceTranscribePort(localCoreClient) })
    voiceOrchestratorRef.current = orchestrator
    const unsubscribe = orchestrator.subscribe(setVoiceSnapshot)
    const unsubscribeTranscript = orchestrator.onTranscript((transcript) => {
      const nextPrompt = appendVoiceTranscript(promptRef.current, transcript.text)
      promptRef.current = nextPrompt
      onPromptChangeRef.current(nextPrompt)
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }))
    })
    return () => {
      unsubscribe()
      unsubscribeTranscript()
      if (voiceOrchestratorRef.current === orchestrator) voiceOrchestratorRef.current = null
      void orchestrator.dispose()
    }
  }, [localCoreClient])
  useLayoutEffect(() => {
    const element = rootRef.current
    if (!element) return
    const measure = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width <= 1 || rect.height <= 1) return
      setMeasuredOverlaySize((current) => Math.abs(current.width - rect.width) < .5 && Math.abs(current.height - rect.height) < .5
        ? current
        : { width: rect.width, height: rect.height })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const minHeight = 34
    const maxHeight = 88
    textarea.style.height = '0px'
    const nextHeight = Math.min(maxHeight, Math.max(minHeight, textarea.scrollHeight))
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [props.prompt])
  const spatialPlacement = props.spatialPlacement
    ? resolveSpatialOverlayPlacement({ ...props.spatialPlacement, overlaySize: measuredOverlaySize })
    : null
  const spatialPlacementOrigin = props.spatialPlacementOrigin ?? (props.spatialPlacement ? { x: props.spatialPlacement.viewport.left, y: props.spatialPlacement.viewport.top } : { x: 0, y: 0 })
  const composerLeft = spatialPlacement ? spatialPlacement.left - spatialPlacementOrigin.x : props.x
  const composerTop = spatialPlacement ? spatialPlacement.top - spatialPlacementOrigin.y : props.y
  useEffect(() => {
    const unregister = registerOverlay(overlayId, {
      kind: 'popover',
      element: () => rootRef.current,
      onEsc: () => {
        const voiceState = voiceStateRef.current
        if (voiceState !== 'idle' && voiceState !== 'editable') {
          void voiceOrchestratorRef.current?.cancel()
          return
        }
        onCloseRef.current()
      },
      dismissOnOutside: true,
    })
    const onOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target !== null && rootRef.current?.contains(target)) return
      const stack = queryStack()
      if (stack[stack.length - 1]?.id !== overlayId) return
      const voiceState = voiceStateRef.current
      if (voiceState !== 'idle' && voiceState !== 'editable') {
        void voiceOrchestratorRef.current?.cancel()
        return
      }
      dismissTop()
    }
    window.addEventListener('pointerdown', onOutsidePointerDown, true)
    return () => {
      window.removeEventListener('pointerdown', onOutsidePointerDown, true)
      unregister()
    }
  }, [overlayId])
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
  const blockedReason = props.executionBlockedReason ?? (receiver === null ? '请选择一段已连接的对话。' : unsupportedReferences[0]?.reason)
  const disabled = props.busy || providerBlocked || !props.prompt.trim() || Boolean(blockedReason)
  const provenanceNode = selected.length === 1 ? selected[0] : null
  const provenance = props.baseRevision ?? ((provenanceNode?.historical || provenanceNode?.sourceRunId) ? {
    id: provenanceNode.revisionId ?? 'unknown', label: provenanceNode.revisionLabel ?? '历史版本', createdAt: provenanceNode.createdAt,
    runId: provenanceNode.sourceRunId, prompt: provenanceNode.sourcePrompt, provider: provenanceNode.sourceProvider,
    current: Boolean(provenanceNode.current), draft: Boolean(provenanceNode.draft),
  } : null)
  const targetLabel = selected.length === 1 ? selected[0].title : selected.length > 1 ? `${selected.length} 项选择` : receiver ? receiverLabel(receiver) : '当前目标'
  const selectionReferenceSeparationHint = selected.length
    ? `当前选择的 ${selected.length} 项是直接处理对象，不会自动记入参考。`
    : 'Selection 与额外参考保持分离。'

  const changeIntent = (next: ComposerIntent) => {
    props.onIntentChange?.(next)
    props.onCreateAsNewNodeChange(next === 'create')
    props.onResultPolicyChange?.(next === 'analyze' ? 'reply_only' : next === 'revise' ? 'draft_revision_per_target' : 'create_artifact')
  }
  const changePrompt = (next: string) => {
    promptRef.current = next
    props.onPromptChange(next)
  }
  const voiceState = voiceSnapshot.state
  const voiceMode = voiceModeActive(voiceState)
  const voiceHasError = voiceErrorState(voiceState)
  const voiceAvailable = localCoreClient !== null && !props.busy
  const startVoice = () => {
    const orchestrator = voiceOrchestratorRef.current
    if (!orchestrator || !voiceAvailable) return
    if (props.referencePickActive) props.onFinishReferencePick()
    void orchestrator.start().catch(() => undefined)
  }
  const stopVoice = () => { void voiceOrchestratorRef.current?.stop({ timestamps: false }).catch(() => undefined) }
  const cancelVoice = () => { void voiceOrchestratorRef.current?.cancel() }
  const retryVoice = () => { void voiceOrchestratorRef.current?.retry().catch(() => undefined) }
  const resetVoice = () => { void voiceOrchestratorRef.current?.reset() }

  return <section ref={rootRef} className="selection-composer lcos-nearfield-composer lcos-unified-execution-composer" data-lcos-transient-owner="selection-composer" data-testid="selection-composer" data-composer-density="compact" data-reference-pick={props.referencePickActive || undefined} data-voice-state={voiceState} data-spatial-placement-side={spatialPlacement?.side} data-spatial-placement-free={spatialPlacement?.free || undefined} style={{ left: composerLeft, top: composerTop } as CSSProperties} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
    <div className="lcos-command-draft-head lcos-command-draft-head-compact">
      {selected.length > 0
        ? <span className="lcos-selection-summary" title={`${selectionReferenceSeparationHint} 额外参考 ${references.length} 项。`}>当前选择 {selected.length}</span>
        : <span className="lcos-selection-summary" title="当前没有直接处理对象">当前现场</span>}
      {props.resultSlot && <span className={`lcos-result-target is-${props.resultSlot.status}`} title="这次生成的结果会放在这里，不会把它当成参考内容">结果 · {props.resultSlot.title}</span>}
      <span className="lcos-command-target-title" title={targetLabel}>{targetLabel}</span>
      <button type="button" className="lcos-composer-close" aria-label="关闭" onClick={props.onClose}><X size={12}/></button>
    </div>

    {references.length > 0 && <div className="lcos-reference-strip" aria-label="本次显式引用" title={selectionReferenceSeparationHint}>
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
      </div>
    </div>}

    {voiceMode ? <div className={`lcos-voice-input-stage is-${voiceState}`} role="status" aria-live="polite">
      <div className="lcos-voice-state-mark">{voiceState === 'transcribing' ? <LoaderCircle size={14}/> : <Mic size={14}/>}</div>
      <div className="lcos-voice-state-copy">
        {voiceState === 'requestingPermission' && <><b>正在连接麦克风</b><span>允许访问后即可开始</span></>}
        {voiceState === 'recording' && <><b>正在听你说</b><div className="lcos-voice-waveform" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index}/>)}</div></>}
        {voiceState === 'transcribing' && <><b>正在转成文字</b><span>完成后会回到可编辑输入</span></>}
        {voiceHasError && <><b>{voiceErrorLabel(voiceSnapshot)}</b><span title={voiceSnapshot.error?.message}>不会自动发送，可以重试或返回输入</span></>}
      </div>
      <div className="lcos-voice-state-actions">
        {voiceHasError ? <>
          <button type="button" className="lcos-voice-action" onClick={retryVoice} title={voiceState === 'transcriptionError' ? '重试转写' : '重试录音'} aria-label={voiceState === 'transcriptionError' ? '重试转写' : '重试录音'}><RotateCcw size={13}/></button>
          <button type="button" className="lcos-voice-action" onClick={resetVoice} title="返回文字输入" aria-label="返回文字输入"><X size={13}/></button>
        </> : <>
          <button type="button" className="lcos-voice-action" onClick={cancelVoice} title="取消语音输入" aria-label="取消语音输入"><X size={13}/></button>
          {voiceState === 'recording' && <button type="button" className="lcos-voice-action is-stop" onClick={stopVoice} title="停止并转成文字" aria-label="停止并转成文字"><Square size={11}/></button>}
        </>}
      </div>
    </div> : <>
      <div className="lcos-composer-input-row">
        <textarea ref={textareaRef} rows={1} data-testid="selection-composer-input" value={props.prompt} onChange={(event) => changePrompt(event.target.value)} placeholder={selected.length ? `对「${targetLabel}」说要做什么…` : receiver ? `对「${receiverLabel(receiver)}」说要做什么…` : '先选择一段对话…'} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !disabled) { event.preventDefault(); props.onSend() } }}/>
        <button type="button" className="lcos-composer-send" disabled={disabled} onClick={props.onSend} title={blockedReason ?? (providerBlocked ? '本地 Agent 暂不可用' : '发送 · Ctrl/Cmd+Enter')}><ArrowUp size={15}/></button>
      </div>

      <div className="lcos-composer-controls lcos-composer-controls-quiet lcos-composer-footer-compact">
        <button type="button" className="lcos-voice-trigger" disabled={!voiceAvailable} title={localCoreClient === null ? 'Local Core 未连接，语音输入暂不可用' : props.busy ? '当前任务运行中' : '语音输入'} aria-label="语音输入" onClick={startVoice}><Mic size={11}/><span>语音</span></button>
        <button type="button" className={`lcos-reference-pick ${props.referencePickActive ? 'is-active' : ''}`} disabled={props.referencePickAvailable === false} title={props.referencePickAvailable === false ? props.referencePickUnavailableReason : '参考 · Ctrl/Cmd + 点击画布对象；不会改变当前选择'} onClick={props.referencePickActive ? props.onFinishReferencePick : props.onStartReferencePick}><Crosshair size={11}/><span>{props.referencePickActive ? '完成参考' : '参考'}</span>{references.length > 0 && <b>{references.length}</b>}</button>
        <label className="lcos-receiver-select lcos-receiver-select-compact" title={`这次交给哪段对话；长期材料 ${props.reachCount ?? 0} 项，不等于你这次明确选中的参考`}>
          <Sparkles size={11}/>
          <select value={props.receiverId ?? ''} onChange={(event) => props.onReceiverChange(event.target.value)} aria-label="交给哪段对话">
            <option value="" disabled>选择承接对话</option>
            {props.receivers.map((item) => <option key={item.id} value={item.id}>{receiverLabel(item)}{item.id === props.activeReceiverId ? ' · 当前' : ''}{item.conversationSessionId ? '' : ' · 未链接'}</option>)}
          </select>
          <ChevronDown size={9}/>
        </label>
        <span className="lcos-command-scope-note" title={`${receiver ? receiverLabel(receiver) : '还没选择承接对话'} · ${selected.length} 项选择 · ${references.length} 项额外参考 · 长期材料 ${props.reachCount ?? 0}；长期材料不等于你这次明确选中的参考`}>{references.length ? `${references.length} 参考` : `${props.reachCount ?? 0} 长期材料`}</span>
        <details className="lcos-composer-advanced">
          <summary title="本次设置"><Settings2 size={12}/><span>设置</span></summary>
          <div className="lcos-composer-advanced-popover">
            <small>通常不需要设置这些，系统会优先选择可用的执行工具</small>
            <label><span>处理方式</span><select value={inferredIntent} onChange={(event) => changeIntent(event.target.value as ComposerIntent)}><option value="analyze">只回答</option><option value="create">创建新内容</option><option value="revise">修改现有内容</option></select></label>
            <label><span>执行器</span><select disabled={automaticProviders.length === 0} value={automaticProviders.length === 0 ? 'unavailable' : automaticProviders.some((item) => item.provider === props.provider) ? props.provider : 'auto'} onChange={(event) => props.onProviderChange(event.target.value)}>{automaticProviders.length === 0 ? <option value="unavailable">暂无可用 Agent</option> : <><option value="auto">自动选择</option>{automaticProviders.map((item) => <option key={item.provider} value={item.provider}>{item.provider === 'workbuddy' ? 'WorkBuddy' : item.provider === 'codex' ? 'Codex' : item.provider}</option>)}</>}</select></label>
            {inferredIntent === 'create' && <label><span>结果</span><select value={inferredResult === 'create_collection' ? 'create_collection' : 'create_artifact'} onChange={(event) => props.onResultPolicyChange?.(event.target.value as ComposerResultPolicy)}><option value="create_artifact">新内容</option><option value="create_collection">Collection</option></select></label>}
            <small className="lcos-composer-advanced-note">这里只影响这一次处理，不会改变项目默认承接对话。</small>
          </div>
        </details>
      </div>
    </>}

    {blockedReason && <div className="lcos-composer-ambiguity"><Crosshair size={11}/><span>{blockedReason}</span></div>}
    {provenance && <div className="lcos-composer-provenance"><History size={11}/><span>{provenance.label}{provenance.provider ? ` · ${provenance.provider}` : ''}</span>{provenance.createdAt && <small>{new Date(provenance.createdAt).toLocaleString()}</small>}</div>}
    {props.ambiguityQuestion && <div className="lcos-composer-ambiguity"><Crosshair size={11}/>{props.ambiguityQuestion}</div>}
  </section>
}
