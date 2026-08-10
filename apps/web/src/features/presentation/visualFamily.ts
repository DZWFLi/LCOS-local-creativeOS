/**
 * Phase C (C7): mechanical visual family derived from stable metadata
 * (Artifact kind / MIME / resource / conversation mapping / SKILL.md path /
 * run output role). Legacy NodeKind and title regexes are NOT used here.
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
}

export function visualFamilyFor(input: VisualFamilyInput): VisualFamily {
  const kind = input.kind ?? ''
  const artifactKind = input.artifactKind ?? input.fileType ?? ''
  const mime = input.mimeType ?? ''
  const title = input.title ?? ''
  const artifactId = input.artifactId ?? ''

  if (kind === 'process') return 'run'
  if (artifactId.startsWith('artifact-conv-')) return 'conversation'
  if (input.sourceRunId !== undefined && input.managed === true) return 'output'
  if (title.toLowerCase().endsWith('skill.md') || title.includes('.codex/skills') || title.startsWith('skill:')) return 'skill'
  if (artifactKind === 'image' || mime.startsWith('image/')) return 'image'
  if (artifactKind === 'text' || mime === 'text/plain') return 'text'
  if (artifactKind === 'pdf' || artifactKind === 'presentation' || artifactKind === 'markdown' || mime.startsWith('text/')) return 'document'
  if (artifactKind === 'link' || mime === 'text/uri-list' || /^https?:\/\//i.test(title)) return 'url'
  return 'unknown'
}
