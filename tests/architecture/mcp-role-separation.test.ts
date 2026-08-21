import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const mcp = readFileSync(join(root, 'tools/lcos-agent/mcp-server.mjs'), 'utf8')
const runtime = readFileSync(join(root, 'tools/lcos-agent/lib/mcp-stdio-runtime.mjs'), 'utf8')
const bridge = readFileSync(join(root, 'tools/light-bridge-kernel/src/lcos_bridge/transport/http_api.py'), 'utf8')
const core = readFileSync(join(root, 'apps/local-core/src/index.ts'), 'utf8')
const installer = readFileSync(join(root, 'scripts/install-lcos-codex-mcp.mjs'), 'utf8')

describe('Gate F Plus MCP and Bridge boundaries', () => {
  it('keeps executor tools behind the dedicated MCP role', () => {
    expect(mcp).toContain('LCOS_MCP_ROLE === "executor"')
    expect(mcp).toContain('EXECUTOR_TOOL_NAMES')
    expect(mcp).toContain('local-creative-os')
    expect(mcp).toContain('lcos-executor')
  })

  it('keeps protocol transport outside LCOS business dispatch', () => {
    expect(mcp).toContain('serveStdioMcp')
    expect(runtime).toContain('tools/list')
    expect(runtime).toContain('tools/call')
    expect(runtime).not.toContain('/projects/')
    expect(runtime).not.toContain('/executor/')
  })

  it('uses Light Bridge only through Local Core REST', () => {
    expect(core).toContain('RestBridgeRuntimeClient')
    expect(core).not.toContain('BridgeMcp')
    expect(bridge).not.toContain("'/mcp'")
    expect(bridge).not.toContain('"/mcp"')
    expect(mcp).not.toContain('LCOS_BRIDGE_URL')
  })

  it('backs up Codex config and only removes the exact retired ai_bridge signature', () => {
    expect(installer).toContain('backupConfig()')
    expect(installer).toContain('looksExactLegacyAiBridge')
    expect(installer).toContain("removeManaged(codex, 'ai_bridge', { exactLegacy: true })")
    expect(installer).toContain('startup_timeout_sec')
    expect(installer).toContain('tool_timeout_sec')
  })
})
