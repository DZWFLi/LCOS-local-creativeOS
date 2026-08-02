import { useEffect, useRef, useState } from 'react'
import { FolderOpen, X } from 'lucide-react'

interface Props {
  open: boolean
  onCancel: () => void
  onCreate: (value: { label: string; intent: 'create'; parentPath: string; directoryName: string } | { label: string; intent: 'open'; rootPath: string }) => void
}

export function ProjectCreateDialog({ open, onCancel, onCreate }: Props) {
  const [label, setLabel] = useState('')
  const [localPath, setLocalPath] = useState('')
  const [intent, setIntent] = useState<'create' | 'open'>('create')
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (!open) return
    setLabel('')
    setLocalPath('')
    setIntent('create')
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])
  if (!open) return null
  const submit = () => {
    const name = label.trim()
    if (!name) return
    const path = localPath.trim().replace(/[\\/]+$/, '')
    if (!path) return
    onCreate(intent === 'create'
      ? { label: name, intent, parentPath: path, directoryName: name.replace(/\s+/g, '-') }
      : { label: name, intent, rootPath: path })
  }
  return <div className="project-create-layer" role="presentation">
    <section className="project-create-dialog" role="dialog" aria-modal="true" aria-labelledby="project-create-title">
      <header><div><span>新建项目包</span><h2 id="project-create-title">建立一个本地项目现场</h2></div><button aria-label="关闭" onClick={onCancel}><X size={17} /></button></header>
      <div className="project-create-body"><div className="project-intent-switch"><button type="button" className={intent === 'create' ? 'active' : ''} onClick={() => setIntent('create')}>创建新目录</button><button type="button" className={intent === 'open' ? 'active' : ''} onClick={() => setIntent('open')}>打开已有目录</button></div><label><span>项目名称</span><input ref={inputRef} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例如：PortaSplit 夏季传播" /></label><label><span>{intent === 'create' ? '父目录' : '已有项目目录'}</span><div className="path-input"><FolderOpen size={16} /><input value={localPath} onChange={(event) => setLocalPath(event.target.value)} /></div></label><p>{intent === 'create' ? `Local Core 将在父目录下创建：${label.trim().replace(/\s+/g, '-') || '<项目名>'}` : 'Local Core 只登记并读取已有目录，不会移动其中的文件。'}</p></div>
      <footer><button className="secondary" onClick={onCancel}>取消</button><button className="primary" disabled={!label.trim() || !localPath.trim()} onClick={submit}>{intent === 'create' ? '创建项目' : '打开项目'}</button></footer>
    </section>
  </div>
}
