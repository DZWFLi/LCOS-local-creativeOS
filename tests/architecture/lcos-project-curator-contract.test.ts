import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '../..')
const skillDir = join(root, 'packages/skills/lcos-project-curator')
const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8')
const index = readFileSync(join(skillDir, 'skill.index.yaml'), 'utf8')
const fixtures = join(root, 'tests/skill-fixtures/lcos-project-curator')

const REQUIRED_FILES = [
  'SKILL.md',
  'skill.index.yaml',
  'routes/ingest-conversation.md',
  'routes/ingest-capture-batch.md',
  'routes/reorganize-presentation.md',
  'routes/retrieve-for-task.md',
  'routes/update-existing-project.md',
  'policies/provenance.md',
  'policies/relation-density.md',
  'policies/context-budget.md',
  'policies/destructive-change.md',
  'policies/dedupe.md',
  'recipes/conversation-to-nodes.md',
  'recipes/capture-batch-to-project.md',
  'recipes/selection-reorganize.md',
  'cli/search.md',
  'cli/curation-apply.md',
  'cli/presentation.md',
  'cli/read.md',
  'diagnostics/preflight.md',
  'diagnostics/verify-ingest.md',
  'diagnostics/verify-reorganize.md',
  'diagnostics/verify-retrieval.md',
  'failures/index.md',
  'evals/README.md',
]

describe('lcos-project-curator contract (Phase F, V2 indexed runtime)', () => {
  it('SKILL.md stays under the 2K-token budget (~6KB) and the index declares reference budgets', () => {
    expect(skill.length).toBeLessThan(6_500)
    expect(index).toContain('budget:')
    expect(index).toContain('max_reference_files:')
    expect(index).toContain('max_reference_chars:')
  })

  it('has explicit trigger → intent routing and Selection as a first-class input', () => {
    expect(skill).toContain('整理进 LCOS')
    expect(skill).toContain('沉淀到 LCOS')
    expect(skill).toContain('当前 Selection')
    for (const intent of [
      'ingest_conversation',
      'ingest_capture_batch',
      'reorganize',
      'retrieve_for_task',
      'update_existing_project',
    ]) {
      expect(index).toContain(`${intent}:`)
    }
    expect(readFileSync(join(skillDir, 'routes/reorganize-presentation.md'), 'utf8')).toContain('Selection')
  })

  it('hard rule: never creates or dispatches a Managed Run', () => {
    expect(skill).toContain('绝不创建 Managed Run')
    expect(skill).not.toContain('create_lcos_run')
    expect(skill).not.toContain('dispatch_lcos_run')
  })

  it('hard rule: search before create and bounded source scope', () => {
    expect(skill).toContain('Search before create：没搜过就建节点 = 违规。')
    expect(skill).toContain('超预算必须说明为什么')
    expect(readFileSync(join(skillDir, 'routes/ingest-conversation.md'), 'utf8')).toContain('Search before create：同内容重复 = 更新/reuse，不新开节点。')
  })

  it('requires agent provenance and evidenceRefs on agent relations', () => {
    expect(skill).toContain('role: agent')
    const provenance = readFileSync(join(skillDir, 'policies/provenance.md'), 'utf8')
    expect(provenance).toContain('origin（user/agent/system）')
    expect(provenance).toContain('evidenceRefs')
  })

  it('ships the required indexed modules', () => {
    for (const file of REQUIRED_FILES) {
      expect(readFileSync(join(skillDir, file), 'utf8').length).toBeGreaterThan(100)
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
