import { CircleAlert, X } from 'lucide-react'
import { dismissFromBackdrop } from './dismissibleLayer'

interface Props {
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, description, onConfirm, onCancel }: Props) {
  return <div data-testid="confirm-dialog" className="confirm-backdrop" role="presentation" onPointerDown={(event) => dismissFromBackdrop(event, onCancel)}>
    <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <header><CircleAlert size={18} /><div><span>Confirm</span><h2 id="confirm-title">{title}</h2></div><button aria-label="关闭确认" title="取消" onClick={onCancel}><X size={15} /></button></header>
      <p>{description}</p>
      <footer><button className="secondary-action" onClick={onCancel}>取消</button><button className="danger-action" onClick={onConfirm}>确认删除</button></footer>
    </section>
  </div>
}
