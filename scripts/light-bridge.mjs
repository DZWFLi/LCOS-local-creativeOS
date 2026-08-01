import { spawn } from 'node:child_process'
import { delimiter, resolve } from 'node:path'

const python = process.env.LCOS_LIGHT_BRIDGE_PYTHON
  ?? (process.platform === 'win32' ? 'python.exe' : 'python3')
const sourceRoot = resolve(process.cwd(), 'tools/light-bridge-kernel/src')
const child = spawn(python, ['-m', 'lcos_bridge', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PYTHONPATH: [sourceRoot, process.env.PYTHONPATH].filter(Boolean).join(delimiter),
  },
  stdio: 'inherit',
  windowsHide: true,
})

child.once('error', (error) => {
  process.stderr.write(`Light Bridge failed to start: ${error.message}\n`)
  process.exitCode = 1
})
child.once('exit', (code, signal) => {
  if (signal !== null) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})
