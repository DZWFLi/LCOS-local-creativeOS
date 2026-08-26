import type { RunReview } from '@local-creative-os/contracts'
import type { ActiveRun, CanvasScope } from '../../model'

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function runtimePresentationStatus(review: RunReview): ActiveRun['status'] {
  if (review.dispatch.status === 'recovery_required' || review.dispatch.status === 'failed') return 'failed'
  if (review.presentationPhase === 'created' || review.presentationPhase === 'queued') return 'queued'
  if (review.presentationPhase === 'cancelled') return 'cancelled'
  return review.presentationPhase
}

export function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

export function buildScopePath(scopes: CanvasScope[], scope: CanvasScope): CanvasScope[] {
  const result: CanvasScope[] = [scope]
  let current = scope
  while (current.parentScopeId) {
    const parent = scopes.find((item) => item.id === current.parentScopeId)
    if (!parent) break
    result.unshift(parent)
    current = parent
  }
  return result
}

export function isTextPreviewFile(file: File): boolean {
  return file.type.startsWith('text/')
    || /\.(md|markdown|txt|log|json|csv|tsv|yaml|yml)$/i.test(file.name)
}

/**
 * 智能文本解码：优先严格 UTF-8；非法 UTF-8 时回退 GBK（Windows 记事本
 * ANSI 默认编码），再不行退 latin1 保证字节可见。
 * 解决中文 txt 拖入/预览时的乱码问题（file.text()/response.text() 永远按 UTF-8）。
 */
export function decodeTextBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { /* 非法 UTF-8，继续回退 */ }
  try { return new TextDecoder('gbk').decode(bytes) } catch { /* GBK 不受支持（极少见），继续回退 */ }
  return new TextDecoder('windows-1252').decode(bytes)
}

export function inferFileType(fileName: string): string {
  if (/\.(md|markdown)$/i.test(fileName)) return 'text/markdown'
  if (/\.txt$/i.test(fileName)) return 'text/plain'
  if (/\.json$/i.test(fileName)) return 'application/json'
  if (/\.csv$/i.test(fileName)) return 'text/csv'
  if (/\.docx$/i.test(fileName)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (/\.pdf$/i.test(fileName)) return 'application/pdf'
  if (/\.svg$/i.test(fileName)) return 'image/svg+xml'
  if (/\.avif$/i.test(fileName)) return 'image/avif'
  if (/\.bmp$/i.test(fileName)) return 'image/bmp'
  return 'unknown'
}
