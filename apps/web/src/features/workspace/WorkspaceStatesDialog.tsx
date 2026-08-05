import { useState } from 'react'
import { Clock3, History, LoaderCircle, RotateCcw, Save, X } from 'lucide-react'
import type { Workspace } from '../../model'
import type { WorkspaceStateSummary } from '../../runtime/projectionAdapters'

interface Props {
  workspace: Workspace
  states: readonly WorkspaceStateSummary[]
  loading: boolean
  saving: boolean
  restoringId: string | null
  error?: string
  onClose: () => void
  onRefresh: () => void
  onSave: (name?: string) => void
  onRestore: (stateId: string) => void
}

function formatTime(value?: string): string {
  if (!value) return '时间未记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function WorkspaceStatesDialog(props: Props) {
  const [name, setName] = useState('')
  return <div className="workspace-states-backdrop" role="presentation" onPointerDown={props.onClose}>
    <section className="workspace-states-dialog" role="dialog" aria-modal="true" aria-label={`${props.workspace.label} 工作现场`} onPointerDown={(event) => event.stopPropagation()}>
      <header>
        <div><small>WORKSPACE HISTORY</small><h2>{props.workspace.label}</h2><p>成员、版本组合、视口和关联 Run 的阶段现场。</p></div>
        <button type="button" className="icon-button pressable" aria-label="关闭工作现场" onClick={props.onClose}><X size={15} /></button>
      </header>
      <div className="workspace-states-actions">
        <label className="workspace-state-name"><span>现场名称</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={`${props.workspace.label} · 阶段记录`} /></label>
        <button type="button" className="pressable primary" disabled={props.saving} onClick={() => { props.onSave(name.trim() || undefined); setName('') }}>{props.saving ? <LoaderCircle className="spin" size={13} /> : <Save size={13} />}保存当前工作现场</button>
        <button type="button" className="pressable" disabled={props.loading} onClick={props.onRefresh}><History size={13} />刷新历史</button>
      </div>
      {props.error && <div className="workspace-states-error">{props.error}</div>}
      <main>
        {props.loading && <div className="workspace-states-empty"><LoaderCircle className="spin" size={17} />正在读取工作现场…</div>}
        {!props.loading && !props.states.length && <div className="workspace-states-empty"><History size={18} /><strong>还没有保存的工作现场</strong><span>保存后可以恢复当时的 Workspace 成员和版本组合。</span></div>}
        {!props.loading && props.states.length > 0 && <ol>
          {props.states.map((state, index) => <li key={state.id}>
            <span className="workspace-state-index">{String(props.states.length - index).padStart(2, '0')}</span>
            <article>
              <header><strong>{state.name}</strong><time><Clock3 size={11} />{formatTime(state.createdAt)}</time></header>
              <p>{state.memberCount === undefined ? '成员数量由后端现场记录保存' : `${state.memberCount} 个成员`}{state.revisionCount === undefined ? '' : ` · ${state.revisionCount} 个 Revision`}{state.runId ? ` · ${state.runId}` : ''}</p>
            </article>
            <button type="button" className="pressable" disabled={props.restoringId !== null} onClick={() => props.onRestore(state.id)}>{props.restoringId === state.id ? <LoaderCircle className="spin" size={12} /> : <RotateCcw size={12} />}恢复</button>
          </li>)}
        </ol>}
      </main>
      <footer>恢复工作现场不会删除后续版本，只切换当前 Workspace 的历史组合。</footer>
    </section>
  </div>
}
