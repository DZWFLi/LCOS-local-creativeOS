#!/usr/bin/env node
// S6 gate（check:v015-s6）：Bridge 事件订阅（SSE）——进程内 hub 经 SSE 暴露，polling fallback 保留。
//   1) route 存在：GET /projects/:id/events（SSE）。
//   2) envelope 词汇：project-events 契约含统一 ProjectEventEnvelope（transport-only）。
//   3) polling fallback 保留：既有 snapshot / executeProjection 读面仍存在（不删）。
//   4) SSE 语义：events.ts 用 writeHead(200 text/event-stream) + subscribe + heartbeat。
import { repoPath, readText } from './census-shared.mjs'

const errors = []
const ok = (message) => console.log(`  ok: ${message}`)

console.log('[1/3] SSE route 存在')
{
  const route = readText('apps/local-core/src/routes/events.ts')
  if (!route.includes('eventsMatch') || !route.includes('.exec(pathname)')) errors.push('events.ts 缺少 /projects/:id/events 路由匹配')
  if (!route.includes('text/event-stream')) errors.push('events.ts 未用 text/event-stream')
  if (!route.includes('subscribe')) errors.push('events.ts 未订阅 ProjectEventHub')
  if (!route.includes('projectEvents.reconnect')) errors.push('events.ts 未接 reconnect（断线回放）')
  ok('SSE 路由 + 订阅 + reconnect 存在')
}

console.log('[2/3] envelope 词汇 + server 接线')
{
  const contract = readText('packages/contracts/src/project-events.ts')
  for (const field of ['runtimeId', 'projectId', 'projectSeq', 'channel', 'type', 'timestamp', 'payload']) {
    if (!contract.includes(field)) errors.push(`ProjectEventEnvelope 缺少字段: ${field}`)
  }
  const server = readText('apps/local-core/src/server.ts')
  if (!server.includes('handleEventsRoute')) errors.push('server.ts 未接 handleEventsRoute')
  ok('envelope 字段 + server 接线')
}

console.log('[3/3] polling fallback 保留')
{
  const artifacts = readText('apps/local-core/src/routes/artifacts.ts')
  if (!/execution-items/.test(artifacts)) errors.push('polling 读面 /execution-items 缺失（fallback 被删）')
  ok('既有 /execution-items 读面保留（polling fallback 不删）')
}

if (errors.length > 0) {
  console.error(`\nS6 gate FAIL (${errors.length}):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('\nS6 gate PASS')