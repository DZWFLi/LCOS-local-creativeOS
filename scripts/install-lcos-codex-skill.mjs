import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { homedir } from 'node:os'

const repositoryRoot = resolve(import.meta.dirname, '..')
const codexHome = resolve(process.env.CODEX_HOME || join(homedir(), '.codex'))
const skillsRoot = join(codexHome, 'skills')
const managedSkills = [
  'lcos-project-context',
  'lcos-project-curator',
  'lcos-skill-author',
  'lcos-executor-run',
  'local-creative-os-backend-flow',
  'local-creative-os-frontend-loop',
  'workbuddy-orchestrator',
]

const fail = (message) => { console.error(message); process.exit(1) }

function installSkill(name) {
  const sourceDirectory = join(repositoryRoot, 'packages', 'skills', name)
  const sourceFile = join(sourceDirectory, 'SKILL.md')
  const destination = join(skillsRoot, name)
  const destinationFile = join(destination, 'SKILL.md')
  const markerFile = join(destination, 'managed-by-lcos.json')
  const sourceLabel = `packages/skills/${name}`

  if (!existsSync(sourceFile)) fail(`LCOS canonical skill is missing: ${sourceFile}`)
  if (!destination.startsWith(`${skillsRoot}\\`) && !destination.startsWith(`${skillsRoot}/`)) {
    fail(`Refusing to install outside the Codex skills root: ${destination}`)
  }

  const normalizedRelative = (path) => relative(sourceDirectory, path).split(sep).join('/')
  const sourceFiles = () => {
    const found = []
    const walk = (directory) => {
      for (const entry of readdirSync(directory)) {
        const path = join(directory, entry)
        const info = statSync(path)
        if (info.isDirectory()) walk(path)
        else if (info.isFile() && entry !== 'managed-by-lcos.json') found.push(path)
      }
    }
    walk(sourceDirectory)
    return found.sort((left, right) => normalizedRelative(left).localeCompare(normalizedRelative(right)))
  }
  const treeHash = (files) => {
    const hash = createHash('sha256')
    for (const file of files) {
      hash.update(normalizedRelative(file), 'utf8')
      hash.update('\0')
      hash.update(readFileSync(file))
      hash.update('\0')
    }
    return hash.digest('hex')
  }
  const destinationMatches = (files) => files.every((sourcePath) => {
    const target = join(destination, normalizedRelative(sourcePath))
    return existsSync(target) && readFileSync(target).equals(readFileSync(sourcePath))
  })

  const files = sourceFiles()
  const sourceHash = treeHash(files)
  if (existsSync(destinationFile) && existsSync(markerFile)) {
    try {
      const marker = JSON.parse(readFileSync(markerFile, 'utf8'))
      if (marker.sourceHash === sourceHash && destinationMatches(files)) {
        console.log(`LCOS Codex skill is current: ${destination}`)
        return
      }
    } catch {}
  }
  if (existsSync(destination) && !existsSync(markerFile)) {
    if (destinationMatches(files)) {
      // 目标内容与仓库完全一致：收养为托管 skill，避免后续漂移。
      writeFileSync(markerFile, `${JSON.stringify({
        schemaVersion: 2,
        name,
        source: sourceLabel,
        sourceHash,
        installedAt: new Date().toISOString(),
      }, null, 2)}\n`)
      console.log(`LCOS Codex skill adopted: ${destination}`)
      return
    }
    fail(`Refusing to overwrite an unmanaged Codex skill: ${destination}`)
  }

  mkdirSync(skillsRoot, { recursive: true })
  const temporary = `${destination}.install-${process.pid}`
  const backup = `${destination}.backup-${process.pid}`
  rmSync(temporary, { recursive: true, force: true })
  rmSync(backup, { recursive: true, force: true })
  mkdirSync(temporary, { recursive: true })
  for (const sourcePath of files) {
    const target = join(temporary, normalizedRelative(sourcePath))
    mkdirSync(dirname(target), { recursive: true })
    cpSync(sourcePath, target)
  }
  writeFileSync(join(temporary, 'managed-by-lcos.json'), `${JSON.stringify({
    schemaVersion: 2,
    source: sourceLabel,
    sourceHash,
    files: files.map(normalizedRelative),
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
}

for (const name of managedSkills) installSkill(name)
console.log(`Installed ${managedSkills.length} LCOS skills: ${managedSkills.join(', ')}`)
