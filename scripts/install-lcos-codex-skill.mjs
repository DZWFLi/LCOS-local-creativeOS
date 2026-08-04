import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'

const repositoryRoot = resolve(import.meta.dirname, '..')
const sourceFile = join(repositoryRoot, 'packages', 'skills', 'lcos-project-context', 'SKILL.md')
const codexHome = resolve(process.env.CODEX_HOME || join(homedir(), '.codex'))
const skillsRoot = join(codexHome, 'skills')
const destination = join(skillsRoot, 'lcos-project-context')
const destinationFile = join(destination, 'SKILL.md')
const markerFile = join(destination, 'managed-by-lcos.json')

const hash = (value) => createHash('sha256').update(value, 'utf8').digest('hex')
const fail = (message) => { console.error(message); process.exit(1) }

if (!existsSync(sourceFile)) fail(`LCOS canonical skill is missing: ${sourceFile}`)
if (!destination.startsWith(`${skillsRoot}\\`) && !destination.startsWith(`${skillsRoot}/`)) {
  fail(`Refusing to install outside the Codex skills root: ${destination}`)
}

const source = readFileSync(sourceFile, 'utf8')
const sourceHash = hash(source)
if (existsSync(destinationFile) && existsSync(markerFile)) {
  try {
    const marker = JSON.parse(readFileSync(markerFile, 'utf8'))
    if (marker.sourceHash === sourceHash && readFileSync(destinationFile, 'utf8') === source) {
      console.log(`LCOS Codex skill is current: ${destination}`)
      process.exit(0)
    }
  } catch {}
}
if (existsSync(destination) && !existsSync(markerFile)) {
  fail(`Refusing to overwrite an unmanaged Codex skill: ${destination}`)
}

mkdirSync(skillsRoot, { recursive: true })
const temporary = `${destination}.install-${process.pid}`
const backup = `${destination}.backup-${process.pid}`
rmSync(temporary, { recursive: true, force: true })
rmSync(backup, { recursive: true, force: true })
mkdirSync(temporary, { recursive: true })
writeFileSync(join(temporary, 'SKILL.md'), source, 'utf8')
writeFileSync(join(temporary, 'managed-by-lcos.json'), `${JSON.stringify({
  schemaVersion: 1,
  source: 'packages/skills/lcos-project-context/SKILL.md',
  sourceHash,
}, null, 2)}\n`, 'utf8')

try {
  if (existsSync(destination)) renameSync(destination, backup)
  renameSync(temporary, destination)
  rmSync(backup, { recursive: true, force: true })
  console.log(`Installed LCOS Codex skill: ${destination}`)
} catch (error) {
  rmSync(temporary, { recursive: true, force: true })
  if (!existsSync(destination) && existsSync(backup)) renameSync(backup, destination)
  fail(error instanceof Error ? error.message : String(error))
}
