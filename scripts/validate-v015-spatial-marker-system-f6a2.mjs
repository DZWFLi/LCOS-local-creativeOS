#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const marker = read('apps/web/src/features/spatial/spatialMarkerSystem.ts')
const layer = read('apps/web/src/features/spatial/SpatialMarkerLayer.tsx')
const beacon = read('apps/web/src/features/spatial/SpatialBeaconLayer.tsx')
const edge = read('apps/web/src/features/spatial/CanvasEdgePinLayer.tsx')
const labels = read('apps/web/src/features/spatial/SpatialLabelSystem.ts')
const css = read('apps/web/src/spatial-marker.css')

const gates = [
  ['one marker model owns pin/cursor', marker.includes("'world-pin' | 'edge-cursor'") && marker.includes('projectSpatialMarker')],
  ['cluster is derived presentation', marker.includes("readonly kind: 'cluster'") && !marker.includes("scope: 'cluster'")],
  ['no hard 20-marker threshold', !marker.match(/(?:length|count)\s*[>=]+\s*20/) && !layer.match(/(?:length|count)\s*[>=]+\s*20/)],
  ['density clustering uses screen distance', marker.includes('markerClusterRadius') && marker.includes('Math.hypot')],
  ['priority breakout protects focus/search/beacon', marker.includes("case 'beacon'") && marker.includes("case 'focus'") && marker.includes("case 'search'") && marker.includes('breakout(marker)')],
  ['local and cross-surface scopes exist', marker.includes("'local' | 'cross-surface'") && marker.includes('spatialMarkerVisibleOnSurface')],
  ['cross-project navigation fails closed', marker.includes("reason: 'cross-project'") && marker.includes("status: 'unresolved'")],
  ['no fuzzy rebinding fields in resolver', (() => {
    const start = marker.indexOf('export async function resolveSpatialMarkerNavigation')
    const end = marker.indexOf('export interface SpatialMarkerItem', start)
    const body = marker.slice(start, end)
    return body.includes('resolver.resolve(intent.targetRef)') && !body.match(/provider|timestamp|titleMatch|label\s*:/i)
  })()],
  ['Main Context Workflow morphologies are distinct', marker.includes("surface === 'main'") && marker.includes("surface === 'context'") && marker.includes("surface === 'workflow'")],
  ['shared SpatialCanvas IDs map to surface morphology', marker.includes("case 'context-space-spatial'") && marker.includes("case 'workflow-spatial'")],
  ['hierarchical fan is semantic and bounded', marker.includes('spatialMarkerFanGroups') && marker.includes('groupKey') && marker.includes('maxGroups = 5')],
  ['Beacon consumes SpatialMarkerLayer', beacon.includes("from './SpatialMarkerLayer'") && beacon.includes("attention: 'beacon'")],
  ['legacy EdgePin is adapter only', edge.includes('Rendering ownership belongs to SpatialMarkerLayer') && edge.includes('<SpatialMarkerLayer')],
  ['label collision remains provider-owned', labels.includes('mature map-label provider (deck.gl)') && !labels.match(/overlap|intersect|collisionRect/i)],
  ['surface family has cross-surface depth cue', css.includes('.is-cross-surface') && css.includes('.is-context') && css.includes('.is-workflow')],
  ['reduced motion is respected', css.includes('@media (prefers-reduced-motion: reduce)')],
]

let passed = 0
for (const [name, ok] of gates) {
  if (ok) { passed += 1; console.log(`PASS ${name}`) }
  else console.error(`FAIL ${name}`)
}
console.log(`Spatial Marker F6A2 ${passed}/${gates.length}`)
if (passed !== gates.length) process.exit(1)
