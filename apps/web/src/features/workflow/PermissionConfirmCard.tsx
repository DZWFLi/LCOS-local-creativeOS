import { ShieldAlert, X } from 'lucide-react'
import { dismissFromBackdrop } from '../ui/dismissibleLayer'

interface Props {
  /** 确认卡标题（如「Agent 将执行写操作」）。 */
  title: string
  /** 将改动的对象清单（判定层已兜底空列表为「当前项目」，组件按只读列表渲染）。 */
  items: readonly string[]
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 权限确认卡（第一梯队 ⑥）：写意图 Run 发送前的授权门。
 * 复用 ConfirmDialog 的浮层协议（backdrop + dismissFromBackdrop + role=dialog），
 * 不另造浮层体系；样式走 Glaze（spatial-components.css 的 permission-confirm-*）。
 * 确认后 Agent 才开始执行；取消则本次任务不发起。
 */
export function PermissionConfirmCard({ title, items, onConfirm, onCancel }: Props) {
  return <div data-testid="permission-confirm-card" className="permission-confirm-backdrop" role="presentation" onPointerDown={(event) => dismissFromBackdrop(event, onCancel)}>
    <section className="permission-confirm-card" role="dialog" aria-modal="true" aria-labelledby="permission-confirm-title">
      <header><ShieldAlert size={18} /><div><span>Permission</span><h2 id="permission-confirm-title">{title}</h2></div><button aria-label="关闭确认" title="取消" onClick={onCancel}><X size={15} /></button></header>
      <p className="permission-confirm-note">确认后 Agent 开始执行；取消则本次任务不发起。</p>
      <ul className="permission-confirm-items" aria-label="将改动的对象">
        {items.map((item) => <li key={item} className="permission-confirm-item"><span className="permission-confirm-item-dot" aria-hidden="true" />{item}</li>)}
      </ul>
      <footer>
        <button className="secondary-action" onClick={onCancel}>取消</button>
        <button className="primary-action" onClick={onConfirm}>确认执行</button>
      </footer>
    </section>
  </div>
}
