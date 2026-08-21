import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const source = readFileSync(join(root, 'tools/codex-orchestrator/watch.mjs'), 'utf8')
const library = readFileSync(join(root, 'tools/codex-orchestrator/watch-lib.mjs'), 'utf8')
const powershell = readFileSync(join(root, 'tools/codex-orchestrator/watch.ps1'), 'utf8')
const runner = readFileSync(join(root, 'tools/codex-orchestrator/run-codex-task.mjs'), 'utf8')
const skillInstaller = readFileSync(join(root, 'scripts/install-lcos-codex-skill.mjs'), 'utf8')

describe('Codex orchestrator operational guards', () => {
  it('discovers projects and preferred sessions from Local Core without sessions.json', () => {
    expect(source).toContain("core('/projects')")
    expect(source).toContain('/provider-sessions/codex')
    expect(source).not.toContain('sessions.json')
    expect(source).not.toContain('resume --last')
  })

  it('keeps one active task per project while allowing bounded cross-project concurrency', () => {
    expect(source).toContain('new ProjectTaskPool(concurrency)')
    expect(source).toContain('LCOS_ORCHESTRATOR_CONCURRENCY')
    expect(library).toContain('#activeProjects')
    expect(library).toContain("!this.#activeProjects.has(item.projectId)")
  })

  it('binds only the session id emitted by the Codex process', () => {
    expect(source).toContain('run-codex-task.mjs')
    expect(runner).toContain('session_id')
    expect(runner).toContain('thread_id')
    expect(runner).toContain('LCOS_CODEX_RESULT:')
    expect(source).not.toContain('Get-LatestCodexSessionId')
  })

  it('only records success after a recoverable Bridge outcome is observed', () => {
    expect(runner).toContain('closureObserved')
    expect(runner).toContain('closure_not_observed')
    expect(runner).toContain('sessionInvalid')
    expect(source).toContain('marker?.closureObserved === true')
    expect(source).toContain("saveBinding(project.id, sessionId, item.runId, 'stale'")
  })

  it('has a runner timeout, finite retry budget and atomic persisted state', () => {
    expect(source).toContain('LCOS_ORCHESTRATOR_RUNNER_TIMEOUT_MS')
    expect(source).toContain('LCOS_ORCHESTRATOR_MAX_ATTEMPTS')
    expect(source).toContain('exhausted')
    expect(source).toContain('writeJsonAtomic')
    expect(library).toContain('.partial')
  })

  it('supports non-mutating one-shot diagnostics and a thin PowerShell entrypoint', () => {
    expect(source).toContain('LCOS_ORCHESTRATOR_ONCE')
    expect(source).toContain('LCOS_ORCHESTRATOR_DRY_RUN')
    expect(source).toContain('if (once)')
    expect(powershell).toContain('watch.mjs')
    expect(powershell).not.toContain('Invoke-RestMethod')
  })

  it('recovers stale single-instance locks without killing unrelated processes', () => {
    expect(source).toContain("open(lockFile, 'wx')")
    expect(source).toContain('process.kill(pid, 0)')
    expect(source).toContain("rm(lockFile, { force: true })")
    expect(source).not.toContain('taskkill.exe /IM node.exe')
  })

  it('installs the canonical LCOS skill globally without overwriting unmanaged skills', () => {
    expect(skillInstaller).toContain("join(codexHome, 'skills')")
    expect(skillInstaller).toContain("join(sourceDirectory, 'SKILL.md')")
    expect(skillInstaller).toContain('Refusing to overwrite an unmanaged Codex skill')
    expect(skillInstaller).toContain('managed-by-lcos.json')
  })
})
