import { ProjectTaskPool, TaskTimeoutError, nextRetryDelay, parseRunnerMarker, runWithTimeout } from '../tools/codex-orchestrator/watch-lib.mjs'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const pool = new ProjectTaskPool(2)
const events = []
const started = Date.now()
pool.enqueue('project-a', 'run-a1', async () => { events.push('a1:start'); await sleep(180); events.push('a1:end') })
pool.enqueue('project-a', 'run-a2', async () => { events.push('a2:start'); await sleep(10); events.push('a2:end') })
pool.enqueue('project-b', 'run-b1', async () => { events.push('b1:start'); await sleep(25); events.push('b1:end') })
await pool.idle()
const duration = Date.now() - started
if (events.indexOf('b1:start') > events.indexOf('a1:end')) throw new Error('Different projects did not run concurrently.')
if (events.indexOf('a2:start') < events.indexOf('a1:end')) throw new Error('Same project ran concurrently.')
if (duration > 500) throw new Error(`Task pool blocked unexpectedly for ${duration}ms.`)

const timeoutPool = new ProjectTaskPool(2)
const timeoutEvents = []
const timeoutStarted = Date.now()
timeoutPool.enqueue('project-hung', 'run-hung', () => runWithTimeout(async () => {
  timeoutEvents.push('hung:start')
  await new Promise(() => {})
}, 80, { onTimeout: () => timeoutEvents.push('hung:timeout') }))
timeoutPool.enqueue('project-other', 'run-other', async () => { timeoutEvents.push('other:start'); await sleep(10); timeoutEvents.push('other:end') })
timeoutPool.enqueue('project-hung', 'run-after-timeout', async () => { timeoutEvents.push('after:start'); await sleep(5); timeoutEvents.push('after:end') })
await timeoutPool.idle()
const timeoutDuration = Date.now() - timeoutStarted
if (!timeoutEvents.includes('hung:timeout')) throw new Error('Hung task did not hit the timeout guard.')
if (timeoutEvents.indexOf('other:start') > timeoutEvents.indexOf('hung:timeout')) throw new Error('A hung project blocked another project.')
if (timeoutEvents.indexOf('after:start') < timeoutEvents.indexOf('hung:timeout')) throw new Error('Same project resumed before the timed-out task released its slot.')
if (timeoutDuration > 350) throw new Error(`Timeout guard released the task pool too slowly: ${timeoutDuration}ms.`)
let timeoutError
try { await runWithTimeout(() => new Promise(() => {}), 5) } catch (error) { timeoutError = error }
if (!(timeoutError instanceof TaskTimeoutError) || timeoutError.code !== 'TASK_TIMEOUT') throw new Error('Timeout helper did not return the canonical error.')

if (nextRetryDelay(0) !== 30_000 || nextRetryDelay(3) !== 240_000) throw new Error('Retry backoff contract changed.')
const marker = parseRunnerMarker('noise\nLCOS_CODEX_RESULT:{"closureObserved":true,"sessionId":"abc"}\n')
if (!marker?.closureObserved || marker.sessionId !== 'abc') throw new Error('Runner marker parser failed.')
process.stdout.write(`${JSON.stringify({ ok: true, duration, events, timeoutDuration, timeoutEvents }, null, 2)}\n`)
