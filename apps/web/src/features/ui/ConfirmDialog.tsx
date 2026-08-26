import { CircleAlert, X } from 'lucide-react'
import { dismissFromBackdrop } from './dismissibleLayer'

interface Props {
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
  /** 覆盖确认按钮文案（默认「确认删除」）；非破坏性确认（如复制引用）用主按钮色。 */
  confirmLabel?: string
}

export function ConfirmDialog({ title, description, onConfirm, onCancel, confirmLabel }: Props) {
  const destructive = confirmLabel === undefined
  return <div data-testid="confirm-dialog" className="confirm-backdrop" role="presentation" onPointerDown={(event) => dismissFromBackdrop(event, onCancel)}>
    <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <header><CircleAlert size={18} /><div><span>Confirm</span><h2 id="confirm-title">{title}</h2></div><button aria-label="关闭确认" title="取消" onClick={onCancel}><X size={15} /></button></header>
      <p>{description}</p>
      <footer><button className="secondary-action" onClick={onCancel}>取消</button><button className={destructive ? 'danger-action' : 'primary-action'} onClick={onConfirm}>{confirmLabel ?? '确认删除'}</button></footer>
    </section>
  </div>
}
