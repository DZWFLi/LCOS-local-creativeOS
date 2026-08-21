import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const dir = join(root, 'packages/skills/lcos-project-curator')
const skill = readFileSync(join(dir, 'SKILL.md'), 'utf8')
const index = readFileSync(join(dir, 'skill.index.yaml'), 'utf8')

const newRoutes = [
  'context_build',
  'context_edit',
  'workflow_build',
  'workflow_edit',
  'filesystem_organize',
  'handoff_continue',
]

describe('lcos-project-curator V4.3 inheritance contract', () => {
  it('keeps the existing V2 indexed runtime and no-Run boundary', () => {
    expect(skill).toContain('lcos skill resolve lcos-project-curator')
    expect(skill).toContain('绝不创建 Managed Run')
    expect(skill).toContain('lcos skill trace')
    expect(index).toContain('ingest_conversation:')
    expect(index).toContain('reorganize:')
  })

  it('adds Context / Workflow / filesystem / handoff routes without parallel top-level skills', () => {
    for (const route of newRoutes) {
      expect(index).toContain(`${route}:`)
    }
    for (const file of ['context-build.md', 'context-edit.md', 'workflow-build.md', 'workflow-edit.md', 'filesystem-organize.md', 'handoff-continue.md']) {
      expect(existsSync(join(dir, 'routes', file))).toBe(true)
    }
  })

  it('freezes Saved Context versus ActiveContext ownership', () => {
    expect(skill).toContain('Saved Context ≠ ActiveContext')
    expect(readFileSync(join(dir, 'policies/surface-identity.md'), 'utf8')).toContain('ActiveContext')
  })

  it('evolves the existing reorganize proposal instead of inventing a parallel layout system', () => {
    const route = readFileSync(join(dir, 'routes/reorganize-presentation.md'), 'utf8')
    expect(route).toContain('ReorganizeProposal')
    expect(route).toContain('PASS8')
    expect(route).toContain('Keep / Revert')
    expect(route).toContain('不得声称 live pending review 已存在')
  })

  it('keeps filesystem organization fail-closed until Core capability exists', () => {
    const route = readFileSync(join(dir, 'routes/filesystem-organize.md'), 'utf8')
    const policy = readFileSync(join(dir, 'policies/filesystem-safety.md'), 'utf8')
    expect(route).toContain('plan-only')
    expect(policy).toContain('Move-Item')
    expect(policy).toContain('不得用 shell 顶上')
  })
})
