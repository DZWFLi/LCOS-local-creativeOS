import { Link2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { LinkReferenceInput } from '../../runtime/v07UiContracts'
import { dismissFromBackdrop } from '../ui/dismissibleLayer'

export function LinkReferenceDialog({ open, onClose, onCreate }: {
  open: boolean
  onClose: () => void
  onCreate: (input: LinkReferenceInput) => void
}) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  if (!open) return null
  const valid = /^https?:\/\/\S+$/i.test(url.trim())
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!valid) return
    onCreate({
      url: url.trim(),
      ...(title.trim() === '' ? {} : { title: title.trim() }),
      ...(note.trim() === '' ? {} : { note: note.trim() }),
    })
    setUrl(''); setTitle(''); setNote('')
  }
  return <div className="modal-backdrop" onPointerDown={(event) => dismissFromBackdrop(event, onClose)}><form className="link-reference-dialog" onSubmit={submit}>
    <header><div><Link2 size={18} /><h2>添加 Link Reference</h2></div><button type="button" className="dialog-close-action" onClick={onClose}><X size={16} /><span>关闭</span></button></header>
    <label>链接<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" autoFocus /></label>
    <label>标题 <small>可选，留空自动识别</small><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="这份资料是什么" /></label>
    <label>备注 <small>可选</small><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="补充一句即可，不用写用途说明" /></label>
    <p>只登记链接，不抓取网页、不读取 Cookie。Agent 必须如实报告是否能够访问。</p>
    <footer><button type="button" onClick={onClose}>取消</button><button type="submit" className="primary" disabled={!valid}>加入项目</button></footer>
  </form></div>
}
