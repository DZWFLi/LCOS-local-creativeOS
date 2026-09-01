import {
  centeredSpatialIndexOffsets,
  layoutCenteredSpatialIndex,
  resolveTopSpatialIndexOwner,
} from '../apps/web/src/features/spatial/centeredSpatialIndex.ts'

const assert = (condition, message) => { if (!condition) throw new Error(message) }

assert(resolveTopSpatialIndexOwner({ searchActive: true, focusActive: true, colorPinCount: 4 }) === 'search', 'Search must own the slot over Focus/Pin')
assert(resolveTopSpatialIndexOwner({ searchActive: false, focusActive: true, colorPinCount: 4 }) === 'focus', 'Focus must own the slot over Color Pin')
assert(resolveTopSpatialIndexOwner({ searchActive: false, focusActive: false, colorPinCount: 4 }) === 'color-pin', 'real Color Pin truth should own idle slot')
assert(resolveTopSpatialIndexOwner({ searchActive: false, focusActive: false, colorPinCount: 0 }) === 'none', 'no real index content means no placeholder slot')

for (let count = 1; count <= 7; count += 1) {
  const offsets = centeredSpatialIndexOffsets(count)
  assert(offsets.length === count, `count ${count} must have ${count} offsets`)
  const center = offsets.reduce((sum, point) => sum + point.x, 0) / offsets.length
  assert(Math.abs(center) < 0.001, `count ${count} must stay centered, got ${center}`)
  assert(Math.max(...offsets.map((point) => Math.abs(point.y))) <= 30, `count ${count} must stay shallow`)
}

const overflow = layoutCenteredSpatialIndex(Array.from({ length: 10 }, (_, index) => ({ id: `i${index}`, label: `Item ${index}` })))
assert(overflow.visibleItems.length === 6, 'overflow must reserve one of seven primary constellation slots for +N')
assert(overflow.overflowCount === 4, 'overflow count mismatch')
assert(overflow.overflowOffset !== undefined, 'overflow must live in the same centered constellation')
const overflowCenter = [...overflow.visibleItems.map((item) => item.x), overflow.overflowOffset.x].reduce((sum, x) => sum + x, 0) / 7
assert(Math.abs(overflowCenter) < 0.001, 'overflow constellation must remain center-balanced')

console.log('A25-3 centered spatial index primitive smoke: PASS')
