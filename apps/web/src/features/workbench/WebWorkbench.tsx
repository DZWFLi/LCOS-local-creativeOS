import { ExternalLink, FileText, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { AgentSurfaceComposer } from '../surfaces/AgentSurfaceComposer'

const defaultRoutines = ['今日工作页', '客户反馈', '素材与参考']
const tools = ['页面总结', '两页比较', '临时待办', '文案版本对比']

/** Lightweight in-surface workbench. It keeps browser ownership external and
 * only provides the routine/notes/tool handoff surface promised by Stage 3. */
export function WebWorkbench() {
  const [activeRoutine, setActiveRoutine] = useState(defaultRoutines[0])
  const [note, setNote] = useState('')
  return <div className="lcos-web-workbench" data-testid="web-workbench">
    <header><div><strong>网页工作台</strong><small>固定页面、临时笔记和 Agent 工具</small></div><button type="button" aria-label="新建网页例程"><Plus size={14}/></button></header>
    <nav aria-label="网页例程">{defaultRoutines.map((routine) => <button type="button" key={routine} className={routine === activeRoutine ? 'active' : ''} onClick={() => setActiveRoutine(routine)}>{routine}</button>)}</nav>
    <section className="lcos-web-workbench-pages"><div className="lcos-web-workbench-page"><span>当前例程</span><strong>{activeRoutine}</strong><small>3 个页面 · 外部浏览器打开</small></div><button type="button" className="lcos-web-workbench-open"><ExternalLink size={13}/>恢复页面</button></section>
    <label className="lcos-web-workbench-note"><span><FileText size={13}/>Quick Note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="记下一条临时判断；明确保留后再成为项目 Note…" rows={3}/></label>
    <section className="lcos-web-workbench-tools"><header><span><Sparkles size={13}/>Agent Tool slots</span><small>固定预置 · 不自动执行</small></header><div>{tools.map((tool) => <button type="button" key={tool}>{tool}</button>)}</div></section>
    <AgentSurfaceComposer targetIds={[]} />
  </div>
}
