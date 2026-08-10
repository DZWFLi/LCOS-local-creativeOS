import { describe, expect, it } from 'vitest'

import { visualFamilyFor } from '../src/features/presentation/visualFamily'

describe('visualFamily (Phase C C7)', () => {
  it('maps artifact kinds and MIME mechanically', () => {
    expect(visualFamilyFor({ artifactKind: 'image' })).toBe('image')
    expect(visualFamilyFor({ mimeType: 'text/markdown' })).toBe('document')
    expect(visualFamilyFor({ artifactKind: 'pdf' })).toBe('document')
    expect(visualFamilyFor({ mimeType: 'text/plain' })).toBe('text')
  })

  it('recognizes conversation, skill, url and run/output without title regex', () => {
    expect(visualFamilyFor({ artifactId: 'artifact-conv-c7d34880' })).toBe('conversation')
    expect(visualFamilyFor({ title: 'lcos-project-context SKILL.md' })).toBe('skill')
    expect(visualFamilyFor({ title: 'https://example.com' })).toBe('url')
    expect(visualFamilyFor({ kind: 'process' })).toBe('run')
    expect(visualFamilyFor({ sourceRunId: 'run-1', managed: true })).toBe('output')
  })

  it('does not branch on legacy node kinds or feedback title words', () => {
    expect(visualFamilyFor({ kind: 'decision' })).toBe('unknown')
    expect(visualFamilyFor({ title: 'feedback notes' })).toBe('unknown')
    expect(visualFamilyFor({ title: 'session notes' })).toBe('unknown')
  })
})
