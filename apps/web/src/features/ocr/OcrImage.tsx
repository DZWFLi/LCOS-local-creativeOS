import type { OcrResultV1 } from '@local-creative-os/contracts'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { runOcr } from './ocrRuntime'

export interface FitRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 计算图片在 object-fit 下实际显示文字的区域（相对显示矩形左上角，单位 px）。 */
export function computeFitRect(img: HTMLImageElement, displayRect: { readonly width: number; readonly height: number }): FitRect {
  const cw = displayRect.width || 1
  const ch = displayRect.height || 1
  const nw = img.naturalWidth || cw
  const nh = img.naturalHeight || ch
  const fit = getComputedStyle(img).objectFit
  if (fit === 'fill') return { x: 0, y: 0, width: cw, height: ch }
  const scaleX = cw / nw
  const scaleY = ch / nh
  if (fit === 'contain') {
    const scale = Math.min(scaleX, scaleY)
    const width = nw * scale
    const height = nh * scale
    return { x: (cw - width) / 2, y: (ch - height) / 2, width, height }
  }
  // cover / 默认：居中裁切
  const scale = Math.max(scaleX, scaleY)
  const width = nw * scale
  const height = nh * scale
  return { x: (cw - width) / 2, y: (ch - height) / 2, width, height }
}

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  readonly artifactId?: string | null
  readonly ocrEnabled?: boolean
  readonly imgRef?: React.Ref<HTMLImageElement>
}

/**
 * 微信式悬停 OCR：鼠标移到图片上，识别出的文字行自动变成可提取文字层。
 * 触发用 document 级指针命中检测（不依赖 img 的 mouseenter，避免被画布边层 14px
 * 可点区拦截）；文字层 portal 到 body 最顶层，点击行复制该行文字。
 */
