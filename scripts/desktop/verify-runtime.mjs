#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const runtime = join(root, 'apps', 'desktop', 'resources', 'runtime')
const required = [
  ['Web build', join(runtime, 'web', 'index.html')],
  ['Local Core', join(runtime, 'local-core', 'dist', 'index.js')],
  ['Office thumbnail script', join(runtime, 'local-core', 'scripts', 'shell-thumb.ps1')],
  ['Domain runtime', join(runtime, 'node_modules', '@local-creative-os', 'domain', 'dist', 'index.js')],
  ['PDF.js runtime', join(runtime, 'node_modules', 'pdfjs-dist', 'build', 'pdf.mjs')],
  ['NAPI canvas scope', join(runtime, 'node_modules', '@napi-rs', 'canvas', 'package.json')],
  ['sqlite-vec', join(runtime, '.runtime', 'sqlite-vec', process.platform === 'win32' ? 'vec0.dll' : 'vec0.dll')],
  ['Codex orchestrator', join(runtime, 'tools', 'codex-orchestrator', 'watch.mjs')],
  ['LCOS MCP', join(runtime, 'tools', 'lcos-agent', 'mcp-server.mjs')],
  ['LCOS executor MCP', join(runtime, 'tools', 'lcos-agent', 'mcp-executor-server.mjs')],
  ['Codex skills', join(runtime, 'packages', 'skills', 'lcos-executor-run', 'SKILL.md')],
  ['MCP installer', join(runtime, 'scripts', 'install-lcos-codex-mcp.mjs')],
  ['Skill installer', join(runtime, 'scripts', 'install-lcos-codex-skill.mjs')],
]

let failed = false
for (const [label, path] of required) {
  const ok = existsSync(path)
  console.log(`${ok ? '✓' : '✗'} ${label}: ${path}`)
  if (!ok) failed = true
}

const manifestPath = join(runtime, 'desktop-runtime-manifest.json')
if (!existsSync(manifestPath)) {
  console.error(`✗ Runtime manifest missing: ${manifestPath}`)
  failed = true
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  console.log(`✓ Runtime manifest schema=${String(manifest.schemaVersion)} bridge=${String(manifest.bridge)}`)
  if (process.platform === 'win32' && manifest.bridge !== 'bundled') {
    console.error('✗ Windows desktop release requires the bundled Light Bridge; system-Python fallback is dev-only.')
    failed = true
  }
}

if (process.platform === 'win32') {
  const bridge = join(runtime, 'bridge', 'lcos-bridge', 'lcos-bridge.exe')
  if (!existsSync(bridge) || statSync(bridge).size < 100_000) {
    console.error(`✗ Bundled bridge executable missing/invalid: ${bridge}`)
    failed = true
  } else console.log(`✓ Bundled bridge executable: ${(statSync(bridge).size / 1024 / 1024).toFixed(1)} MiB`)
}

if (failed) process.exit(1)
console.log('Desktop runtime bundle verification PASS')
