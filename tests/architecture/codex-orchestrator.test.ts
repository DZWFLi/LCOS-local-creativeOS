import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(__dirname, '../../tools/codex-orchestrator/watch.ps1'),
  'utf8',
)
const runner = readFileSync(
  join(__dirname, '../../tools/codex-orchestrator/run-codex-task.mjs'),
  'utf8',
)
const skillInstaller = readFileSync(
  join(__dirname, '../../scripts/install-lcos-codex-skill.mjs'),
  'utf8',
)

describe('Codex orchestrator operational guards', () => {
  it('discovers projects from Local Core without requiring sessions.json', () => {
    expect(source).toContain("Invoke-RestMethod -Uri 'http://127.0.0.1:43121/projects'")
    expect(source).toContain('return @{ projects = @{} }')
    expect(source).not.toContain('找不到会话注册表')
  })

  it('binds only the session id emitted by the Codex process', () => {
    expect(source).toContain('run-codex-task.mjs')
    expect(runner).toContain('session_id')
    expect(runner).toContain('thread_id')
    expect(runner).toContain('LCOS_CODEX_RESULT:')
    expect(source).not.toContain('Get-LatestCodexSessionId')
    expect(source).not.toContain('resume --last')
  })

  it('only records dispatch success after a recoverable Bridge outcome is observed', () => {
    expect(runner).toContain('closureObserved')
    expect(runner).toContain('closure_not_observed')
    expect(runner).toContain('sessionInvalid')
    expect(source).toContain('保留首选会话并等待有限重试')
    expect(source).toContain('首选会话已明确失效')
  })

  it('supports non-mutating one-shot diagnostics', () => {
    expect(source).toContain("$runOnce = $env:LCOS_ORCHESTRATOR_ONCE -eq '1'")
    expect(source).toContain("$dryRun = $env:LCOS_ORCHESTRATOR_DRY_RUN -eq '1'")
    expect(source).toContain('if ($runOnce) { break }')
    expect(source).toContain('if ($dispatched -and -not $dryRun)')
  })

  it('recovers stale process locks and persists cooldown by run', () => {
    expect(source).toContain('Get-Process -Id $ownerPid')
    expect(source).toContain('lastDispatchByRun = $dispatches')
    expect(source).not.toContain('lastDispatchBySession = @{}')
  })

  it('installs the canonical LCOS skill globally without overwriting unmanaged skills', () => {
    expect(skillInstaller).toContain("join(codexHome, 'skills')")
    expect(skillInstaller).toContain("'packages', 'skills', 'lcos-project-context', 'SKILL.md'")
    expect(skillInstaller).toContain('Refusing to overwrite an unmanaged Codex skill')
    expect(skillInstaller).toContain('managed-by-lcos.json')
  })
})
