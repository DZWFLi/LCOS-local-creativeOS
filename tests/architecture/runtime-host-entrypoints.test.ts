import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = join(__dirname, '../..')

describe('Runtime Host entrypoints', () => {
  it('starts the Bridge HTTP service for a bare npm run bridge', () => {
    const source = readFileSync(join(repositoryRoot, 'scripts/light-bridge.mjs'), 'utf8')

    expect(source).toContain("bridgeArgs.length === 0 ? ['serve'] : bridgeArgs")
    expect(source).toContain('LCOS_BRIDGE_RUNTIME_ROOT: runtimeRoot')
  })

  it('keeps the Windows tray single-instance and worktree-relative', () => {
    const source = readFileSync(join(repositoryRoot, 'scripts/runtime-host-tray.ps1'), 'utf8')

    expect(source).toContain('Join-Path $PSScriptRoot ".."')
    expect(source).toContain('LCOS_Runtime_Host_Tray_v1')
    expect(source).toContain('$tray.Add_DoubleClick')
    expect(source).toContain('Invoke-LcosDevAndWait "dev:stop"')
  })

  it('binds the tray to the Launcher lifecycle', () => {
    const source = readFileSync(join(repositoryRoot, 'scripts/dev-launcher.mjs'), 'utf8')

    expect(source).toContain('function spawnTray()')
    expect(source).toContain('trayPid: lcosTrayPids()[0] ?? null')
    expect(source).toContain('state.trayPid = tray.pid')
    expect(source).toContain('state.bridgePid, state.orchestratorPid, state.trayPid')
    expect(source).toContain('ensureCodexSkill()')
    expect(source).toContain('ensureCodexMcp()')
  })

  it('starts and owns the Codex orchestrator with the Runtime Host', () => {
    const source = readFileSync(join(repositoryRoot, 'scripts/dev-launcher.mjs'), 'utf8')

    expect(source).toContain('function spawnCodexOrchestrator()')
    expect(source).toContain("startService('orchestrator')")
    expect(source).toContain('state.orchestratorPid = services.orchestrator.pid')
    expect(source).toContain('state.bridgePid, state.orchestratorPid, state.trayPid')
  })

  it('does not put non-ASCII menu literals in a Windows PowerShell 5.1 script', () => {
    const source = readFileSync(join(repositoryRoot, 'scripts/runtime-host-tray.ps1'), 'utf8')
    const executableLines = source
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n')

    expect(executableLines).toMatch(/ConvertFrom-Json '\{.*\\u6253.*\}'/)
    expect(executableLines).not.toMatch(/[^\x00-\x7F]/)
  })

  it('never forces packaged Electron utility children into Node CLI mode', () => {
    const source = readFileSync(join(repositoryRoot, 'apps/desktop/src/runtime-supervisor.mjs'), 'utf8')

    expect(source).toContain('export function utilityEnvironment')
    expect(source).toContain('delete env.ELECTRON_RUN_AS_NODE')
    expect(source).not.toContain("ELECTRON_RUN_AS_NODE: '1'")
    expect(source.match(/env: utilityEnvironment\(/g)?.length).toBe(3)
  })
})
