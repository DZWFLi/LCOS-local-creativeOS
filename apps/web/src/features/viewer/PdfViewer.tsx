import { GripVertical, LoaderCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, RefObject } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
// Vite 下 worker 必须用 ?url 资产导入拿到真实地址；new URL('pdfjs-dist/…', import.meta.url)
// 是 webpack 写法，Vite 不转换裸包名，运行时会解析成 404 → PDF 渲染不出来。
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import {
  LCOS_MATERIAL_CAPTURE_EVENT,
  writeMaterialTransfer,
  type MaterialSourceV1,
  type MaterialTransferPayloadV1,
} from '../../state/materialTransfer'

// react-pdf v10 纪律：workerSrc 必须与渲染 <Document>/<Page> 的组件写在同一模块，
// 否则模块执行顺序可能让库内默认值覆盖这里的配置（官方 README 明确警告）。
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export interface PdfViewerProps {
  /** PDF 数据源：文件 URL（string）或文件字节（Uint8Array）。 */
  url: string | Uint8Array
  fileName?: string
  /** LCOS 材料溯源工厂：提供后启用「拖一页到画布 / 选中文字放入」能力。 */
  materialSource?: (locator?: MaterialSourceV1['locator']) => MaterialSourceV1
}

/**
 * 真渲染的 PDF 查看器（react-pdf v10 封装）。
 * 三态纪律：加载中「正在渲染 PDF…」/ 错误「无法渲染此文件」+错误详情 / 成功才渲染页面。
 */
