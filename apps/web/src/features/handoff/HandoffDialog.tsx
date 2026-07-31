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
          <small>PROJECT TRUTH · CONTEXTMANIFESTV0</small>
          <h2 id="handoff-title">Handoff Pack</h2>
        </div>
        <button aria-label="关闭 Handoff" onClick={onClose}><X size={16} /></button>
      </header>
      {loading
        ? <div className="handoff-state"><LoaderCircle className="spin" size={20} />正在从 Runtime Project Truth 构建…</div>
        : error
          ? <div className="handoff-state error">{error}</div>
          : manifest
            ? <>
                <div className="handoff-meta">
                  <span>Schema v{manifest.schemaVersion}</span>
                  <span>{manifest.orderedItems.length} items</span>
                  <span title={manifest.renderedManifestHash}>Hash {manifest.renderedManifestHash.slice(0, 10)}</span>
                </div>
                <pre data-testid="handoff-preview">{manifest.renderedMarkdown}</pre>
                <footer>
                  <button className="quiet" onClick={onCopy}><Clipboard size={14} />复制 Markdown</button>
                  <button className="primary" onClick={onDownload}><Download size={14} />下载 Handoff</button>
                </footer>
              </>
            : <div className="handoff-state">没有可用的 Runtime Manifest。</div>}
    </section>
  </div>
}
