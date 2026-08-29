import {
  inferFragmentLabel,
  type LcosFragmentClipboardV0,
} from './fragmentClipboard'

export const LCOS_MATERIAL_TRANSFER_MIME = 'application/x-lcos-material-transfer'
export const LCOS_MATERIAL_CAPTURE_MESSAGE = 'LCOS_MATERIAL_CAPTURE'
export const LCOS_MATERIAL_CAPTURE_EVENT = 'lcos:material-capture'

export type MaterialLocatorV1 =
  | { readonly kind: 'lines'; readonly start: number; readonly end: number; readonly label?: string }
  | { readonly kind: 'page'; readonly pageNumber: number; readonly label?: string }
  | { readonly kind: 'slide'; readonly slideNumber: number; readonly label?: string }
  | { readonly kind: 'selection'; readonly label?: string }

/** Stable logical locator persisted with material provenance. Physical file paths never belong here. */
export function materialLocatorToSourceAnchor(locator?: MaterialLocatorV1): string | undefined {
  if (!locator) return undefined
  if (locator.kind === 'page') return `pdf:p${Math.max(1, Math.trunc(locator.pageNumber))}`
  if (locator.kind === 'slide') return `pptx:s${Math.max(1, Math.trunc(locator.slideNumber))}`
  if (locator.kind === 'lines') {
    const start = Math.max(0, Math.trunc(locator.start)) + 1
    const end = Math.max(start, Math.trunc(locator.end) + 1)
    return start === end ? `text:l${start}` : `text:l${start}-l${end}`
  }
  return undefined
}

export type MaterialSourceAnchorV1 =
  | { readonly kind: 'page'; readonly pageNumber: number }
  | { readonly kind: 'slide'; readonly slideNumber: number }
  | { readonly kind: 'lines'; readonly start: number; readonly end: number }
  | { readonly kind: 'section'; readonly label: string }

export function parseMaterialSourceAnchor(anchor?: string): MaterialSourceAnchorV1 | undefined {
  if (!anchor) return undefined
  const pdf = /^pdf:p(\d+)(?:-p\d+)?$/.exec(anchor)
  if (pdf) return { kind: 'page', pageNumber: Math.max(1, Number(pdf[1])) }
  const slide = /^pptx?:s(\d+)$/.exec(anchor)
  if (slide) return { kind: 'slide', slideNumber: Math.max(1, Number(slide[1])) }
  const lines = /^text:l(\d+)(?:-l(\d+))?$/.exec(anchor)
  if (lines) {
    const start = Math.max(0, Number(lines[1]) - 1)
    const end = Math.max(start, Number(lines[2] ?? lines[1]) - 1)
    return { kind: 'lines', start, end }
  }
  if (anchor.startsWith('section:') && anchor.slice('section:'.length).trim()) return { kind: 'section', label: anchor.slice('section:'.length).trim() }
  return undefined
}

export interface MaterialSourceV1 {
  readonly projectId?: string
  readonly viewId?: string
  readonly title: string
  readonly artifactId?: string
  readonly revisionId?: string
  readonly fileRecordId?: string
  readonly sourceKind?: string
  readonly sourceUrl?: string
  readonly provider?: string
  readonly locator?: MaterialLocatorV1
}

export type MaterialContentV1 =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'image'; readonly dataUrl: string; readonly mimeType: string; readonly fileName?: string }
  | { readonly kind: 'document-page'; readonly pageNumber: number; readonly previewDataUrl?: string; readonly text?: string }
  | { readonly kind: 'presentation-slide'; readonly slideNumber: number; readonly svg?: string; readonly text?: string }

export interface MaterialTransferPayloadV1 {
  readonly schemaVersion: 1
  readonly kind: 'material-transfer'
  readonly capturedAt: string
  readonly source: MaterialSourceV1
  readonly content: MaterialContentV1
}

export function serializeMaterialTransfer(payload: MaterialTransferPayloadV1): string {
  return JSON.stringify(payload)
}

