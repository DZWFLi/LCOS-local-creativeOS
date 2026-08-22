import { Check, Sparkles, WandSparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { SurfaceIntent } from '../spatial/model/surfaceIntent'

const choices: readonly { kind: SurfaceIntent['kind']; label: string; hint: string }[] = [
  { kind: 'prepare-agent-tool', label: '准备 Agent 工具', hint: '只生成受控工具宿主' },
  { kind: 'place-quick-note-near-page', label: '放一条 Quick Note', hint: '临时笔记，不自动写入项目' },
  { kind: 'collapse-inactive-pages', label: '收起不活跃页面', hint: '只改变当前 Presentation' },
]

export function AgentSurfaceComposer({ targetIds, onPreview, onApply }: { targetIds: readonly string[]; onPreview?: (intent: SurfaceIntent) => void; onApply?: (intent: SurfaceIntent) => void }) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState<SurfaceIntent['kind']>('prepare-agent-tool')
  const intent = useMemo<SurfaceIntent>(() => ({ kind, targetIds, ...(kind === 'prepare-agent-tool' ? { toolKind: text.trim() || 'summary' } : {}) } as SurfaceIntent), [kind, targetIds, text])
  return <section className="lcos-agent-surface-composer" data-testid="agent-surface-composer"><header><span><WandSparkles size={13}/>Agent 组织当前现场</span><small>先预览，再保留</small></header><div className="lcos-agent-surface-composer-row"><select value={kind} onChange={(event) => setKind(event.target.value as SurfaceIntent['kind'])}>{choices.map((choice) => <option key={choice.kind} value={choice.kind}>{choice.label}</option>)}</select><input value={text} onChange={(event) => setText(event.target.value)} placeholder="可选：工具名或补充说明"/><button type="button" onClick={() => onPreview?.(intent)}><Sparkles size={12}/>预览</button><button type="button" className="primary" onClick={() => onApply?.(intent)}><Check size={12}/>保留</button></div><small>{choices.find((choice) => choice.kind === kind)?.hint} · {targetIds.length} 个当前对象</small></section>
}
