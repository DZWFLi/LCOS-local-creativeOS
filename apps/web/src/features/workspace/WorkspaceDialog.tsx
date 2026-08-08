import { useEffect, useId, useState } from 'react'
import { X } from 'lucide-react'
import type { Camera, Workspace } from '../../model'

interface Props {
  mode: 'create' | 'edit'
  workspace?: Workspace
  currentCamera: Camera
  onCancel: () => void
  onSave: (input: { label: string }) => void
}

/** Workspace is a user/Agent-defined spatial view. No product-level intent taxonomy. */
export function WorkspaceDialog({ mode, workspace, currentCamera: _currentCamera, onCancel, onSave }: Props) {
  const titleId = useId()
  const [label, setLabel] = useState(workspace?.label ?? '')
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

  return <div className="editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
    <form className="entity-editor lcos-workspace-editor" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit}>
      <header>
        <div><span>工作空间</span><h2 id={titleId}>{mode === 'create' ? '新建工作空间' : '重命名工作空间'}</h2></div>
        <button type="button" aria-label="关闭" onClick={onCancel}><X size={16} /></button>
      </header>
      <label className="editor-field">名称<input autoFocus value={label} maxLength={48} placeholder="例如：冰箱篇 / 本周反馈 / Prompt 实验" onChange={(event) => setLabel(event.target.value)} /></label>
      <p className="editor-help">Workspace 只保存你或 Agent 组织出来的空间范围、成员与视图偏好。LCOS 不替项目定义“理解 / 探索 / 构建 / 决策”等业务阶段。</p>
      <footer><button type="button" className="secondary-action" onClick={onCancel}>取消</button><button type="submit" className="primary-action" disabled={!trimmed}>{mode === 'create' ? '创建工作空间' : '保存名称'}</button></footer>
    </form>
  </div>
}
