import { FilePlus2, FolderInput, Link2, PackageOpen, Search, Sparkles, Upload, Wrench, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CanvasNode } from '../../model'
import type { V07CapabilitySet } from '../../runtime/v07UiContracts'

interface Props {
  capabilities: V07CapabilitySet
  nodes: CanvasNode[]
  onClose: () => void
  onImport: (files: File[]) => void
  onCreateObject: () => void
  onAddLink: () => void
  onUniversalImport: () => void
  onHandoff: () => void
  onProjectTools: () => void
  onOpenComposer: () => void
  onSelectNode: (id: string) => void
}

export function CapabilityPopover(props: Props) {
  const popoverRef = useRef<HTMLElement | null>(null)
  const input = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLowerCase()
  useEffect(() => {
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest('.capability-launcher, .capability-launcher-wide')) return
      if (popoverRef.current?.contains(target as Node)) return
      props.onClose()
    }
    window.addEventListener('pointerdown', closeFromOutside)
    return () => window.removeEventListener('pointerdown', closeFromOutside)
  }, [props.onClose])
  const recentAssets = useMemo(() => props.nodes
    .filter((node) => node.kind === 'context' || node.draft || /reference|参考|feedback|script/i.test(node.title))
    .filter((node) => !normalized || `${node.title} ${node.subtitle}`.toLowerCase().includes(normalized))
    .slice(0, 5), [normalized, props.nodes])

  return <aside ref={popoverRef} className="capability-popover" data-testid="capability-popover" role="dialog" aria-label="快捷能力">
    <header>
      <div><small>快捷能力</small><h2>添加与执行</h2></div>
      <button className="dialog-close-action pressable" aria-label="关闭快捷能力" title="关闭" onClick={props.onClose}><X size={14} /><span>关闭</span></button>
    </header>
    <label className="capability-search"><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索能力或资产" /></label>
    <div className="capability-body">
      <section>
        <h3>快速添加</h3>
        <div className="capability-grid">
          <button className="capability-card pressable" disabled={!props.capabilities.importCopy.enabled} title={props.capabilities.importCopy.reason} onClick={() => input.current?.click()}><Upload size={15} /><span><b>Import Copy</b><small>复制进项目</small></span></button>
          <button className="capability-card pressable" onClick={props.onCreateObject}><FilePlus2 size={15} /><span><b>新建内容</b><small>文本 / 内容集合</small></span></button>
          <button className="capability-card pressable" disabled={!props.capabilities.linkReference.enabled} title={props.capabilities.linkReference.reason} onClick={props.onAddLink}><Link2 size={15} /><span><b>链接参考</b><small>网页与在线资料</small></span></button>
          <button className="capability-card pressable" onClick={props.onUniversalImport}><FolderInput size={15} /><span><b>通用导入</b><small>文件 / 文件夹 / ZIP</small></span></button>
          <button className="capability-card pressable" disabled={!props.capabilities.contextManifest.enabled} title={props.capabilities.contextManifest.reason} onClick={props.onHandoff}><PackageOpen size={15} /><span><b>交接当前上下文</b><small>下载或复制 Context Pack</small></span></button>
          <button className="capability-card pressable" onClick={props.onProjectTools}><Wrench size={15} /><span><b>项目工具</b><small>搜索、备份、工程文件</small></span></button>
        </div>
        <input ref={input} hidden multiple type="file" onChange={(event) => { const files = [...(event.currentTarget.files ?? [])]; if (files.length) props.onImport(files); event.currentTarget.value = '' }} />
      </section>
      <section>
        <h3>工作流</h3>
        <button className="capability-row pressable" disabled={!props.capabilities.runWorkflow.enabled} title={props.capabilities.runWorkflow.reason} onClick={props.onOpenComposer}><Sparkles size={14} /><span><b>使用当前选择调用 Agent</b><small>{props.capabilities.runWorkflow.enabled ? '在选区下方输入，范式与 Agent 自由选择' : props.capabilities.runWorkflow.reason}</small></span></button>
        <button className="capability-row pressable" disabled={!props.capabilities.contextManifest.enabled} title={props.capabilities.contextManifest.reason} onClick={props.onHandoff}><PackageOpen size={14} /><span><b>交给另一个对话</b><small>从当前选择生成可追溯上下文</small></span></button>
      </section>
      <section>
        <h3>最近资产</h3>
        {recentAssets.length ? <div className="capability-list">{recentAssets.map((node) => <button className="capability-asset pressable" key={node.id} onClick={() => props.onSelectNode(node.id)}><span className={`asset-dot kind-${node.kind}`} /><span><b>{node.title}</b><small>{node.draft ? 'Draft' : node.previewStatus ?? node.kind}</small></span></button>)}</div> : <p className="capability-empty">没有匹配的资产。</p>}
      </section>
    </div>
  </aside>
}
