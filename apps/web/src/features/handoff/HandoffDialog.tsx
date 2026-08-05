import { Clipboard, Download, FileText, LoaderCircle, X } from 'lucide-react'

import type { ContextManifestV0 } from '@local-creative-os/contracts'

interface Props {
  readonly open: boolean
  readonly loading: boolean
  readonly manifest: ContextManifestV0 | null
  readonly error?: string
  readonly onClose: () => void
  readonly onCopy: () => void
  readonly onDownload: () => void
}

export function HandoffDialog({ open, loading, manifest, error, onClose, onCopy, onDownload }: Props) {
  if (!open) return null
  return <div className="handoff-backdrop" role="presentation" onPointerDown={(event) => {
    if (event.target === event.currentTarget) onClose()
  }}>
    <section className="handoff-dialog" role="dialog" aria-modal="true" aria-labelledby="handoff-title">
      <header>
        <span><FileText size={17} /></span>
        <div>
          <small>当前选择与项目内容</small>
          <h2 id="handoff-title">交给另一个对话</h2>
        </div>
        <button aria-label="关闭 Handoff" onClick={onClose}><X size={16} /></button>
      </header>
      {loading
        ? <div className="handoff-state"><LoaderCircle className="spin" size={20} />正在整理当前上下文…</div>
        : error
          ? <div className="handoff-state error">{error}</div>
          : manifest
            ? <>
                <div className="handoff-meta">
                  <span>已整理 {manifest.orderedItems.length} 项内容</span>
                  <span title="完整校验信息已包含在下载文件中">可追溯版本</span>
                </div>
                <pre data-testid="handoff-preview">{manifest.renderedMarkdown}</pre>
                <footer>
                  <button className="quiet" onClick={onCopy}><Clipboard size={14} />复制上下文</button>
                  <button className="primary" onClick={onDownload}><Download size={14} />下载 Markdown</button>
                </footer>
              </>
            : <div className="handoff-state">当前没有可交接的上下文。请先选择或加入参考内容。</div>}
    </section>
  </div>
}
