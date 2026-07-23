import { spawn } from 'node:child_process'

const npmCli = process.env.npm_execpath
const npmCommand = npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm'
const children = new Set()
let stopping = false

function stop(child) {
  if (child.pid === undefined || child.exitCode !== null) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    return
  }
  child.kill('SIGTERM')
}

function start(script) {
  const args = npmCli ? [npmCli, 'run', script] : ['run', script]
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    windowsHide: true,
  })
  children.add(child)
  child.once('exit', (code, signal) => {
    children.delete(child)
    if (stopping) return
    stopping = true
    for (const sibling of children) stop(sibling)
    process.exitCode = code ?? (signal ? 1 : 0)
  })
  return child
}

function shutdown() {
  if (stopping) return
  stopping = true
  for (const child of children) stop(child)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

start('dev:local-core')
start('dev:web')
