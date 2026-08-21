import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const skillRoot = join(root, 'packages/skills')
const manifestPath = join(skillRoot, 'managed-skills.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { schemaVersion: number; skills: string[] }
const index = readFileSync(join(skillRoot, 'index.md'), 'utf8')
const spec = readFileSync(join(skillRoot, 'SKILL_SPEC.md'), 'utf8')
const installer = readFileSync(join(root, 'scripts/install-lcos-codex-skill.mjs'), 'utf8')

function frontmatter(text: string): string {
  const match = text.match(/^---\n([\s\S]*?)\n---/)
  return match?.[1] ?? ''
}

describe('LCOS SKILL_SPEC v2 managed contract', () => {
  it('has one managed manifest for the seven canonical runtime skills', () => {
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.skills).toHaveLength(7)
    expect(new Set(manifest.skills).size).toBe(manifest.skills.length)
    expect(installer).toContain('managed-skills.json')
    expect(installer).toContain('managedSkillsData.skills')
  })

  it('keeps every managed root Skill small and metadata-complete', () => {
    for (const name of manifest.skills) {
      const skill = readFileSync(join(skillRoot, name, 'SKILL.md'), 'utf8')
      const fm = frontmatter(skill)
      expect(Buffer.byteLength(skill, 'utf8'), `${name} root size`).toBeLessThan(6_000)
      for (const field of ['name:', 'description:', 'role:', 'version:', 'estimatedTokens:', 'readOrder:']) {
        expect(fm, `${name} missing ${field}`).toContain(field)
      }
    }
  })

  it('documents Simple/Indexed structures and the 5K overhead discipline', () => {
    expect(spec).toContain('Simple Skill')
    expect(spec).toContain('Indexed Skill')
    expect(spec).toContain('Hard Cap ≤ 5K tokens')
    expect(spec).toContain('Saved Context ≠ ActiveContext')
  })

  it('keeps the role index aligned with the managed manifest', () => {
    for (const name of manifest.skills) {
      expect(index, `index missing ${name}`).toContain(`\`${name}\``)
    }
    expect(index).not.toContain('未托管（~/.codex，待迁移）')
  })
})
