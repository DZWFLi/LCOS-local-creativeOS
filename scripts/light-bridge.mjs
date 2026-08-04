import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, resolve } from 'node:path'

const candidates = process.platform === 'win32'
  ? [
      resolve(process.cwd(), 'tools/light-bridge-kernel/.venv/Scripts/python.exe'),
      resolve(process.cwd(), 'tools/light-bridge-kernel/.codex-runtime/bridge-test-venv/Scripts/python.exe'),
    ]
  : [resolve(process.cwd(), 'tools/light-bridge-kernel/.venv/bin/python')]
const python = process.env.LCOS_LIGHT_BRIDGE_PYTHON
  ?? candidates.find((candidate) => existsSync(candidate))
  ?? (process.platform === 'win32' ? 'python.exe' : 'python3')
const sourceRoot = resolve(process.cwd(), 'tools/light-bridge-kernel/src')
const runtimeRoot = process.env.LCOS_BRIDGE_RUNTIME_ROOT
  ?? resolve(process.cwd(), '.codex-runtime/bridge')
// `npm run bridge` is the development service entrypoint, so a bare invocation
// must start the HTTP server. Explicit CLI commands (doctor/task/worker/serve)
// continue to pass through unchanged.
const bridgeArgs = process.argv.slice(2)
const commandArgs = bridgeArgs.length === 0 ? ['serve'] : bridgeArgs
const child = spawn(python, ['-m', 'lcos_bridge', ...commandArgs], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PYTHONPATH: [sourceRoot, process.env.PYTHONPATH].filter(Boolean).join(delimiter),
    LCOS_BRIDGE_RUNTIME_ROOT: runtimeRoot,
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
