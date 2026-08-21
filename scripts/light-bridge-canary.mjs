import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = process.cwd()
const python = process.env.LCOS_LIGHT_BRIDGE_PYTHON
if (!python) {
  throw new Error('LCOS_LIGHT_BRIDGE_PYTHON must point to a Python environment with lcos-light-bridge installed.')
}

const evidenceRoot = await mkdtemp(join(tmpdir(), 'lcos-light-bridge-canary-'))
const runtimeRoot = join(evidenceRoot, 'bridge-runtime')
const sampleRoot = join(evidenceRoot, 'sample-project')
const databaseRoot = join(evidenceRoot, 'local-core')
await Promise.all([mkdir(runtimeRoot), mkdir(sampleRoot), mkdir(databaseRoot)])

const children = new Set()

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  children.add(child)
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
  child.once('exit', () => children.delete(child))
  return child
}

async function stop(child) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 3_000)),
  ])
}

async function json(url, init) {
  const response = await fetch(url, init)
  const value = await response.json()
  if (!response.ok || value.ok === false) {
    throw new Error(`${init?.method ?? 'GET'} ${url} failed: ${JSON.stringify(value)}`)
  }
  return value
}

async function waitFor(url) {
  let lastError
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await json(url)
    } catch (error) {
      lastError = error
      await new Promise((resolveWait) => setTimeout(resolveWait, 250))
    }
  }
  throw lastError
}

function post(url, body) {
  return json(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

let bridge
let core
try {
  bridge = start(python, [
    '-m', 'lcos_bridge', 'serve',
    '--runtime-root', runtimeRoot,
    '--host', '127.0.0.1',
    '--port', '43122',
  ])
  const health = await waitFor('http://127.0.0.1:43122/health')

  core = start(process.execPath, [resolve(root, 'apps/local-core/dist/index.js')], {
    LOCAL_CORE_DB_PATH: join(databaseRoot, 'metadata.sqlite'),
    LOCAL_CORE_MVP_SAMPLE_ROOT: sampleRoot,
    LOCAL_CORE_TEST_PORT: '43123',
    LOCAL_CORE_BRIDGE_CONTRACT_MODE: 'auto',
    LOCAL_CORE_BRIDGE_PROJECT_ID: 'mvp-fast-build',
  })
  await waitFor('http://127.0.0.1:43123/health')

  const artifacts = await json('http://127.0.0.1:43123/projects/disposable-mvp-sample/artifacts')
  const target = artifacts.value.find((artifact) => artifact.kind === 'markdown')
  if (!target) throw new Error('Disposable Sample Project has no Markdown target.')

  const created = await post('http://127.0.0.1:43123/projects/disposable-mvp-sample/runs', {
    instruction: 'Create a canary Markdown draft through Light Bridge.',
    targetArtifactId: target.id,
  })
  const runId = created.value.review.run.id
  const taskId = created.value.review.binding?.externalTaskId
  if (!taskId) throw new Error('Local Core did not persist a RuntimeBinding.')

  const taskResponse = await json(`http://127.0.0.1:43122/v1/tasks/${taskId}`)
  const outputPath = taskResponse.task.envelope.expectedOutputs[0].absolutePath
  const claimed = await post('http://127.0.0.1:43122/v1/tasks/claim-next', {
    provider: 'workbuddy',
    workerId: 'canary-runner',
  })
  if (claimed.task?.taskId !== taskId) throw new Error('One-shot Runner claimed another task.')
  await post(`http://127.0.0.1:43122/v1/tasks/${taskId}/running`, {
    workerId: 'canary-runner',
  })
  await writeFile(outputPath, `# Light Bridge Canary\n\nRun: ${runId}\n`, 'utf8')
  await post(`http://127.0.0.1:43122/v1/tasks/${taskId}/result`, {
    contractVersion: 'bridge-result-v1',
    taskId,
    lcosRunId: runId,
    providerStatus: 'review',
    summary: 'Canary runner produced the declared Markdown output.',
    changedFiles: [{ path: outputPath, action: 'modified', role: 'primary', mediaType: 'text/markdown' }],
    warnings: [],
    suggestedNextActions: ['Review and Accept the pending LCOS Draft.'],
  })

  await stop(bridge)
  bridge = start(python, [
    '-m', 'lcos_bridge', 'serve',
    '--runtime-root', runtimeRoot,
    '--host', '127.0.0.1',
    '--port', '43122',
  ])
  const restored = await waitFor(`http://127.0.0.1:43122/v1/tasks/by-run/${runId}`)
  if (restored.task.taskId !== taskId) throw new Error('Bridge restart did not recover the same Task.')

  const synced = await post(`http://127.0.0.1:43123/runs/${runId}/sync`, {})
  if (synced.value.providerError) throw new Error(synced.value.providerError.message)
  const artifactReturn = synced.value.review.returns.find((item) => item.status === 'pending_review')
  if (!artifactReturn) throw new Error('Local Core did not create a pending ArtifactReturn.')

  const accepted = await post(
    `http://127.0.0.1:43123/artifact-returns/${artifactReturn.id}/accept`,
    { expectedBaseRevisionId: synced.value.review.run.targetRevisionId },
  )
  if (accepted.value.artifactReturn.status !== 'adopted') throw new Error('ArtifactReturn was not adopted.')

  process.stdout.write(`${JSON.stringify({
    ok: true,
    bridgeVersion: health.bridgeVersion,
    contractVersion: health.primaryContractVersion,
    runId,
    taskId,
    recoveredTaskId: restored.task.taskId,
    artifactReturnId: artifactReturn.id,
    artifactReturnStatus: accepted.value.artifactReturn.status,
    currentRevisionId: accepted.value.currentRevision.id,
    evidenceRoot,
  }, null, 2)}\n`)
} finally {
  await Promise.all([...children].map(stop))
}
