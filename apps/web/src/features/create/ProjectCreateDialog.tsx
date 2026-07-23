import { useEffect, useRef, useState } from 'react'
import { FolderOpen, X } from 'lucide-react'

interface Props {
  open: boolean
  onCancel: () => void
  onCreate: (value: { label: string; localPath: string }) => void
}

export function ProjectCreateDialog({ open, onCancel, onCreate }: Props) {
  const [label, setLabel] = useState('')
  const [localPath, setLocalPath] = useState('C:/Creative/Projects/')
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (!open) return
    setLabel('')
    setLocalPath('C:/Creative/Projects/')
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])
  if (!open) return null
  const submit = () => {
    const name = label.trim()
    if (!name) return
    const base = localPath.trim().replace(/[\\/]+$/, '')
    onCreate({ label: name, localPath: `${base}/${name.replace(/\s+/g, '-')}` })
  }
  return <div className="project-create-layer" role="presentation">
    <section className="project-create-dialog" role="dialog" aria-modal="true" aria-labelledby="project-create-title">
      <header><div><span>新建项目包</span><h2 id="project-create-title">建立一个本地项目现场</h2></div><button aria-label="关闭" onClick={onCancel}><X size={17} /></button></header>
      <div className="project-create-body"><label><span>项目名称</span><input ref={inputRef} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例如：PortaSplit 夏季传播" /></label><label><span>本地目录</span><div className="path-input"><FolderOpen size={16} /><input value={localPath} onChange={(event) => setLocalPath(event.target.value)} /></div></label><p>当前为前端 Fixture。接入 Local Core 后，这里会调用系统目录选择器，不会上传文件。</p></div>
      <footer><button className="secondary" onClick={onCancel}>取消</button><button className="primary" disabled={!label.trim()} onClick={submit}>创建项目</button></footer>
    </section>
  </div>
}
