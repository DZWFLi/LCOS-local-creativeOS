/**
 * Phase C (C7): mechanical visual family derived from stable metadata
 * (Artifact kind / MIME / resource / conversation mapping / SKILL.md path /
 * run output role). Title/business regexes are not used here. One bounded
 * legacy `kind === process` compatibility branch remains for old Run nodes and
 * must stay shrink-only until the runtime role is fully mechanical.
 */

export type VisualFamily =
  | 'text'
  | 'document'
  | 'image'
  | 'url'
  | 'conversation'
  | 'skill'
  | 'run'
  | 'output'
  | 'unknown'

export interface VisualFamilyInput {
  readonly artifactKind?: string
  readonly mimeType?: string
  readonly fileType?: string
  readonly kind?: string
  readonly artifactId?: string
  readonly title?: string
  readonly subtitle?: string
  readonly sourceRunId?: string
  readonly managed?: boolean
  /** GUI-2：机械来源——resource descriptor 的 source.kind（file/url/…）或文件路径。 */
  readonly sourceKind?: string
  readonly observedPath?: string
}

export function visualFamilyFor(input: VisualFamilyInput): VisualFamily {
  const kind = input.kind ?? ''
  const artifactKind = input.artifactKind ?? input.fileType ?? ''
  const mime = input.mimeType ?? ''
  const artifactId = input.artifactId ?? ''
  const sourceKind = input.sourceKind ?? ''
  const observedPath = input.observedPath ?? ''

  if (kind === 'process') return 'run'
  if (artifactId.startsWith('artifact-conv-')) return 'conversation'
  if (input.sourceRunId !== undefined && input.managed === true) return 'output'
  // GUI-2：skill 由文件路径机械判定，不再用 title 文本。
  if (observedPath.includes('.codex/skills') || observedPath.toLowerCase().endsWith('skill.md')) return 'skill'
  if (artifactKind === 'image' || mime.startsWith('image/')) return 'image'
  if (artifactKind === 'text' || mime === 'text/plain') return 'text'
  if (artifactKind === 'pdf' || artifactKind === 'presentation' || artifactKind === 'markdown' || mime.startsWith('text/')) return 'document'
  // GUI-2：URL 由 resource source.kind 驱动，不用 title 正则。
  if (sourceKind === 'url' || artifactKind === 'link' || mime === 'text/uri-list') return 'url'
  return 'unknown'
}
