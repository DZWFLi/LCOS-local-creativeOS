import { describe, expect, it } from 'vitest'
import { dominantDialogOwner } from '../dialogOwner'

describe('dominantDialogOwner', () => {
  it('returns no owner when nothing is open', () => {
    expect(dominantDialogOwner([
      { id: 'workbench', tier: 'surface', open: false },
      { id: 'confirm', tier: 'blocking', open: false },
    ])).toBeNull()
  })

  it('lets a child temporarily outrank its parent surface', () => {
    expect(dominantDialogOwner([
      { id: 'import', tier: 'surface', open: true },
      { id: 'link-reference', tier: 'child', open: true },
    ])).toBe('link-reference')
  })

  it('lets a blocking confirmation outrank editors and child dialogs', () => {
    expect(dominantDialogOwner([
      { id: 'note-edit', tier: 'editor', open: true },
      { id: 'resource-detail', tier: 'child', open: true },
      { id: 'confirm-delete', tier: 'blocking', open: true },
    ])).toBe('confirm-delete')
  })

  it('uses later candidate order as the deterministic tie breaker', () => {
    expect(dominantDialogOwner([
      { id: 'scope-create', tier: 'surface', open: true },
      { id: 'workspace-editor', tier: 'surface', open: true },
    ])).toBe('workspace-editor')
  })
})
