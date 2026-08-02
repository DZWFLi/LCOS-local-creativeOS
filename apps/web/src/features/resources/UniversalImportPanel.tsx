import { FileUp, FolderOpen, Link2, Package, X } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'

const MAX_SINGLE_BYTES = 10 * 1024 * 1024
const MAX_TOTAL_BYTES = 50 * 1024 * 1024
const MAX_FILES = 200

export interface DirectoryEntryInput {
  readonly path: string
  readonly file: File
}

export function UniversalImportPanel({ open, onClose, onFiles, onDirectory, onArchive, onOpenLink }: {
  open: boolean
  onClose: () => void
  onFiles: (files: readonly File[]) => void
  onDirectory: (rootName: string, files: readonly DirectoryEntryInput[], note?: string) => void
  onArchive: (file: File, note?: string) => void
  onOpenLink: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const directoryInputRef = useRef<HTMLInputElement | null>(null)
  const archiveInputRef = useRef<HTMLInputElement | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!open) return null

  const run = async (task: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入失败')
    } finally {
      setBusy(false)
    }
  }

  const pickFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (files.length === 0) return
    void run(async () => {
      onFiles(files)
      onClose()
    })
  }

  const pickArchive = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) return
    void run(async () => {
      onArchive(file, note.trim() === '' ? undefined : note.trim())
      onClose()
    })
  }

  const pickDirectory = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (files.length === 0) return
    void run(async () => {
      if (files.length > MAX_FILES) throw new Error(`目录文件数超过 ${MAX_FILES} 上限`)
      const entries: DirectoryEntryInput[] = []
      let total = 0
      for (const file of files) {
        const path = file.webkitRelativePath || file.name
        if (file.size > MAX_SINGLE_BYTES) throw new Error(`单文件超过 10MB：${path}`)
        total += file.size
        if (total > MAX_TOTAL_BYTES) throw new Error('目录总大小超过 50MB')
        entries.push({ path, file })
      }
      const rootName = files[0]?.webkitRelativePath.split('/')[0] ?? 'imported-folder'
      onDirectory(rootName, entries, note.trim() === '' ? undefined : note.trim())
      onClose()
    })
  }

  return <div className="modal-backdrop"><section className="universal-import-panel" role="dialog" aria-label="通用资源导入" data-testid="universal-import-panel">
    <header><div><FileUp size={18} /><h2>导入资源</h2></div><button type="button" className="icon-button pressable" aria-label="关闭" onClick={onClose}><X size={16} /></button></header>
    <p className="import-hint">拖入、选择或粘贴链接即可；不需要填写用途与分类，系统会尝试理解。</p>
    <div className="import-source-grid">
      <button className="import-source pressable" type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>
        <FileUp size={20} /><b>文件</b><small>MD / TXT / JSON / YAML / 图片</small>
      </button>
      <button className="import-source pressable" type="button" disabled={busy} onClick={() => directoryInputRef.current?.click()}>
        <FolderOpen size={20} /><b>文件夹</b><small>Skill 包 / 素材目录（一个节点）</small>
      </button>
      <button className="import-source pressable" type="button" disabled={busy} onClick={() => archiveInputRef.current?.click()}>
        <Package size={20} /><b>压缩包</b><small>ZIP，自动解包校验</small>
      </button>
      <button className="import-source pressable" type="button" disabled={busy} onClick={() => { onOpenLink(); onClose() }}>
        <Link2 size={20} /><b>链接</b><small>网页 / 飞书文档</small>
      </button>
    </div>
    <label className="import-note">备注 <small>可选</small>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="补充一句即可" />
    </label>
    {error && <p className="import-error" role="alert">{error}</p>}
    <input ref={fileInputRef} type="file" multiple hidden data-testid="import-file-input" onChange={pickFiles} />
    <input ref={directoryInputRef} type="file" multiple hidden data-testid="import-directory-input" {...{ webkitdirectory: '' }} onChange={(event) => { void pickDirectory(event) }} />
    <input ref={archiveInputRef} type="file" accept=".zip" hidden data-testid="import-archive-input" onChange={pickArchive} />
  </section></div>
}
