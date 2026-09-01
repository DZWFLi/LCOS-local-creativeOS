import {
  mergeProjectSearchResults,
  projectSearchAnchorLabel,
  projectSearchHumanKind,
  projectSearchResultForIndexId,
  projectSearchResultIndexItems,
} from '../apps/web/src/features/project/projectSearchIndexModel.ts'

const assert = (condition, message) => { if (!condition) throw new Error(message) }

const local = [
  { key: 'local:a', title: 'Moodboard', kind: 'artifact', sourceIds: ['view:a'] },
  { key: 'local:b', title: 'Workflow A', kind: 'workflow', sourceIds: ['view:b'] },
]
const remote = [
  { key: 'artifact:a', title: 'Moodboard remote duplicate', kind: 'artifact', sourceIds: ['view:a'], artifactId: 'a', score: .98 },
  { key: 'conversation:c', title: 'Concept review', kind: 'conversation', sourceIds: ['view:c'], locationCount: 3, matchReason: 'semantic' },
]
const merged = mergeProjectSearchResults(local, remote)
assert(merged.length === 3, 'local + remote merge must deduplicate the same view identity')
assert(merged[0]?.title === 'Moodboard', 'local exact project projection should stay ahead of its remote duplicate')

const items = projectSearchResultIndexItems(merged)
assert(items.length === 3, 'every merged result should project to one index item')
assert(items.every((item) => item.presentation === 'result'), 'Search results must use labeled-result presentation, not Color Pin marker presentation')
assert(items[0]?.hint === '项目对象', 'artifact kind hint should remain human-readable')
assert(items[1]?.hint === '工作流', 'workflow kind hint mismatch')
assert(items[2]?.count === 3, 'location count should survive as compact result metadata')
assert(projectSearchResultForIndexId(merged, 'conversation:c')?.title === 'Concept review', 'index id must resolve back to original Search truth')
assert(projectSearchAnchorLabel('pdf:p3-p5') === '第 3-5 页', 'PDF anchor label mismatch')
assert(projectSearchHumanKind('resource-link') === '来源', 'resource kind label mismatch')

console.log('A25-5 Search result index model smoke: PASS')
