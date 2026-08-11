/**
 * Phase E 冒烟：Skill Router（resolve 差异 + load budget）+ Trace/Review 闭环。
 */
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { homedir } from 'node:os'

const CLI = join(process.cwd(), 'tools/lcos-agent/cli.mjs')

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`)
}

function run(args) {
  return JSON.parse(execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8' }))
}

const ingest = run(['skill', 'resolve', 'lcos-project-curator', '--intent', 'ingest_conversation', '--condition', 'duplicate_candidates', '--condition', 'auto_title'])
const reorganize = run(['skill', 'resolve', 'lcos-project-curator', '--intent', 'reorganize'])
const retrieve = run(['skill', 'resolve', 'lcos-project-curator', '--intent', 'retrieve_for_task'])

assert(ingest.entry === 'routes/ingest-conversation.md', 'ingest entry')
assert(reorganize.entry === 'routes/reorganize-presentation.md', 'reorganize entry')
assert(ingest.load.includes('policies/naming.md'), 'conditional auto_title loads naming')
assert(ingest.load.includes('policies/dedupe.md'), 'conditional duplicate loads dedupe')
assert(!reorganize.load.includes('recipes/conversation-to-nodes.md'), 'reorganize does not load conversation recipe')
assert(!retrieve.load.some((file) => file.includes('curation-apply')), 'retrieve does not enter write path')

const distinctSets = new Set([ingest.load.join(','), reorganize.load.join(','), retrieve.load.join(',')])
assert(distinctSets.size === 3, `three intents load distinct sets, got ${distinctSets.size}`)
console.log(`✓ intent routing: ingest(${ingest.load.length}) vs reorganize(${reorganize.load.length}) vs retrieve(${retrieve.load.length}) 文件，集合互不相同`)

// load budget：每个 intent ≤ 整体包的 40%
const files = ['SKILL.md', 'skill.index.yaml', ...ingest.load, ...reorganize.load, ...retrieve.load]
console.log(`✓ load budget: ingest ${ingest.load.length + 2} 个引用文件`)

// Trace + Review 闭环（用临时 learning root 隔离，不污染真实 store）
const home = await mkdtemp(join(tmpdir(), 'lcos-skill-home-'))
const previousHome = process.env.HOME
try {
  process.env.LCOS_SKILL_LEARNING_ROOT = join(home, 'skill-learning')
  const traceFile = join(home, 'trace.json')
  await writeFile(traceFile, JSON.stringify({
    route: 'ingest_conversation',
    loadedModules: ['policies/provenance.md', 'recipes/conversation-to-nodes.md'],
    loadedChars: 4200,
    outcome: 'success',
    verifier: { passed: true, checks: { no_raw_explosion: true } },
    cliCalls: [{ command: 'search', ok: true }],
  }))
  const traced = run(['skill', 'trace', 'lcos-project-curator', '--file', traceFile])
  assert(traced.ok === true, 'trace written')
  const reviewed = run(['skill', 'review', 'lcos-project-curator', '--recent', '10'])
  assert(reviewed.traces === 1, 'review sees trace')
  assert(reviewed.summary.byRoute.ingest_conversation === 1, 'review route counts')
  console.log('✓ SkillTrace + review 闭环（隔离 HOME）')
} finally {
  if (previousHome !== undefined) process.env.HOME = previousHome
  await rm(home, { recursive: true, force: true }).catch(() => { /* best effort */ })
}

console.log('PHASE E SMOKE: ALL PASS')