export function parseMaterialTransfer(raw: string): MaterialTransferPayloadV1 | null {
  if (!raw.trim()) return null
  try {
    const parsed = JSON.parse(raw) as Partial<MaterialTransferPayloadV1>
    if (parsed.schemaVersion !== 1 || parsed.kind !== 'material-transfer') return null
    if (!parsed.source || typeof parsed.source !== 'object' || typeof parsed.source.title !== 'string') return null
    if (!parsed.content || typeof parsed.content !== 'object' || typeof parsed.content.kind !== 'string') return null
    if (parsed.content.kind === 'text' && (typeof parsed.content.text !== 'string' || !parsed.content.text.trim())) return null
    if (parsed.content.kind === 'image' && (typeof parsed.content.dataUrl !== 'string' || !parsed.content.dataUrl.startsWith('data:'))) return null
    if (parsed.content.kind === 'document-page' && typeof parsed.content.pageNumber !== 'number') return null
    if (parsed.content.kind === 'presentation-slide' && typeof parsed.content.slideNumber !== 'number') return null
    return parsed as MaterialTransferPayloadV1
  } catch {
    return null
  }
}

export function materialTransferFromLegacyFragment(payload: LcosFragmentClipboardV0): MaterialTransferPayloadV1 {
  return {
    schemaVersion: 1,
    kind: 'material-transfer',
    capturedAt: payload.copiedAt,
    source: {
      projectId: payload.source.projectId,
      viewId: payload.source.viewId,
      title: payload.source.title,
      ...(payload.source.artifactId ? { artifactId: payload.source.artifactId } : {}),
      ...(payload.source.revisionId ? { revisionId: payload.source.revisionId } : {}),
      ...(payload.source.fileRecordId ? { fileRecordId: payload.source.fileRecordId } : {}),
      ...(payload.source.sourceKind ? { sourceKind: payload.source.sourceKind } : {}),
      ...(payload.source.locator ? { locator: payload.source.locator } : {}),
    },
    content: { kind: 'text', text: payload.text },
  }
}

export function materialTransferLabel(payload: MaterialTransferPayloadV1): string {
  const locator = payload.source.locator
  if (locator?.label?.trim()) return locator.label.trim()
  if (locator?.kind === 'page') return `第 ${locator.pageNumber} 页`
  if (locator?.kind === 'slide') return `第 ${locator.slideNumber} 页`
  if (payload.content.kind === 'document-page') return `第 ${payload.content.pageNumber} 页`
  if (payload.content.kind === 'presentation-slide') return `第 ${payload.content.slideNumber} 页`
  if (payload.content.kind === 'text') return inferFragmentLabel(payload.content.text)
  return '局部材料'
}

export function materialTransferArtifactTitle(payload: MaterialTransferPayloadV1): string {
  const source = payload.source.title
    .replace(/\.(md|markdown|txt|json|pdf|pptx?|key|docx?|xlsx?|csv)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  const label = materialTransferLabel(payload)
  if (!source) return label
  if (!label || source === label) return `${source} · 摘录`
  return `${source} · ${label}`
}

export function writeMaterialTransfer(dataTransfer: DataTransfer, payload: MaterialTransferPayloadV1): void {
  const serialized = serializeMaterialTransfer(payload)
  dataTransfer.setData(LCOS_MATERIAL_TRANSFER_MIME, serialized)
  dataTransfer.effectAllowed = 'copy'
  if (payload.content.kind === 'text') dataTransfer.setData('text/plain', payload.content.text)
  else dataTransfer.setData('text/plain', materialTransferArtifactTitle(payload))
}

export function dataUrlToFile(dataUrl: string, fileName: string): File | null {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
  if (!match) return null
  try {
    const mime = match[1] || 'application/octet-stream'
    const base64 = Boolean(match[2])
    const body = match[3]
    const raw = base64 ? atob(body) : decodeURIComponent(body)
    const bytes = new Uint8Array(raw.length)
    for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
    return new File([bytes], fileName, { type: mime })
  } catch {
    return null
  }
}

export function svgToFile(svg: string, fileName: string): File {
  return new File([svg], fileName, { type: 'image/svg+xml' })
}
