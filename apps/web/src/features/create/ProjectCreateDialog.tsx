import { useEffect, useRef, useState } from 'react'
import { FolderOpen, X } from 'lucide-react'
import { dismissFromBackdrop } from '../ui/dismissibleLayer'

interface Inspection { fileCount: number; directoryCount: number; totalBytes: number; skipped: readonly string[]; requiresConfirmation: boolean }
interface Props {
  open: boolean
  initialIntent?: 'create' | 'open'
  onCancel: () => void
  onBrowseDirectory: (title: string) => Promise<string | undefined>
  onInspectDirectory: (rootPath: string) => Promise<Inspection>
  onCreate: (value: { label: string; intent: 'create'; parentPath: string; directoryName: string } | { label: string; intent: 'open'; rootPath: string; importExisting?: boolean }) => void
}

export function ProjectCreateDialog({ open, initialIntent = 'create', onCancel, onBrowseDirectory, onInspectDirectory, onCreate }: Props) {
  const [label, setLabel] = useState('')
  const [localPath, setLocalPath] = useState('')
  const [intent, setIntent] = useState<'create' | 'open'>('create')
  const [browsing, setBrowsing] = useState(false)
  const [browseError, setBrowseError] = useState('')
  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [importExisting, setImportExisting] = useState(false)
  const [inspecting, setInspecting] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (!open) return
    setLabel(''); setLocalPath(''); setIntent(initialIntent); setBrowseError(''); setInspection(null); setImportExisting(false)
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [initialIntent, open])
  if (!open) return null
  const submit = async () => {
    const name = label.trim()
    const path = localPath.trim().replace(/[\\/]+$/, '')
    if (!name || !path) return
    if (intent === 'open' && inspection === null) {
      setInspecting(true); setBrowseError('')
      try {
        const nextInspection = await onInspectDirectory(path)
        setInspection(nextInspection)
        setImportExisting(nextInspection.requiresConfirmation)
      } catch (error) {
        setBrowseError(error instanceof Error ? error.message : '无法检查文件夹')
      } finally { setInspecting(false) }
      return
    }
    onCreate(intent === 'create'
      ? { label: name, intent, parentPath: path, directoryName: name.replace(/\s+/g, '-') }
      : { label: name, intent, rootPath: path, importExisting })
  }
  const browse = async () => {
    setBrowsing(true); setBrowseError('')
    try {
      const selectedPath = await onBrowseDirectory(intent === 'create' ? '选择新项目的父目录' : '选择已有项目目录')
      if (!selectedPath) return
      setLocalPath(selectedPath); setInspection(null); setImportExisting(false)
      if (intent === 'open') {
        if (!label.trim()) {
          const folderName = selectedPath.split(/[\\/]/).filter(Boolean).pop()
          if (folderName) setLabel(folderName)
        }
        const nextInspection = await onInspectDirectory(selectedPath)
        setInspection(nextInspection)
        setImportExisting(nextInspection.requiresConfirmation)
      }
    } catch (error) {
      setBrowseError(error instanceof Error ? error.message : '无法打开或检查文件夹')
    } finally { setBrowsing(false) }
  }
  return <div className="project-create-layer" role="presentation" onPointerDown={(event) => dismissFromBackdrop(event, onCancel, browsing || inspecting)}>
    <section className="project-create-dialog" role="dialog" aria-modal="true" aria-labelledby="project-create-title">
      <header><div><span>{intent === 'open' ? '打开项目' : '新建项目'}</span><h2 id="project-create-title">{intent === 'open' ? '选择已有创作文件夹' : '创建一个新的项目文件夹'}</h2></div><button aria-label="关闭" onClick={onCancel}><X size={17} /></button></header>
      <div className="project-create-body">
        <div className="project-intent-switch"><button type="button" className={intent === 'create' ? 'active' : ''} onClick={() => { setIntent('create'); setInspection(null); setImportExisting(false) }}>创建新目录</button><button type="button" className={intent === 'open' ? 'active' : ''} onClick={() => setIntent('open')}>打开已有目录</button></div>
        <label><span>项目名称</span><input ref={inputRef} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例如：PortaSplit 夏季传播" /></label>
        <label><span>{intent === 'create' ? '父目录' : '已有项目目录'}</span><div className="path-input"><FolderOpen size={16} /><input value={localPath} onChange={(event) => { setLocalPath(event.target.value); setInspection(null); setImportExisting(false) }} placeholder="点击右侧按钮选择文件夹" /><button type="button" disabled={browsing} onClick={() => { void browse() }}>{browsing ? '检查中…' : '浏览…'}</button></div></label>
        {browseError && <p className="project-create-error" role="alert">{browseError}</p>}
        {inspection?.requiresConfirmation && <label className="project-root-import-confirm"><input type="checkbox" checked={importExisting} onChange={(event) => setImportExisting(event.target.checked)} /><span><b>导入文件并建立 Canvas 节点（推荐）</b><small>已发现 {inspection.fileCount} 个文件 · {inspection.directoryCount} 个子文件夹 · {(inspection.totalBytes / 1024 / 1024).toFixed(1)} MB{inspection.skipped.length ? ` · ${inspection.skipped.length} 项将跳过` : ''}。取消勾选将只登记空画布。</small></span></label>}
        <p>{intent === 'create' ? `项目文件夹将在父目录下创建：${label.trim().replace(/\s+/g, '-') || '<项目名>'}` : '系统只会读取并登记所选目录；不会移动或改写其中的文件。'}</p>
      </div>
      <footer><button className="secondary" onClick={onCancel}>取消</button><button className="primary" disabled={!label.trim() || !localPath.trim() || browsing || inspecting} onClick={() => { void submit() }}>{inspecting ? '扫描中…' : intent === 'create' ? '创建项目' : inspection === null ? '扫描并确认' : '打开项目'}</button></footer>
    </section>
  </div>
}
