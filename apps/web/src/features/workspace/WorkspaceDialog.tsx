import { useEffect, useId, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { Camera, Workspace, WorkspaceIntent } from '../../model'
import { workspaceIntentOptions } from '../../model'

interface Props {
  mode: 'create' | 'edit'
  workspace?: Workspace
  currentCamera: Camera
  onCancel: () => void
  onSave: (input: { label: string; intent: WorkspaceIntent }) => void
}

export function WorkspaceDialog({ mode, workspace, currentCamera: _currentCamera, onCancel, onSave }: Props) {
  const titleId = useId()
  const [label, setLabel] = useState(workspace?.label ?? '')
  const [intent, setIntent] = useState<WorkspaceIntent>(workspace?.intent ?? null)
  const trimmed = label.trim()

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!trimmed) return
    onSave({ label: trimmed, intent })
  }

  return <div className="editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
    <form className="entity-editor" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit}>
      <header>
        <div><span>工作视角</span><h2 id={titleId}>{mode === 'create' ? '新建工作视角' : '编辑工作视角'}</h2></div>
        <button type="button" aria-label="关闭" onClick={onCancel}><X size={16} /></button>
      </header>
      <label className="editor-field">名称<input autoFocus value={label} maxLength={48} placeholder="例如：Thinker 创意探索" onChange={(event) => setLabel(event.target.value)} /></label>
      <fieldset className="intent-picker"><legend>工作意图 <small>可选，可随时修改</small></legend>{workspaceIntentOptions.map((option) => <button type="button" key={option.label} className={intent === option.value ? 'intent-option active' : 'intent-option'} onClick={() => setIntent(option.value)}><span className={`intent-swatch intent-${option.value ?? 'blank'}`} /> <b>{option.label}</b><small>{option.description}</small>{intent === option.value && <Check size={14} />}</button>)}</fieldset>
      <p className="editor-help">意图只影响环境光、技能推荐、默认上下文策略与自动排布建议，不限制节点和工作内容。</p>
      <footer><button type="button" className="secondary-action" onClick={onCancel}>取消</button><button type="submit" className="primary-action" disabled={!trimmed}>{mode === 'create' ? '创建工作视角' : '保存修改'}</button></footer>
    </form>
  </div>
}
