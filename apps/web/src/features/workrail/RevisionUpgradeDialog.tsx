import { useMemo, useState } from 'react'
import { ArrowUp, X } from 'lucide-react'

export interface RevisionUpgradeInput {
  readonly feedback: string
  readonly decision: string
  readonly changeItems: readonly string[]
  readonly preserveItems: readonly string[]
}

function lines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
}

export function RevisionUpgradeDialog({ targetTitle, busy, onClose, onSubmit }: {
  readonly targetTitle: string
  readonly busy: boolean
  readonly onClose: () => void
  readonly onSubmit: (input: RevisionUpgradeInput) => void
}) {
  const [feedback, setFeedback] = useState('')
  const [decision, setDecision] = useState('')
  const [changeItems, setChangeItems] = useState('')
  const [preserveItems, setPreserveItems] = useState('')
  const valid = useMemo(() => feedback.trim().length > 0 && decision.trim().length > 0 && lines(changeItems).length > 0, [changeItems, decision, feedback])

  return <div className="lcos-revision-upgrade-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="lcos-revision-upgrade-dialog" role="dialog" aria-modal="true" aria-label="基于反馈升级 Agent 结果">
      <header><div><small>Agent 结果升级</small><h2>{targetTitle}</h2><p>把这轮反馈收成决策与修改请求，再创建一个新的 Draft。原文件和当前版本不会被直接覆盖。</p></div><button type="button" aria-label="关闭" disabled={busy} onClick={onClose}><X size={15}/></button></header>
      <label><span>这轮反馈</span><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={4} placeholder="粘贴客户 / 团队 / Agent 对这份结果的反馈……" autoFocus/></label>
      <label><span>已经确认的判断</span><textarea value={decision} onChange={(event) => setDecision(event.target.value)} rows={2} placeholder="例如：保留整体结构，只重做开场与产品展示节奏。"/></label>
      <label><span>要修改</span><textarea value={changeItems} onChange={(event) => setChangeItems(event.target.value)} rows={3} placeholder={'每行一项\n开场缩短到 3 秒\n产品镜头提前'}/></label>
      <label><span>必须保留（可选）</span><textarea value={preserveItems} onChange={(event) => setPreserveItems(event.target.value)} rows={2} placeholder={'每行一项\n人物设定\n结尾 CTA'}/></label>
      <footer><span>只从已经完成的 Agent 结果进入这条链，不作为普通文件编辑入口。</span><button type="button" disabled={!valid || busy} onClick={() => onSubmit({ feedback: feedback.trim(), decision: decision.trim(), changeItems: lines(changeItems), preserveItems: lines(preserveItems) })}>{busy ? '正在准备…' : <><ArrowUp size={14}/>生成下一版</>}</button></footer>
    </section>
  </div>
}
