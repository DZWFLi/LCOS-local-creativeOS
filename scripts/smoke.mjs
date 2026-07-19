import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const origin = 'http://127.0.0.1:4173'
const child = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let output = ''
child.stdout.on('data', (chunk) => { output += chunk.toString() })
child.stderr.on('data', (chunk) => { output += chunk.toString() })

async function waitForPreview() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Preview exited early (${child.exitCode}).\n${output}`)
    try {
      const response = await fetch(origin)
      if (response.ok) return response
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Preview did not become ready.\n${output}`)
}

try {
  const response = await waitForPreview()
  const html = await response.text()
  if (!html.includes('<div id="root"></div>')) throw new Error('Preview HTML is missing the React root.')

  const assetPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
  if (assetPaths.length === 0) throw new Error('Preview HTML contains no built assets.')

  for (const assetPath of assetPaths) {
    const asset = await fetch(new URL(assetPath, origin))
    if (!asset.ok) throw new Error(`Built asset is unavailable: ${assetPath} (${asset.status})`)
  }

  console.log(`Smoke passed: preview and ${assetPaths.length} built assets are reachable.`)
} finally {
  child.kill()
}
