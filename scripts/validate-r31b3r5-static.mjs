import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const domain = read('packages/domain/src/index.ts')
const core = read('apps/local-core/src/metadata-repository.ts')
const app = read('apps/web/src/App.tsx')
const spatial = read('apps/web/src/features/spatial/SpatialCanvas.tsx')
const drop = read('apps/web/src/features/spatial/semanticDrop.ts')
const handler = app.slice(app.indexOf('const directDropToProjectRailView'), app.indexOf('const addMembersToSavedContext'))
const checks = [
  ['Structural / Reference / Presentation are explicitly separated', domain.includes('only Collection containment contributes structural depth') && handler.includes('已作为引用加入 Context')],
  ['maximum structural Collection depth is 2', domain.includes('MAX_STRUCTURAL_CONTAINER_DEPTH = 2') && app.includes('structuralDepth >= MAX_STRUCTURAL_CONTAINER_DEPTH')],
  ['structural cycle and cross-type containment are rejected', domain.includes("'STRUCTURAL_CYCLE'") && domain.includes("'CROSS_TYPE_CONTAINMENT'")],
  ['Agent may create at most one new container level per action', domain.includes('MAX_AI_NEW_CONTAINER_DEPTH_PER_ACTION = 1') && domain.includes("input.actor === 'agent'")],
  ['legacy over-depth remains readable but new deepening is rejected', domain.includes('legacyOverDepthScopeIds') && domain.includes('issues.every((issue) => issue.legacy)')],
  ['Core save and mutation paths share the containment guard', core.includes('assertContainmentWrite({ previousScopes: this.get') && core.includes('actor: batch.actorKind')],
  ['inline expansion and graph traversal budgets are frozen', domain.includes('MAX_INLINE_EXPANSION_DEPTH = 1') && domain.includes('DEFAULT_GRAPH_HOPS = 1') && domain.includes('MAX_GRAPH_HOPS = 2')],
  ['Arrange / Context / Workflow surface targets are registered', ['surface:arrange','surface:context','surface:workflow'].every((id) => drop.includes(id) && spatial.includes(id))],
  ['cross-surface Drop persists stable EntityRefs', handler.includes('semanticRefsForSourceIds(sourceIds, nodes)') && handler.includes('appendExactPresentationEntityRefs')],
  ['cross-surface Drop does not create or clone structure', !handler.includes('createAggregateScopeEntity') && !handler.includes('projectViewsIntoScope')],
]

let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed += 1 }
console.log(`\n${checks.length - failed}/${checks.length} B3R5 contracts passed`)
if (failed) process.exit(1)
