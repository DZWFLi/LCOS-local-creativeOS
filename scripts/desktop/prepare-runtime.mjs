#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const target = join(root, 'apps', 'desktop', 'resources', 'runtime')

function requirePath(path, label) {
  if (!existsSync(path)) throw new Error(`${label} missing: ${path}`)
  return path
}
function copy(source, destination) {
  requirePath(source, 'desktop runtime input')
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination, { recursive: true, force: true })
}

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })

copy(join(root, 'dist'), join(target, 'web'))
copy(join(root, 'apps', 'local-core', 'dist'), join(target, 'local-core', 'dist'))
copy(join(root, 'apps', 'local-core', 'package.json'), join(target, 'local-core', 'package.json'))

copy(join(root, 'packages', 'domain', 'dist'), join(target, 'node_modules', '@local-creative-os', 'domain', 'dist'))
copy(join(root, 'packages', 'domain', 'package.json'), join(target, 'node_modules', '@local-creative-os', 'domain', 'package.json'))

copy(join(root, 'node_modules', 'pdfjs-dist'), join(target, 'node_modules', 'pdfjs-dist'))
copy(join(root, 'node_modules', '@napi-rs'), join(target, 'node_modules', '@napi-rs'))

copy(join(root, '.runtime', 'sqlite-vec'), join(target, '.runtime', 'sqlite-vec'))
copy(join(root, 'scripts', 'ocr'), join(target, 'scripts', 'ocr'))
copy(join(root, 'tools', 'codex-orchestrator'), join(target, 'tools', 'codex-orchestrator'))
copy(join(root, 'tools', 'lcos-agent'), join(target, 'tools', 'lcos-agent'))
copy(join(root, 'packages', 'skills'), join(target, 'packages', 'skills'))
copy(join(root, 'scripts', 'install-lcos-codex-mcp.mjs'), join(target, 'scripts', 'install-lcos-codex-mcp.mjs'))
copy(join(root, 'scripts', 'install-lcos-codex-skill.mjs'), join(target, 'scripts', 'install-lcos-codex-skill.mjs'))

const bridgeBundle = join(root, 'tools', 'light-bridge-kernel', 'dist-desktop', 'lcos-bridge')
if (existsSync(bridgeBundle)) copy(bridgeBundle, join(target, 'bridge', 'lcos-bridge'))
else copy(join(root, 'tools', 'light-bridge-kernel'), join(target, 'bridge-source'))

writeFileSync(join(target, 'desktop-runtime-manifest.json'), JSON.stringify({
  schemaVersion: 1,
  preparedAt: new Date().toISOString(),
  web: 'web/index.html',
  localCore: 'local-core/dist/index.js',
  bridge: existsSync(join(target, 'bridge', 'lcos-bridge')) ? 'bundled' : 'python-fallback',
  orchestrator: 'tools/codex-orchestrator/watch.mjs',
}, null, 2) + '\n')

console.log(`Desktop runtime prepared: ${target}`)
