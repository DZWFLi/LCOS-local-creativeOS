import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { stripTypeScriptTypes } from 'node:module'

const root = process.cwd()
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lcos-a25-8-'))
const writeModule = (sourcePath, outName, replacements = []) => {
  let source = fs.readFileSync(path.join(root, sourcePath), 'utf8')
  for (const [from, to] of replacements) source = source.replaceAll(from, to)
  const output = stripTypeScriptTypes(source, { mode: 'strip' })
  fs.writeFileSync(path.join(tmp, outName), output)
}

writeModule('apps/web/src/features/spatial/spatialCamera.ts', 'spatialCamera.mjs')
writeModule('apps/web/src/features/spatial/spatialHitTest.ts', 'spatialHitTest.mjs')
writeModule('apps/web/src/features/spatial/edgePinGeometry.ts', 'edgePinGeometry.mjs', [
  ["'./spatialCamera'", "'./spatialCamera.mjs'"],
  ["'./spatialHitTest'", "'./spatialHitTest.mjs'"],
])

const cameraModule = await import(`${pathToFileURL(path.join(tmp, 'spatialCamera.mjs')).href}?v=1`)
const edgeModule = await import(`${pathToFileURL(path.join(tmp, 'edgePinGeometry.mjs')).href}?v=1`)
const { spatialSafeViewportWorldBounds } = cameraModule
const { edgePinForWorldBounds, edgePinEdgeForPlacement } = edgeModule

const assert = (condition, message) => { if (!condition) throw new Error(message) }
const camera = { x: 0, y: 0, zoom: 1 }
const viewport = { width: 1200, height: 800 }
const safeInsets = { left: 100, right: 400, top: 50, bottom: 100 }
const safe = spatialSafeViewportWorldBounds(camera, viewport, safeInsets)

assert(safe.x === 100 && safe.y === 50, 'safe world origin must follow active local insets')
assert(safe.width === 700 && safe.height === 650, 'safe world size must exclude occupied viewport edges')

const visible = edgePinForWorldBounds({ x: 320, y: 260, width: 80, height: 60 }, camera, viewport, 18, safeInsets)
assert(visible.isOnscreen === true, 'target inside active region must stay onscreen')

const behindWorkView = edgePinForWorldBounds({ x: 930, y: 260, width: 80, height: 60 }, camera, viewport, 18, safeInsets)
assert(behindWorkView.isOnscreen === false, 'target hidden by right occupied region must become offscreen')
assert(Math.abs(behindWorkView.screenX - 782) < 0.001, 'right locator must attach to active right edge, not browser edge')
assert(edgePinEdgeForPlacement(behindWorkView, viewport, 18, safeInsets) === 'right', 'right occupied target must classify on active right edge')

const behindLeftRail = edgePinForWorldBounds({ x: 10, y: 240, width: 40, height: 40 }, camera, viewport, 18, safeInsets)
assert(behindLeftRail.isOnscreen === false, 'target hidden by left occupied region must become offscreen')
assert(Math.abs(behindLeftRail.screenX - 118) < 0.001, 'left locator must attach to active left edge')
assert(edgePinEdgeForPlacement(behindLeftRail, viewport, 18, safeInsets) === 'left', 'left hidden target must classify on active left edge')

const legacy = edgePinForWorldBounds({ x: 930, y: 260, width: 80, height: 60 }, camera, viewport)
assert(legacy.isOnscreen === true, 'zero-inset fallback must preserve legacy physical viewport behavior')

console.log('A25-8 active-edge Map Locator geometry smoke: 8/8 PASS')
