import { Link2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { LinkReferenceInput } from '../../runtime/v07UiContracts'

export function LinkReferenceDialog({ open, onClose, onCreate }: {
  open: boolean
  onClose: () => void
  onCreate: (input: LinkReferenceInput) => void
}) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [purpose, setPurpose] = useState('')
  if (!open) return null
  const valid = /^https?:\/\/\S+$/i.test(url.trim()) && title.trim().length > 0
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!valid) return
    onCreate({ url: url.trim(), title: title.trim(), description: description.trim(), purpose: purpose.trim() })
    setUrl(''); setTitle(''); setDescription(''); setPurpose('')
  }
  return <div className="modal-backdrop"><form className="link-reference-dialog" onSubmit={submit}>
    <header><div><Link2 size={18} /><h2>添加 Link Reference</h2></div><button type="button" onClick={onClose}><X size={16} /></button></header>
    <label>链接<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" autoFocus /></label>
    <label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="这份资料是什么" /></label>
    <label>内容说明<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="链接里主要有什么" /></label>
    <label>在项目中的用途<textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="希望本地 Agent 如何使用它" /></label>
    <p>只登记链接与用途，不抓取网页、不读取 Cookie。Agent 必须如实报告是否能够访问。</p>
    <footer><button type="button" onClick={onClose}>取消</button><button type="submit" className="primary" disabled={!valid}>加入项目</button></footer>
  </form></div>
}
