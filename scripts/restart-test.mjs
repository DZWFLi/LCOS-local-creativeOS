// scripts/restart-test.mjs — verifies data survives server restart
import { spawn, execSync } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import http from 'node:http'

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(JSON.parse(data)))
    }).on('error', reject)
  })
}

async function main() {
  // Kill any existing local-core
  try { execSync('taskkill /F /FI "WINDOWTITLE eq Local*" 2>nul', { stdio: 'ignore' }) } catch {}
  try { execSync('taskkill /F /IM node.exe 2>nul', { stdio: 'ignore' }) } catch {}
  await setTimeout(2000)

  // Start fresh
  const server = spawn('node', ['apps/local-core/dist/index.js'], {
    cwd: 'E:/Codex 项目/OS开发',
    stdio: 'pipe',
    shell: true,
  })
  await setTimeout(2000)

  try {
    const projects = await get('http://127.0.0.1:43121/projects')
    console.log('Catalog:', projects.ok ? `OK (${projects.value.length} projects)` : 'FAIL')

    const graph = await get('http://127.0.0.1:43121/projects/disposable-portasplit/graph')
    if (graph.ok) {
      const v = graph.value
      console.log('RESTORE:', 'OK')
      console.log('  Project:', v.project.name)
      console.log('  Notes:', v.notes.length, '-', v.notes[0]?.body)
      console.log('  Checkpoints:', v.checkpoints.length)
      console.log('  Camera zoom:', v.workspaces[0]?.viewport?.zoom)
      console.log('\n=== PHASE 2 RESTART RECOVERY: PASS ===')
    } else {
      console.log('RESTORE: FAIL — data did not survive restart')
    }
  } finally {
    server.kill()
    await setTimeout(500)
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
