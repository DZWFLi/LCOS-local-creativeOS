import { PptxViewer } from '@pagus-kit/react'
import { ExternalLink, LoaderCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CanvasNode } from '../../model'
import { LOCAL_CORE_API_PREFIX } from '../../runtime/localCoreClient'

interface Props {
  projectId: string
  node: CanvasNode
  onClose: () => void
}

export function DocumentPreviewDialog({ projectId, node, onClose }: Props) {
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const isPdf = node.fileType === 'pdf' || node.title.toLowerCase().endsWith('.pdf')

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    const load = async () => {
      try {
        const response = await fetch(`${LOCAL_CORE_API_PREFIX}/projects/${encodeURIComponent(projectId)}/file-records/${encodeURIComponent(String(node.fileRecordId))}/content`, { signal: controller.signal })
        if (!response.ok) {
          const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null
          throw new Error(detail?.error?.message ?? `Preview request failed (${response.status}).`)
        }
        const bytes = await response.arrayBuffer()
        if (isPdf) {
          objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
          setPdfUrl(objectUrl)
        } else setBuffer(bytes)
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Preview failed.')
      }
    }
    void load()
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [isPdf, node.fileRecordId, projectId])

  return <div className="document-preview-layer" role="presentation">
    <section className="document-preview-dialog" role="dialog" aria-modal="true" aria-label={`${node.title} 只读预览`}>
      <header><div><small>LOCAL READ-ONLY PREVIEW</small><h2>{node.title}</h2></div><button className="icon-button pressable" aria-label="关闭预览" onClick={onClose}><X size={17} /></button></header>
      <main>
        {error ? <div className="document-preview-error"><strong>无法预览</strong><span>{error}</span></div>
          : isPdf
            ? pdfUrl ? <iframe title={`${node.title} PDF 预览`} src={pdfUrl} /> : <div className="document-preview-loading"><LoaderCircle size={22} />正在载入 PDF…</div>
            : buffer ? <PptxViewer file={buffer} useGoogleFonts={false} useEmbeddedFonts onError={(reason) => setError(reason.message)} /> : <div className="document-preview-loading"><LoaderCircle size={22} />正在解析 PPTX…</div>}
      </main>
      <footer><span><ExternalLink size={13} />文件仅从 Local Core 读取，不上传第三方；不提供编辑。</span></footer>
    </section>
  </div>
}
