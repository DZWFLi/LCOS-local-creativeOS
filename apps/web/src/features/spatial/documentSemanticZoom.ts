import type { NodeDisplayMode } from '../../model'

export type DocumentSemanticLevel = 'full' | 'outline' | 'title'

export interface DocumentHeading {
  readonly depth: 1 | 2 | 3
  readonly label: string
  readonly line: number
}

/**
 * Presentation-only LOD thresholds. These are named tokens so later human tuning
 * does not scatter zoom magic across Note/Markdown renderers.
 */
export const DOCUMENT_SEMANTIC_ZOOM = {
  outlineMin: 0.36,
  fullMin: 0.72,
} as const

export function documentSemanticLevel(input: {
  readonly zoom?: number
  readonly density: NodeDisplayMode
  readonly selected?: boolean
}): DocumentSemanticLevel {
  if (input.selected || input.density === 'expanded') return 'full'
  if (input.zoom !== undefined) {
    if (input.zoom >= DOCUMENT_SEMANTIC_ZOOM.fullMin) return 'full'
    if (input.zoom >= DOCUMENT_SEMANTIC_ZOOM.outlineMin) return 'outline'
    return 'title'
  }
  if (input.density === 'compact') return 'title'
  return 'outline'
}

/** Heading structure is derived from the canonical Markdown body. No second Outline truth. */
export function extractDocumentHeadings(markdown: string): readonly DocumentHeading[] {
  return markdown.replace(/\r/g, '').split('\n').flatMap((raw, line) => {
    const match = raw.match(/^\s*(#{1,3})\s+(.+?)\s*$/)
    if (!match) return []
    const label = match[2]!.replace(/\*\*|==|`/g, '').trim()
    if (!label) return []
    return [{ depth: match[1]!.length as 1 | 2 | 3, label, line }]
  })
}

export function documentOutlinePreview(markdown: string, maxItems = 7): readonly DocumentHeading[] {
  const headings = extractDocumentHeadings(markdown)
  if (headings.length <= maxItems) return headings
  // Keep H1/H2 structure preferentially; H3 is detail and yields first at Mid LOD.
  const structural = headings.filter((heading) => heading.depth <= 2)
  return (structural.length >= 2 ? structural : headings).slice(0, maxItems)
}
