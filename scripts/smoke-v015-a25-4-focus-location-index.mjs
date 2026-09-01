import {
  projectFocusKindLabel,
  projectFocusLocationForIndexId,
  projectFocusLocationIndexItems,
} from '../apps/web/src/features/focus/projectFocusIndex.ts'

const assert = (condition, message) => { if (!condition) throw new Error(message) }

const locations = [
  {
    key: 'canvas:root',
    kind: 'canvas',
    label: '主画布',
    memberViewIds: ['a'],
    matchedViewIds: ['a'],
    matchedEntityRefs: [],
    matchedCount: 1,
    totalCount: 1,
    exact: true,
    active: true,
  },
  {
    key: 'context:c1',
    kind: 'context',
    ownerId: 'c1',
    label: '竞品 Context',
    memberViewIds: ['a', 'b'],
    matchedViewIds: ['a', 'b'],
    matchedEntityRefs: [],
    matchedCount: 2,
    totalCount: 2,
    exact: true,
  },
]

const items = projectFocusLocationIndexItems(locations)
assert(items.length === 2, 'each real Focus location must become one index item')
assert(items[0].id === 'canvas:root' && items[0].active === true, 'active occurrence must remain active in presentation')
assert(items[0].shortLabel === '主画布', 'short label should preserve real location identity')
assert(items[0].label.includes('Main') && items[0].label.includes('主画布'), 'hover/title label should include surface context')
assert(items[1].count === 2, 'multi-match location should preserve matched count')
assert(projectFocusKindLabel('workflow') === 'Workflow', 'kind label mismatch')
assert(projectFocusLocationForIndexId(locations, 'context:c1')?.ownerId === 'c1', 'index activation must resolve back to existing Focus truth')
assert(projectFocusLocationForIndexId(locations, 'missing') === null, 'unknown presentation id must fail closed')

console.log('A25-4 Focus location index adapter smoke: PASS')
