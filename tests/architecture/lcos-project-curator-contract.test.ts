import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const skillDir = join(root, 'packages/skills/lcos-project-curator')
const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8')
const fixtures = join(root, 'tests/skill-fixtures/lcos-project-curator')

describe('lcos-project-curator contract (Phase F)', () => {
  it('SKILL.md stays under the 2K-token budget (~6KB)', () => {
    expect(skill.length).toBeLessThan(6_500)
    expect(skill).toContain('estimatedTokens: 1300')
  })

  it('has explicit triggers and non-triggers', () => {
    expect(skill).toContain('整理进 LCOS')
    expect(skill).toContain('沉淀到 LCOS')
    expect(skill).toContain('整理当前 Selection')
    expect(skill).toContain('不用：普通代码实现、普通创意写作')
  })

  it('hard rule: never creates or dispatches a Managed Run', () => {
    expect(skill).toContain('不创建、不 dispatch Managed Run')
    expect(skill).not.toContain('create_lcos_run')
    expect(skill).not.toContain('dispatch_lcos_run')
  })

  it('hard rule: search before create and bounded source scope', () => {
    expect(skill).toContain('任何 create 之前必须先 search')
    expect(skill).toContain('不擅自扩大 Source Scope')
  })

  it('requires origin=agent and evidenceRefs on agent relations', () => {
    expect(skill).toContain('origin=agent')
    const relationGuidelines = readFileSync(join(skillDir, 'references/relation-guidelines.md'), 'utf8')
    expect(relationGuidelines).toContain('"origin": "agent"')
    expect(relationGuidelines).toContain('evidenceRefs')
  })

  it('ships the required references', () => {
    for (const file of [
      'source-reading.md', 'curation-principles.md', 'cli-recipes.md',
      'presentation-guidelines.md', 'relation-guidelines.md', 'dedupe-and-update.md',
      'verification.md', 'failure-catalog.md', 'examples.md',
    ]) {
      expect(readFileSync(join(skillDir, 'references', file), 'utf8').length).toBeGreaterThan(100)
    }
  })

  it('golden fixtures cover all cases with invariant-based expectations', () => {
    for (const caseName of ['case1-rounds', 'case2-session', 'case3-duplicate', 'case4-selection', 'case5-references', 'case6-long-project']) {
      const expectation = JSON.parse(readFileSync(join(fixtures, caseName, 'expectation.json'), 'utf8')) as { invariants: Record<string, boolean> }
      expect(expectation.invariants).toBeTruthy()
    }
    const case1 = JSON.parse(readFileSync(join(fixtures, 'case1-rounds/expectation.json'), 'utf8')) as { nodeCount: { min: number; max: number } }
    expect(case1.nodeCount.max).toBeLessThanOrEqual(3)
  })
})
