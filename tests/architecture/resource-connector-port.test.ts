import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const port = readFileSync(join(__dirname, '../../apps/local-core/src/connectors/connector-port.ts'), 'utf8')
const obsidian = readFileSync(join(__dirname, '../../apps/local-core/src/connectors/obsidian-connector.ts'), 'utf8')
const connectors = readFileSync(join(__dirname, '../../apps/local-core/src/routes/connectors.ts'), 'utf8')
const mcp = readFileSync(join(__dirname, '../../tools/lcos-agent/mcp-server.mjs'), 'utf8')

describe('Resource Connector Port', () => {
  it('keeps connector capabilities provider-neutral and read-only by contract', () => {
    expect(port).toContain('ResourceConnectorPort')
    expect(port).toContain('ResourceConnectorRegistry')
    expect(obsidian).toContain("access: 'read_only'")
    expect(obsidian).toContain('supportsSync: false')
  })

  it('exposes capability discovery through Core and MCP without leaking the Vault root', () => {
    expect(connectors).toContain("pathname === '/connectors'")
    expect(connectors).toContain('connectorRegistry.capabilities()')
    expect(mcp).toContain('scan_lcos_obsidian_vault')
  })
})
