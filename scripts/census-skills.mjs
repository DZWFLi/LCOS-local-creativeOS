#!/usr/bin/env node
// S0 census-skills：从 packages/skills/*/SKILL.md frontmatter 机器提取 Skill 能力。
// 形态（S0-1 摸底实测）：YAML frontmatter（name/description/role/version/estimatedTokens/readOrder）。
// requiredCapabilities：frontmatter 中如实读取；未声明则记 requiredCapabilitiesDeclared: false（不冒充）。
import { existsSync } from 'node:fs'
import { listFiles, readText } from './census-shared.mjs'

function parseFrontmatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)
  if (match === null) return {}
  const fields = {}
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([\w-]+):\s*(.*)$/.exec(line)
    if (field !== null) fields[field[1]] = field[2].trim()
  }
  return fields
}

export function censusSkills() {
  const skillDirs = listFiles('packages/skills', { recursive: true, extension: 'SKILL.md' })
  const items = []

  for (const skillMd of skillDirs) {
    const source = readText(skillMd)
    const fields = parseFrontmatter(source)
    const declared = Object.prototype.hasOwnProperty.call(fields, 'requiredCapabilities')
    items.push({
      package: skillMd.split('/').at(-2),
      name: fields.name ?? null,
      version: fields.version ?? null,
      role: fields.role ?? null,
      estimatedTokens: fields.estimatedTokens !== undefined ? Number(fields.estimatedTokens) : null,
      requiredCapabilities: declared ? (fields.requiredCapabilities ?? '') : [],
      requiredCapabilitiesDeclared: declared,
      file: skillMd,
    })
  }

  items.sort((a, b) => (a.package ?? '').localeCompare(b.package ?? ''))
  return {
    source: 'packages/skills/*/SKILL.md',
    total: items.length,
    declaredRequiredCapabilities: items.filter((item) => item.requiredCapabilitiesDeclared).length,
    items,
  }
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('census-skills.mjs')) {
  console.log(JSON.stringify(censusSkills(), null, 2))
}
