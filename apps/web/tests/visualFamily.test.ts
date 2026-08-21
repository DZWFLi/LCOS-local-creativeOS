import { describe, expect, it } from 'vitest'

import { visualFamilyFor } from '../src/features/presentation/visualFamily'

describe('visualFamily (Phase C C7)', () => {
  it('maps artifact kinds and MIME mechanically', () => {
    expect(visualFamilyFor({ artifactKind: 'image' })).toBe('image')
    expect(visualFamilyFor({ mimeType: 'text/markdown' })).toBe('document')
    expect(visualFamilyFor({ artifactKind: 'pdf' })).toBe('document')
    expect(visualFamilyFor({ mimeType: 'text/plain' })).toBe('text')
  })

  it('recognizes conversation, skill, url and run/output from mechanical sources only', () => {
    expect(visualFamilyFor({ artifactId: 'artifact-conv-c7d34880' })).toBe('conversation')
    // GUI-2：skill 由文件路径判定；URL 由 resource source.kind 判定，title 一律不算。
    expect(visualFamilyFor({ observedPath: 'C:/Users/1/.codex/skills/lcos-project-context/SKILL.md' })).toBe('skill')
    expect(visualFamilyFor({ observedPath: 'C:/repo/.codex/skills/curator/SKILL.md' })).toBe('skill')
    expect(visualFamilyFor({ sourceKind: 'url' })).toBe('url')
    expect(visualFamilyFor({ artifactKind: 'link' })).toBe('url')
    expect(visualFamilyFor({ title: 'https://example.com' })).toBe('unknown')
    expect(visualFamilyFor({ title: 'lcos-project-context SKILL.md' })).toBe('unknown')
    expect(visualFamilyFor({ kind: 'process' })).toBe('run')
    expect(visualFamilyFor({ sourceRunId: 'run-1', managed: true })).toBe('output')
  })

  it('does not branch on legacy node kinds or feedback title words', () => {
    expect(visualFamilyFor({ kind: 'decision' })).toBe('unknown')
    expect(visualFamilyFor({ title: 'feedback notes' })).toBe('unknown')
    expect(visualFamilyFor({ title: 'session notes' })).toBe('unknown')
  })
})
