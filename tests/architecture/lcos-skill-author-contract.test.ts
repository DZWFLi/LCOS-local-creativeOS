import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const skillDir = join(root, 'packages/skills/lcos-skill-author')
const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8')

const requiredParts = ['ROUTE', 'INPUT BUDGET', 'METHOD', 'CONSTRAINT', 'DIAGNOSTIC', 'FAILURE CATALOG', 'FALLBACK']

describe('lcos-skill-author contract (V4.3 / SKILL_SPEC v2)', () => {
  it('stays under the root Skill budget and declares v2 metadata', () => {
    expect(Buffer.byteLength(skill, 'utf8')).toBeLessThan(6_000)
    expect(skill).toContain('version: 1.1.0')
    expect(skill).toContain('estimatedTokens: 1000')
    expect(skill).toContain('readOrder:')
  })

  it('triggers only on reusable method mining intent', () => {
    expect(skill).toContain('把这些炼成 Skill')
    expect(skill).toContain('把经验做成 Skill')
    expect(skill).toContain('普通文档/Context/Workflow 整理（Curator）')
  })

  it('keeps the seven-part method contract', () => {
    for (const part of requiredParts) expect(skill).toContain(part)
  })

  it('supports Simple and Indexed skills without introducing a Skill Domain Runtime', () => {
    expect(skill).toContain('Simple Skill')
    expect(skill).toContain('Indexed Skill')
    expect(skill).toContain('不新建 Skill Domain Runtime')
    expect(existsSync(join(skillDir, 'references/indexed-skill.md'))).toBe(true)
  })

  it('separates managed system skills from ordinary user-authored skills', () => {
    expect(skill).toContain('普通用户 Skill 不得默认写进 `packages/skills/`')
    expect(skill).toContain('停在 validated package')
    expect(existsSync(join(skillDir, 'references/install-boundaries.md'))).toBe(true)
  })

  it('requires provenance and controlled promotion instead of silent self-modification', () => {
    expect(skill).toContain('derived from')
    expect(skill).toContain('不能因为一次失败自动改生产 Skill')
  })
})
