import { resolveActiveSpatialViewport } from '../apps/web/src/features/spatial/activeSpatialViewport.ts'

const assert = (condition, message) => { if (!condition) throw new Error(message) }
const env = (input) => resolveActiveSpatialViewport({ viewportRect: { left: 0, top: 0, width: 1200, height: 800 }, ...input })

{
  const result = env({ staticInsets: { left: 76, right: 28, top: 24, bottom: 72 } })
  assert(result.activeSpatialRect.left === 76, 'static left inset mismatch')
  assert(result.activeSpatialRect.width === 1096, 'static width mismatch')
  assert(result.activeSpatialRect.height === 704, 'static height mismatch')
  assert(result.topCenterAnchor.x === 624, 'top center must use active spatial center')
}

{
  const result = env({
    staticInsets: { left: 76, right: 28, top: 24, bottom: 72 },
    persistentOccupiedRects: [{ left: 720, top: 0, width: 480, height: 800, edge: 'right' }],
  })
  assert(result.activeSpatialRect.left === 76, 'right Work View must not move left edge')
  assert(result.activeSpatialRect.width === 644, 'right Work View must shrink active spatial width')
  assert(result.activeInsets.right === 480, 'right active inset should match occupied region')
  assert(result.topCenterAnchor.x === 398, 'top center must re-center in remaining spatial region')
}

{
  const result = env({ persistentOccupiedRects: [{ left: 0, top: 0, width: 340, height: 800 }] })
  assert(result.activeSpatialRect.left === 340, 'tall left edge rect should infer left occupancy')
}

{
  const result = env({ persistentOccupiedRects: [{ left: 0, top: 690, width: 1200, height: 110 }] })
  assert(result.edgeBounds.bottom === 690, 'wide bottom edge rect should infer bottom occupancy')
}

{
  const result = env({ persistentOccupiedRects: [{ left: 460, top: 220, width: 260, height: 220 }] })
  assert(result.activeSpatialRect.width === 1200 && result.activeSpatialRect.height === 800, 'floating center rect must not redefine active spatial viewport')
}

{
  const result = env({ persistentOccupiedRects: [{ left: 900, top: 0, width: 300, height: 300, edge: 'right' }] })
  assert(result.edgeBounds.right === 900, 'explicit edge must disambiguate corner occupancy')
}

{
  const first = env({ persistentOccupiedRects: [
    { left: 0, top: 0, width: 180, height: 800, edge: 'left' },
    { left: 940, top: 0, width: 260, height: 800, edge: 'right' },
  ] })
  const second = env({ persistentOccupiedRects: [
    { left: 940, top: 0, width: 260, height: 800, edge: 'right' },
    { left: 0, top: 0, width: 180, height: 800, edge: 'left' },
  ] })
  assert(JSON.stringify(first.activeSpatialRect) === JSON.stringify(second.activeSpatialRect), 'occupied rect ordering must not change geometry')
}

console.log('A25-1 activeSpatialViewport geometry smoke: PASS')
