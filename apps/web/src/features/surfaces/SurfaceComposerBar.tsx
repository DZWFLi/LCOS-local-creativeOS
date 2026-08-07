import { ArrowUp, ChevronDown, Layers3 } from 'lucide-react'
import type { RuntimeProviderStatus } from '@local-creative-os/contracts'
import type { CanvasNode } from '../../model'
import type { RunOutputIntent } from '../../runtime/v07UiContracts'
import type { ComposerResultPolicy } from '../canvas/SelectionComposer'

interface Props {
  nodes: CanvasNode[]
  selectedIds: string[]
  prompt: string
  intent: RunOutputIntent
  provider: string
  resultPolicy: ComposerResultPolicy
  providers: readonly RuntimeProviderStatus[]
  busy: boolean
  onPrompt: (value: string) => void
  onIntent: (value: RunOutputIntent) => void
  onProvider: (value: string) => void
  onResult: (value: ComposerResultPolicy) => void
  onSend: () => void
}

const intentLabels: Record<RunOutputIntent, string> = { analyze: '分析', create: '创建', revise: '修改' }
const resultLabels: Record<ComposerResultPolicy, string> = { reply_only: '回复', create_artifact: '新内容', create_collection: '新集合', draft_revision_per_target: '新 Draft' }

export function SurfaceComposerBar({ nodes, selectedIds, prompt, intent, provider, resultPolicy, providers, busy, onPrompt, onIntent, onProvider, onResult, onSend }: Props) {
  const selected = selectedIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  if (!selected.length) return null
  const editable = selected.some((node) => node.managed && node.artifactId && node.revisionId)
  const intents: RunOutputIntent[] = editable ? ['analyze', 'create', 'revise'] : ['analyze', 'create']
  const results: ComposerResultPolicy[] = intent === 'analyze' ? ['reply_only', 'create_artifact'] : intent === 'create' ? ['create_artifact', 'create_collection'] : ['draft_revision_per_target']
  const disabled = busy || !prompt.trim()
  return <section className="vnext-surface-composer" data-testid="surface-composer">
    <div className="vnext-surface-composer-context"><Layers3 size={12} /><span>{selected.length === 1 ? selected[0].title : `严格使用已选 ${selected.length} 项`}</span></div>
    <textarea value={prompt} onChange={(event) => onPrompt(event.target.value)} placeholder="直接告诉 Agent 这一批内容要怎么处理…" onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !disabled) { event.preventDefault(); onSend() } }} />
    <div className="vnext-surface-composer-controls">
      <label><select value={intent} onChange={(event) => onIntent(event.target.value as RunOutputIntent)}>{intents.map((value) => <option value={value} key={value}>{intentLabels[value]}</option>)}</select><ChevronDown size={10} /></label>
      <label><select value={provider} onChange={(event) => onProvider(event.target.value)}><option value="auto">Auto</option>{providers.filter((item) => item.provider !== 'auto').map((item) => <option key={item.provider} value={item.provider} disabled={item.availability === 'offline'}>{item.provider === 'workbuddy' ? 'WorkBuddy' : item.provider === 'codex' ? 'Codex' : item.provider}</option>)}</select><ChevronDown size={10} /></label>
      <label><select value={resultPolicy} onChange={(event) => onResult(event.target.value as ComposerResultPolicy)}>{results.map((value) => <option value={value} key={value}>{resultLabels[value]}</option>)}</select><ChevronDown size={10} /></label>
      <button type="button" className="vnext-surface-send" disabled={disabled} onClick={onSend} aria-label="开始 Run"><ArrowUp size={15} /></button>
    </div>
  </section>
}
