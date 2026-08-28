import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../../../model'
import { miniMapVisualKindForNode } from '../minimapSemantics'

const node = (input: Partial<CanvasNode>): CanvasNode => ({
  id: 'view-1',
  kind: 'source',
  title: 'Material',
  subtitle: '',
  x: 0,
  y: 0,
  width: 160,
  height: 90,
  ...input,
})

describe('miniMapVisualKindForNode', () => {
  it('keeps Conversation as an organic silhouette without reading lifecycle', () => {
    expect(miniMapVisualKindForNode(node({ entityKind: 'conversation', conversation: { id: 'c1', title: 'Research', lifecyclePhase: 'busy' } }))).toBe('conversation')
    expect(miniMapVisualKindForNode(node({ entityKind: 'conversation', conversation: { id: 'c1', title: 'Research', lifecyclePhase: 'dormant' } }))).toBe('conversation')
  })

  it('preserves aggregate regions as regions', () => {
    expect(miniMapVisualKindForNode(node({ entityKind: 'context' }))).toBe('context')
    expect(miniMapVisualKindForNode(node({ entityKind: 'workflow' }))).toBe('workflow')
    expect(miniMapVisualKindForNode(node({ entityKind: 'workspace' }))).toBe('workspace')
  })

  it('uses medium identity for static materials', () => {
    expect(miniMapVisualKindForNode(node({ title: 'frame.png', previewMimeType: 'image/png' }))).toBe('image')
    expect(miniMapVisualKindForNode(node({ title: 'deck.pptx', fileType: 'presentation' }))).toBe('slide')
    expect(miniMapVisualKindForNode(node({ title: 'brief.pdf', fileType: 'pdf' }))).toBe('document')
  })
})
