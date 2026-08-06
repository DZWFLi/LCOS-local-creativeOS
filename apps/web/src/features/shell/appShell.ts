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
