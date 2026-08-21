#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.env.LCOS_REPO_ROOT || resolve(import.meta.dirname, '..'))
const skillsRoot = join(root, 'packages', 'skills')
const manifestFile = join(skillsRoot, 'managed-skills.json')
const fail = (message) => { console.error(`FAIL ${message}`); process.exitCode = 1 }
const pass = (message) => console.log(`PASS ${message}`)

if (!existsSync(manifestFile)) {
  fail(`missing ${manifestFile}`)
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.skills) || manifest.skills.length === 0) {
  fail('invalid managed-skills.json')
  process.exit(1)
}

const requiredFields = ['name', 'description', 'role', 'version', 'estimatedTokens', 'readOrder']
const allowedRoles = new Set(['agent', 'executor', 'dev-frontend', 'dev-backend', 'orchestrator'])

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const result = {}
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/)
    if (m) result[m[1]] = m[2].trim()
  }
  return result
}

for (const name of manifest.skills) {
  const dir = join(skillsRoot, name)
  const entry = join(dir, 'SKILL.md')
  if (!existsSync(entry)) { fail(`${name}: missing SKILL.md`); continue }
  const text = readFileSync(entry, 'utf8')
  const bytes = statSync(entry).size
  if (bytes >= 6000) fail(`${name}: root SKILL.md ${bytes} bytes >= 6000`)
  else pass(`${name}: root ${bytes} bytes`)

  const fm = parseFrontmatter(text)
  if (!fm) { fail(`${name}: missing frontmatter`); continue }
  for (const field of requiredFields) if (!(field in fm)) fail(`${name}: missing frontmatter ${field}`)
  if (fm.name && fm.name.replace(/^['"]|['"]$/g, '') !== name) fail(`${name}: frontmatter name mismatch ${fm.name}`)
  if (fm.role && !allowedRoles.has(fm.role.replace(/^['"]|['"]$/g, ''))) fail(`${name}: invalid role ${fm.role}`)

  const relativeRefs = [...text.matchAll(/`((?:references|routes|policies|recipes|cli|diagnostics|failures)\/[A-Za-z0-9._-]+\.md)`/g)].map((m) => m[1])
  for (const relative of new Set(relativeRefs)) {
    const target = join(dir, relative)
    if (!existsSync(target)) fail(`${name}: missing referenced file ${relative}`)
  }
}

const curatorIndex = join(skillsRoot, 'lcos-project-curator', 'skill.index.yaml')
if (existsSync(curatorIndex)) {
  const text = readFileSync(curatorIndex, 'utf8')
  const candidates = [...text.matchAll(/(?:entry:\s*|\-\s+)((?:routes|policies|recipes|cli|diagnostics|failures)\/[A-Za-z0-9._-]+\.md)/g)].map((m) => m[1])
  for (const relative of new Set(candidates)) {
    const target = join(skillsRoot, 'lcos-project-curator', relative)
    if (!existsSync(target)) fail(`curator index missing referenced file: ${relative}`)
  }
  pass(`curator index references checked: ${new Set(candidates).size}`)
}

const index = readFileSync(join(skillsRoot, 'index.md'), 'utf8')
for (const name of manifest.skills) {
  if (!index.includes(`\`${name}\``)) fail(`index.md missing ${name}`)
}
if (index.includes('未托管（~/.codex，待迁移）')) fail('index.md still contains PASS8 unmanaged drift')
else pass('index managed status is converged')

if (!process.exitCode) console.log(`PASS LCOS Skill v2 static validation · ${manifest.skills.length} managed skills`)
