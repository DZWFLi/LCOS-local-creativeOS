import { resolveActiveSpatialViewport, spatialEdgeBoundsWithinRect, spatialInsetsWithinRect } from '../apps/web/src/features/spatial/activeSpatialViewport.ts'

const assert = (condition, message) => { if (!condition) throw new Error(message) }

const env = resolveActiveSpatialViewport({
  viewportRect: { left: 0, top: 0, width: 1400, height: 900 },
  staticInsets: { left: 76, right: 28, top: 24, bottom: 72 },
  persistentOccupiedRects: [
    { left: 0, top: 0, width: 104, height: 900, edge: 'left' },
    { left: 1020, top: 0, width: 380, height: 900, edge: 'right' },
  ],
})

assert(env.activeSpatialRect.left === 104, 'left occupant must override smaller static inset')
assert(env.activeSpatialRect.width === 916, 'right occupant must shrink usable viewport')
assert(env.topCenterAnchor.x === 562, 'top center must use remaining viewport center')

const canvasRect = { left: 56, top: 48, right: 1200, bottom: 828 }
const localInsets = spatialInsetsWithinRect(env, canvasRect)
assert(localInsets.left === 48, 'surface-local left inset mismatch')
assert(localInsets.right === 180, 'surface-local right inset mismatch')
assert(localInsets.top === 0, 'surface root below global top should not inherit negative top inset')
assert(localInsets.bottom === 0, 'surface root above global bottom should not inherit negative bottom inset')

const edgeBounds = spatialEdgeBoundsWithinRect(env, canvasRect)
assert(edgeBounds.left === 104, 'edge-scroll left bound must use active viewport')
assert(edgeBounds.right === 1020, 'edge-scroll right bound must use active viewport')
assert(edgeBounds.top === 48, 'edge-scroll top must clamp to surface rect')
assert(edgeBounds.bottom === 828, 'edge-scroll bottom must clamp to surface rect')

console.log('A25-2 active viewport consumer geometry smoke: PASS')
