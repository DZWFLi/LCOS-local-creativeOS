import { ArrowUp, ChevronDown, Layers3 } from 'lucide-react'
import type { RuntimeProviderStatus } from '@local-creative-os/contracts'
import type { CanvasNode } from '../../model'
import type { RunOutputIntent } from '../../runtime/v07UiContracts'
import type { ComposerResultPolicy } from '../canvas/SelectionComposer'

interface Props {
  nodes: CanvasNode[]; selectedIds: string[]; prompt: string; intent: RunOutputIntent; provider: string; resultPolicy: ComposerResultPolicy; providers: readonly RuntimeProviderStatus[]; busy: boolean
  onPrompt: (value: string) => void; onIntent: (value: RunOutputIntent) => void; onProvider: (value: string) => void; onResult: (value: ComposerResultPolicy) => void; onSend: () => void
}
const intentLabels: Record<RunOutputIntent,string>={analyze:'分析',create:'创建',revise:'修改'}
const resultLabels: Record<ComposerResultPolicy,string>={reply_only:'回复',create_artifact:'新 Artifact',create_collection:'Collection',draft_revision_per_target:'新 Draft'}

export function SurfaceComposerBar({nodes,selectedIds,prompt,intent,provider,resultPolicy,providers,busy,onPrompt,onIntent,onProvider,onResult,onSend}:Props){
  const selected=selectedIds.map((id)=>nodes.find((node)=>node.id===id)).filter((node):node is CanvasNode=>Boolean(node)); if(!selected.length)return null
  const editable=selected.some((node)=>node.managed&&node.artifactId&&node.revisionId)
  const intents:RunOutputIntent[]=editable?['analyze','create','revise']:['analyze','create']
  const results:ComposerResultPolicy[]=intent==='analyze'?['reply_only']:intent==='create'?['create_artifact','create_collection']:['draft_revision_per_target']
  const automatic=providers.filter((item)=>item.provider!=='auto'&&item.executionMode==='automatic'&&item.availability!=='offline')
  const disabled=busy||!prompt.trim()
  return <section className="vnext-surface-composer lcos-surface-composer" data-testid="surface-composer">
    <div className="lcos-surface-composer-main"><Layers3 size={12}/><textarea value={prompt} onChange={(event)=>onPrompt(event.target.value)} placeholder={selected.length===1?`对「${selected[0].title}」继续…`:`严格使用已选 ${selected.length} 项…`} onKeyDown={(event)=>{if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&!disabled){event.preventDefault();onSend()}}}/><button type="button" className="vnext-surface-send" disabled={disabled} onClick={onSend} aria-label="开始 Run"><ArrowUp size={15}/></button></div>
    <div className="vnext-surface-composer-controls lcos-surface-composer-controls">
      <label title="操作"><select value={intent} onChange={(event)=>onIntent(event.target.value as RunOutputIntent)}>{intents.map((value)=><option value={value} key={value}>{intentLabels[value]}</option>)}</select><ChevronDown size={10}/></label>
      <label title="Agent"><select value={provider} onChange={(event)=>onProvider(event.target.value)}><option value="auto">Auto</option>{automatic.map((item)=><option key={item.provider} value={item.provider}>{item.provider==='workbuddy'?'WorkBuddy':item.provider==='codex'?'Codex':item.provider}</option>)}</select><ChevronDown size={10}/></label>
      <label title="结果"><select value={results.includes(resultPolicy)?resultPolicy:results[0]} onChange={(event)=>onResult(event.target.value as ComposerResultPolicy)}>{results.map((value)=><option value={value} key={value}>{resultLabels[value]}</option>)}</select><ChevronDown size={10}/></label>
      <span className="lcos-surface-context-count">{selected.length}</span>
    </div>
  </section>
}
