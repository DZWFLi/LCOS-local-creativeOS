import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const serializer = read('apps/local-core/src/context-prompt-serializer.ts')
const manifest = read('apps/local-core/src/context-manifest-service.ts')
const runtime = read('apps/local-core/src/runtime-adapter.ts')
const app = read('apps/local-core/src/runtime-application-service.ts')
const web = read('apps/web/src/App.tsx')
const contracts = read('packages/contracts/src/context-prompt.ts')
const executor = read('tools/lcos-agent/executor-tools.mjs')
const tests = [
  'context-prompt-determinism.test.ts',
  'context-prompt-presentation-independence.test.ts',
  'context-prompt-runtime-metadata.test.ts',
  'context-prompt-membership.test.ts',
  'context-prompt-fragment-anchor.test.ts',
  'context-prompt-revision.test.ts',
  'context-prompt-file-relocation.test.ts',
].map((name) => read(`apps/local-core/tests/${name}`)).join('\n')

const checks = [
  ['versioned deterministic serializer contract', contracts.includes("CONTEXT_PROMPT_SERIALIZER_V1 = 'context-prompt-v1'")],
  ['stable/dynamic prompt split', serializer.includes('stablePrefix') && serializer.includes('dynamicTail')],
  ['NFC normalization + LF canonicalization', serializer.includes("normalize('NFC')") && serializer.includes("replace(/\\r\\n?/g, '\\n')")],
  ['stable SHA-256 identity', serializer.includes("createHash('sha256')") && serializer.includes('stablePrefixHash')],
  ['Saved Context has dedicated stable identity', manifest.includes('Saved Context gets a dedicated identity') && manifest.includes('stableItemIdentities')],
  ['Saved Context is compiled before task-local material', manifest.indexOf('for (const stable of input.stableContextItems') < manifest.indexOf("if (target) await appendArtifact(target, 'target')")],
  ['presentation state absent from stable serializer', !serializer.includes('viewport') && !serializer.includes('position:') && !serializer.includes('cursor')],
  ['physical path absent from stable serializer', !serializer.includes('observedPath') && !serializer.includes('absolutePath')],
  ['Active selection is dynamic only', serializer.includes('## Current Focus') && contracts.includes('focusArtifactIds')],
  ['Saved Context route wired into Run creation', app.includes('#savedContextItems') && app.includes('stableContextItems') && app.includes('savedContextId')],
  ['Web passes Saved Context without adding cache GUI', web.includes('savedContextIdForRun') && !web.includes('Cache-Friendly') && !web.includes('缓存命中')],
  ['RuntimeInputPack records compiled prompt + telemetry', runtime.includes('compiledContextPrompt') && runtime.includes('contextCacheTelemetry')],
  ['Agent executor run-context path uses compiled context prompt', executor.includes('/context-prompt')],
  ['provider-neutral telemetry', contracts.includes('providerCachedTokens?') && contracts.includes('providerInputTokens?')],
  ['no provider-specific cache runtime', !serializer.includes('cache_control') && !serializer.includes('anthropic') && !serializer.includes('openai')],
  ['fragment anchor participates in stable item serialization', serializer.includes('anchor: ${scalar(item.sourceAnchor)}') && manifest.includes('sourceAnchorOverride')],
  ['same-revision dynamic body deduped from stable baseline', serializer.includes('stableRevisionKeys')],
  ['seven cache contract test families present', ['determinism', 'presentation independence', 'runtime metadata split', 'Saved Context membership', 'fragment anchors', 'revision semantics', 'file relocation'].every((needle) => tests.includes(needle))],
]

let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed += 1
}
console.log(`\nContext Cache-Friendly static gate: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
