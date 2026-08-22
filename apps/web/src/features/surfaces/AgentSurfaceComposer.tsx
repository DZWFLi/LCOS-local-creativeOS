import { Check, RotateCcw, Sparkles, WandSparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { SurfaceKind } from '../spatial/model/surfaceElementTypes'
import type { SurfaceIntent } from '../spatial/model/surfaceIntent'

const choices: Readonly<Record<'main' | 'context' | 'workflow', readonly { kind: SurfaceIntent['kind']; label: string; hint: string }[]>> = {
  main: [
    { kind: 'organize', label: '整理成项目区域', hint: '只提出当前主画布的 Presentation 区域' },
    { kind: 'prepare-workbench', label: '准备工作台', hint: '把当前真实对象绑定到一个可移动工作台' },
  ],
  context: [
    { kind: 'organize', label: '整理成语境区', hint: '只生成当前 Presentation 边界' },
    { kind: 'show-structure', label: '拉出结构', hint: '读取当前材料的真实层级' },
    { kind: 'show-evolution', label: '拉出演进', hint: '只显示可追溯的变化记录' },
  ],
  workflow: [
    { kind: 'organize', label: '整理当前工况', hint: '建立轻量区域，不把材料改成 Step' },
  ],
}

export function AgentSurfaceComposer({ surface, targetIds, previewing = false, onPreview, onKeep, onRevert }: {
  readonly surface: Extract<SurfaceKind, 'main' | 'context' | 'workflow'>
  readonly targetIds: readonly string[]
  readonly previewing?: boolean
  readonly onPreview: (intent: SurfaceIntent) => void
  readonly onKeep: () => void
  readonly onRevert: () => void
}) {
  const [open, setOpen] = useState(false)
  const available = choices[surface]
  const [kind, setKind] = useState<SurfaceIntent['kind']>(available[0].kind)
  const intent = useMemo<SurfaceIntent>(() => ({ kind, targetIds } as SurfaceIntent), [kind, targetIds])
  const disabled = targetIds.length === 0

  return <div className={`lcos-agent-surface-composer-shell ${open ? 'is-open' : ''}`}>
    <button type="button" className="lcos-agent-surface-composer-toggle" aria-expanded={open} aria-label="Agent 组织当前现场" title="Agent 组织当前现场" onClick={() => setOpen((current) => !current)}><WandSparkles size={15}/></button>
    {open && <section className="lcos-agent-surface-composer" data-testid="agent-surface-composer">
      <header><span><Sparkles size={13}/>Agent 组织</span><button type="button" aria-label="关闭" onClick={() => setOpen(false)}><X size={13}/></button></header>
      <select value={kind} onChange={(event) => { setKind(event.target.value as SurfaceIntent['kind']); if (previewing) onRevert() }}>{available.map((choice) => <option key={choice.kind} value={choice.kind}>{choice.label}</option>)}</select>
      <small>{available.find((choice) => choice.kind === kind)?.hint}</small>
      <footer><span>{targetIds.length ? `${targetIds.length} 个当前对象` : '先选择要组织的对象'}</span><div>
        {previewing ? <><button type="button" onClick={onRevert}><RotateCcw size={12}/>撤掉</button><button type="button" className="primary" onClick={onKeep}><Check size={12}/>保留</button></> : <button type="button" className="primary" disabled={disabled} onClick={() => onPreview(intent)}><Sparkles size={12}/>预览</button>}
      </div></footer>
    </section>}
  </div>
}
