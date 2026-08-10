import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const skillDir = join(root, 'packages/skills/lcos-skill-author')
const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8')

describe('lcos-skill-author contract (Phase H)', () => {
  it('stays under the 2K-token budget', () => {
    expect(skill.length).toBeLessThan(6_000)
    expect(skill).toContain('estimatedTokens: 1100')
  })

  it('triggers only on skill-mining intent', () => {
    expect(skill).toContain('把这些炼成 Skill')
    expect(skill).toContain('把经验做成 Skill')
    expect(skill).toContain('不用：普通文档整理（那是 Curator）')
  })

  it('mandates the seven-part method structure', () => {
    for (const part of ['ROUTE', 'INPUT BUDGET', 'METHOD', 'CONSTRAINT', 'DIAGNOSTIC', 'FAILURE CATALOG', 'FALLBACK']) {
      expect(skill).toContain(part)
    }
  })

  it('does not introduce a Skill Domain Runtime or GUI builder', () => {
    expect(skill).toContain('不新建 LCOS 顶层模块 / Skill Domain Runtime')
    expect(skill).not.toContain('SkillBuilder')
  })

  it('requires provenance registration after install', () => {
    expect(skill).toContain('derived from')
    expect(skill).toContain('Resource/Artifact')
  })
})