export function PdfViewer({ url, fileName, materialSource }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [stageWidth, setStageWidth] = useState(0)
  const [pageScale, setPageScale] = useState(1)
  const [pdfError, setPdfError] = useState('')
  const stageRef = useRef<HTMLElement | null>(null)
  // react-pdf v10 的 file prop：字符串直接传；Uint8Array 必须包成 { data } 参数对象
  // （裸 TypedArray 会被库内 invariant 拒绝）。useMemo 保持引用稳定，避免无谓重载。
  const file = useMemo(() => (typeof url === 'string' ? url : { data: url }), [url])
  // 宽度自适应：页面宽度 = 容器宽 - 32（缩放系数另乘），并夹在可读范围内。
  const pageWidth = stageWidth > 0 ? Math.max(320, Math.min(1600, (stageWidth - 32) * pageScale)) : 720

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || typeof ResizeObserver === 'undefined') return
    const apply = () => setStageWidth(stage.clientWidth)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [numPages])

  const goToPreviousPage = useCallback(() => {
    setPageNumber((current) => Math.max(1, current - 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setPageNumber((current) => Math.min(Math.max(1, numPages), current + 1))
  }, [numPages])

  // 拖一页到画布 = 提取该页为材料；canvas 截图失败时仍保留页码引用。
  const startPageDrag = useCallback((event: ReactDragEvent<HTMLElement>, page: number) => {
    if (!materialSource) return
    const canvas = event.currentTarget.querySelector('canvas')
    let previewDataUrl: string | undefined
    try { previewDataUrl = canvas?.toDataURL('image/png') } catch { /* 截图失败不阻断拖拽 */ }
    const payload: MaterialTransferPayloadV1 = {
      schemaVersion: 1,
      kind: 'material-transfer',
      capturedAt: new Date().toISOString(),
      source: materialSource({ kind: 'page', pageNumber: page, label: `第 ${page} 页` }),
      content: { kind: 'document-page', pageNumber: page, ...(previewDataUrl ? { previewDataUrl } : {}) },
    }
    writeMaterialTransfer(event.dataTransfer, payload)
    event.currentTarget.dataset.dragging = 'true'
  }, [materialSource])

  // 三态之一：错误态显式渲染，不吞错误详情。
  if (pdfError) {
    return <div className="viewer-body viewer-error"><strong>无法渲染此文件</strong><span>{pdfError}</span></div>
  }

  return <div className="viewer-body lcos-pdf-material-viewer" data-file-name={fileName}>
    <Document
      file={file}
      className="lcos-page-viewer lcos-document-pages"
      // 三态之二：加载态文案（fetch 阶段的「正在载入 PDF…」由上层 DocumentViewer 负责）。
      loading={<div className="viewer-loading"><LoaderCircle size={20} />正在渲染 PDF…</div>}
      onLoadSuccess={({ numPages: count }) => {
        setNumPages(count)
        setPageNumber((current) => Math.min(Math.max(1, current), count))
      }}
      onLoadError={(reason) => setPdfError(reason instanceof Error ? reason.message : 'PDF 解析失败')}
      onSourceError={(reason) => setPdfError(reason instanceof Error ? reason.message : 'PDF 数据源读取失败')}
    >
      <aside className="lcos-page-rail" aria-label="PDF 页面">
        <div className="lcos-page-rail-heading"><strong>{numPages || '…'} 页</strong><small>{materialSource ? '拖一页到画布' : fileName ?? 'PDF'}</small></div>
        {Array.from({ length: numPages }, (_, index) => index + 1).map((page) => <button
          key={page}
          type="button"
          className={`lcos-page-thumb ${page === pageNumber ? 'is-current' : ''}`}
          onClick={() => setPageNumber(page)}
          draggable={Boolean(materialSource)}
          onDragStart={(event) => startPageDrag(event, page)}
          onDragEnd={(event) => { delete event.currentTarget.dataset.dragging }}
          aria-label={`第 ${page} 页${materialSource ? '，拖到画布可提取' : ''}`}
        >
          <span className="lcos-page-thumb-canvas"><Page pageNumber={page} width={118} renderTextLayer={false} renderAnnotationLayer={false} /></span>
          <span>{page}</span>
        </button>)}
      </aside>
      <main ref={stageRef} className="lcos-page-stage">
        <div className="lcos-page-stage-toolbar">
          <span className="lcos-pdf-page-readout">第 {pageNumber} / {numPages || '…'} 页</span>
          <div>
            <button type="button" aria-label="上一页" disabled={pageNumber <= 1} onClick={goToPreviousPage}>‹</button>
            <button type="button" aria-label="下一页" disabled={pageNumber >= numPages} onClick={goToNextPage}>›</button>
            <button type="button" aria-label="缩小页面" onClick={() => setPageScale((value) => Math.max(.5, Number((value - .1).toFixed(2))))}>−</button>
            <button type="button" className="lcos-page-zoom-readout" onClick={() => setPageScale(1)}>{Math.round(pageScale * 100)}%</button>
            <button type="button" aria-label="放大页面" onClick={() => setPageScale((value) => Math.min(1.8, Number((value + .1).toFixed(2))))}>＋</button>
          </div>
        </div>
        <motion.div key={pageNumber} className="lcos-page-sheet" initial={{ opacity: .65, y: 4 }} animate={{ opacity: 1, y: 0 }}>
          {/* 三态之三：Document onLoadSuccess 后 numPages>0 才走到这里（成功态）。 */}
          <Page pageNumber={pageNumber} width={pageWidth} renderTextLayer renderAnnotationLayer />
        </motion.div>
        {materialSource && <SelectionDropHandle containerRef={stageRef} source={() => materialSource({ kind: 'page', pageNumber, label: `第 ${pageNumber} 页选区` })} />}
      </main>
    </Document>
  </div>
}

/** 文本选区 → 材料浮钮：选中即出现，点击放入 LCOS，拖拽可放置到画布。 */
export function SelectionDropHandle({ containerRef, source }: {
  containerRef: RefObject<HTMLElement | null>
  source: () => MaterialSourceV1
}) {
  const [selection, setSelection] = useState<{ text: string; left: number; top: number } | null>(null)

  useEffect(() => {
    const update = () => {
      const container = containerRef.current
      const current = window.getSelection()
      if (!container || !current || current.rangeCount === 0 || current.isCollapsed) {
        setSelection(null)
        return
      }
      const range = current.getRangeAt(0)
      const common = range.commonAncestorContainer
      const element = common.nodeType === Node.ELEMENT_NODE ? common as Element : common.parentElement
      if (!element || !container.contains(element)) {
        setSelection(null)
        return
      }
      const text = current.toString().trim()
      const rect = range.getBoundingClientRect()
      if (!text || rect.width <= 0 || rect.height <= 0) {
        setSelection(null)
        return
      }
      setSelection({
        text,
        left: Math.min(window.innerWidth - 42, Math.max(8, rect.right + 7)),
        top: Math.min(window.innerHeight - 42, Math.max(8, rect.bottom + 6)),
      })
    }
    document.addEventListener('selectionchange', update)
    window.addEventListener('resize', update)
    return () => {
      document.removeEventListener('selectionchange', update)
      window.removeEventListener('resize', update)
    }
  }, [containerRef])

  if (!selection) return null
  const payload = (): MaterialTransferPayloadV1 => ({
    schemaVersion: 1,
    kind: 'material-transfer',
    capturedAt: new Date().toISOString(),
    source: source(),
    content: { kind: 'text', text: selection.text },
  })

  return <button
    type="button"
    className="lcos-selection-drop-handle"
    style={{ left: selection.left, top: selection.top }}
    title="拖到画布；点击直接放入"
    aria-label="把选中文字放入 LCOS"
    draggable
    onDragStart={(event) => {
      writeMaterialTransfer(event.dataTransfer, payload())
    }}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={() => {
      window.dispatchEvent(new CustomEvent<MaterialTransferPayloadV1>(LCOS_MATERIAL_CAPTURE_EVENT, { detail: payload() }))
      window.getSelection()?.removeAllRanges()
      setSelection(null)
    }}
  ><GripVertical size={13} /></button>
}
