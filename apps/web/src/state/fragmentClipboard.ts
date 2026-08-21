export const LCOS_FRAGMENT_CLIPBOARD_MIME = 'application/x-lcos-fragment'

export interface LcosFragmentClipboardV0 {
  readonly schemaVersion: 0
  readonly kind: 'fragment'
  readonly contentType: 'text'
  readonly text: string
  readonly copiedAt: string
  readonly source: {
    readonly projectId: string
    readonly viewId: string
    readonly title: string
    readonly artifactId?: string
    readonly revisionId?: string
    readonly fileRecordId?: string
    readonly sourceKind?: string
    readonly locator?: {
      readonly kind: 'lines'
      readonly start: number
      readonly end: number
      readonly label?: string
    }
  }
}

export function serializeFragmentClipboard(payload: LcosFragmentClipboardV0): string {
  return JSON.stringify(payload)
}

export function parseFragmentClipboard(raw: string): LcosFragmentClipboardV0 | null {
  if (!raw.trim()) return null
  try {
    const parsed = JSON.parse(raw) as Partial<LcosFragmentClipboardV0>
    if (parsed.schemaVersion !== 0 || parsed.kind !== 'fragment' || parsed.contentType !== 'text') return null
    if (typeof parsed.text !== 'string' || !parsed.text.trim()) return null
    const source = parsed.source
    if (!source || typeof source !== 'object') return null
    if (typeof source.projectId !== 'string' || typeof source.viewId !== 'string' || typeof source.title !== 'string') return null
    return parsed as LcosFragmentClipboardV0
  } catch {
    return null
  }
}

export function inferFragmentLabel(text: string, fallback = '摘录'): string {
  const first = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim().replace(/^#{1,6}\s+/, '').replace(/^[-*>]\s*/, ''))
    .find(Boolean)
  if (!first) return fallback
  const sentence = first.split(/[。！？.!?]/, 1)[0]?.trim() || first
  return sentence.length > 28 ? `${sentence.slice(0, 28)}…` : sentence
}

export function fragmentArtifactTitle(payload: LcosFragmentClipboardV0): string {
  const source = payload.source.title
    .replace(/\.(md|markdown|txt|json|pdf|pptx?|key|docx?|xlsx?|csv)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  const label = payload.source.locator?.label?.trim() || inferFragmentLabel(payload.text)
  if (!source) return label
  if (!label || source === label) return `${source} · 摘录`
  return `${source} · ${label}`
}
