#!/usr/bin/env node
// 校验 tools/lcos-runtime/capabilities.json：端口唯一、引用文件存在、生命周期顺序合法。
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const registryPath = resolve(import.meta.dirname, '..', 'tools', 'lcos-runtime', 'capabilities.json')
const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
const errors = []

if (registry.schemaVersion !== 1) errors.push('schemaVersion must be 1')

const serviceNames = Object.keys(registry.services ?? {})
const ports = Object.entries(registry.services ?? {}).map(([name, svc]) => [name, svc.port]).filter(([, port]) => port !== undefined)
const seen = new Map()
for (const [name, port] of ports) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) errors.push(`${name}.port must be an integer in 1024-65535`)
  if (seen.has(port)) errors.push(`port ${port} is shared by ${seen.get(port)} and ${name}`)
  else seen.set(port, name)
}

for (const key of ['startOrder', 'stopOrder']) {
  const order = registry.lifecycle?.[key] ?? []
  for (const name of order) {
    if (!serviceNames.includes(name)) errors.push(`lifecycle.${key} references unknown service ${name}`)
  }
}

const fileRefs = [
  ...Object.entries(registry.services ?? {}).map(([, svc]) => svc.script).filter(Boolean),
  ...Object.entries(registry.mcp ?? {}).map(([, mcp]) => mcp.launcher).filter(Boolean),
]
for (const rel of fileRefs) {
  if (!existsSync(resolve(import.meta.dirname, '..', rel))) errors.push(`referenced file missing: ${rel}`)
}

if (!Array.isArray(registry.ownership) || registry.ownership.length === 0) errors.push('ownership must be a non-empty array')

if (errors.length > 0) {
  console.error('Capability registry invalid:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
console.log(`Capability registry OK: ${serviceNames.length} services, ${ports.length} ports, ${registry.mcp ? Object.keys(registry.mcp).length : 0} MCP roles`)