export function OcrImage({ artifactId, ocrEnabled = true, imgRef: forwardedImgRef, ...imgProps }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const hoveringRef = useRef(false)
  const startedRef = useRef(false)
  const [hovering, setHovering] = useState(false)
  const [started, setStarted] = useState(false)
  const [rect, setRect] = useState<{ readonly left: number; readonly top: number; readonly width: number; readonly height: number } | null>(null)
  const [result, setResult] = useState<OcrResultV1 | null>(null)
  const [selection, setSelection] = useState<{ start: number; end: number; copied: boolean } | null>(null)
  const selectionRef = useRef<{ start: number; end: number } | null>(null)
  const lineRectsRef = useRef<readonly { readonly top: number; readonly bottom: number; readonly index: number }[]>([])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const img = imgRef.current
      if (!img || !ocrEnabled || !artifactId) return
      const r = img.getBoundingClientRect()
      const inside = event.clientX >= r.left && event.clientX <= r.right
        && event.clientY >= r.top && event.clientY <= r.bottom
      if (inside) {
        if (startedRef.current) {
          setRect({ left: r.left, top: r.top, width: r.width, height: r.height })
        } else if (!hoveringRef.current) {
          hoveringRef.current = true
          setHovering(true)
          setRect({ left: r.left, top: r.top, width: r.width, height: r.height })
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null
            startedRef.current = true
            setStarted(true)
            void runOcr(artifactId).then((value) => setResult(value))
          }, 220)
        }
      } else if (hoveringRef.current) {
        hoveringRef.current = false
        startedRef.current = false
        setHovering(false)
        setStarted(false)
        if (timerRef.current !== null) window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
    document.addEventListener('pointermove', onPointerMove, true)
    return () => document.removeEventListener('pointermove', onPointerMove)
  }, [artifactId, ocrEnabled])

  const showOverlay = hovering && started && result !== null && result.lines.length > 0 && rect !== null && imgRef.current !== null
  const fitRect = showOverlay ? computeFitRect(imgRef.current!, rect) : null
  const lineIndexAt = (clientY: number): number | null => {
    const rows = lineRectsRef.current
    for (const row of rows) {
      if (clientY >= row.top && clientY <= row.bottom) return row.index
    }
    return null
  }

  useEffect(() => {
    if (!showOverlay) return
    const rows = Array.from(document.querySelectorAll('.lcos-ocr-line')).map((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, index: Number(el.getAttribute('data-ocr-index') ?? -1) }
    }).filter((row) => row.index >= 0).sort((a, b) => a.index - b.index)
    lineRectsRef.current = rows
  }, [showOverlay, result, rect])

  useEffect(() => {
    if (!showOverlay) return
    const onPointerMove = (event: PointerEvent) => {
      const current = selectionRef.current
      if (!current) return
      const index = lineIndexAt(event.clientY)
      if (index !== null) {
        selectionRef.current = { ...current, end: index }
        setSelection({ start: current.start, end: index, copied: false })
      }
    }
    const onPointerUp = () => {
      const current = selectionRef.current
      if (!current) return
      selectionRef.current = null
      setSelection((previous) => previous && { ...previous, end: current.end })
    }
    const onPointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest('.lcos-ocr-line, .lcos-ocr-copy')) return
      if (selectionRef.current === null && !selection) return
      selectionRef.current = null
      setSelection(null)
    }
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('pointerdown', onPointerDownOutside, true)
    return () => {
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('pointerdown', onPointerDownOutside, true)
    }
  }, [showOverlay, selection])

  const copySelection = async () => {
    if (!selection || !result) return
    const start = Math.min(selection.start, selection.end)
    const end = Math.max(selection.start, selection.end)
    const text = result.lines.slice(start, end + 1).map((line) => line.text).join('\n')
    await navigator.clipboard?.writeText(text)
    setSelection({ ...selection, copied: true })
  }

  const selectedRange = selection ? { start: Math.min(selection.start, selection.end), end: Math.max(selection.start, selection.end) } : null

  return (
    <>
      <img
        ref={(element) => {
          imgRef.current = element
          if (typeof forwardedImgRef === 'function') forwardedImgRef(element)
          else if (forwardedImgRef !== undefined && forwardedImgRef !== null) forwardedImgRef.current = element
        }}
        {...imgProps}
        draggable={imgProps.draggable ?? false}
      />
      {showOverlay && fitRect && rect && createPortal(
        <span
          className="lcos-ocr-overlay"
          aria-hidden="true"
          style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, height: rect.height, overflow: 'hidden', pointerEvents: 'none', zIndex: 2147483000 }}
        >
          {result.lines.map((line, index) => {
            if (!line.box || line.box.length < 4) return null
            const x0 = Math.min(...line.box.map((point) => point[0] ?? 0))
            const y0 = Math.min(...line.box.map((point) => point[1] ?? 0))
            const x1 = Math.max(...line.box.map((point) => point[0] ?? 0))
            const y1 = Math.max(...line.box.map((point) => point[1] ?? 0))
            const nw = imgRef.current?.naturalWidth || 1
            const nh = imgRef.current?.naturalHeight || 1
            const left = fitRect.x + x0 * (fitRect.width / nw)
            const top = fitRect.y + y0 * (fitRect.height / nh)
            const width = (x1 - x0) * (fitRect.width / nw)
            const height = (y1 - y0) * (fitRect.height / nh)
            if (width < 12 || height < 8) return null
            const selected = selectedRange !== null && index >= selectedRange.start && index <= selectedRange.end
            return (
              <span
                key={`${line.text}-${index}`}
                className="lcos-ocr-line"
                data-ocr-index={index}
                title="拖选文字复制"
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width,
                  height,
                  cursor: 'text',
                  pointerEvents: 'auto',
                  userSelect: 'none',
                  background: selected ? 'rgba(59,130,246,.30)' : 'transparent',
                  borderRadius: 3,
                  zIndex: 3,
                }}
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  selectionRef.current = { start: index, end: index }
                  setSelection({ start: index, end: index, copied: false })
                }}
              />
            )
          })}
          {selection && (
            <button
              type="button"
              className="lcos-ocr-copy"
              style={{
                position: 'absolute',
                left: '50%',
                bottom: 6,
                transform: 'translateX(-50%)',
                zIndex: 5,
                pointerEvents: 'auto',
                padding: '6px 14px',
                border: 0,
                borderRadius: 10,
                background: '#3b82f6',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(59,130,246,.35)',
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void copySelection()
              }}
            >
              {selection.copied ? '已复制 ✓' : `复制选中 ${Math.abs(selection.end - selection.start) + 1} 行`}
            </button>
          )}
        </span>,
        document.body,
      )}
    </>
  )
}
