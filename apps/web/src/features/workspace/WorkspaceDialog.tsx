import { useEffect, useId, useState } from 'react'
import { X } from 'lucide-react'
import type { Workspace } from '../../model'
import { dismissFromBackdrop } from '../ui/dismissibleLayer'

interface Props {
  workspace: Workspace
  onCancel: () => void
  onSave: (input: { label: string }) => void
}

/** Workspace is a durable saved working scene, not a renamed Collection. */
export function WorkspaceDialog({ workspace, onCancel, onSave }: Props) {
  const titleId = useId()
  const [label, setLabel] = useState(workspace.label)
  const trimmed = label.trim()

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!trimmed) return
    onSave({ label: trimmed })
  }

  return <div className="editor-backdrop" role="presentation" onPointerDown={(event) => dismissFromBackdrop(event, onCancel)}>
    <form className="entity-editor lcos-workspace-editor" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit}>
      <header>
        <div><span>工作空间 / Current Scene</span><h2 id={titleId}>重命名工作空间</h2></div>
        <button type="button" aria-label="关闭" onClick={onCancel}><X size={16} /></button>
      </header>
      <label className="editor-field">名称<input autoFocus value={label} maxLength={48} placeholder="例如：供应商 Brief / 本轮脚本 / Prompt 实验" onChange={(event) => setLabel(event.target.value)} /></label>

      <p className="editor-help">Workspace 保存的是工作现场：成员、Camera 与当前 Surface。Collection 只负责同一画布上的持久分组，两者不再共享 child-canvas 语义。</p>
      <footer><button type="button" className="secondary-action" onClick={onCancel}>取消</button><button type="submit" className="primary-action" disabled={!trimmed}>保存名称</button></footer>
    </form>
  </div>
}
