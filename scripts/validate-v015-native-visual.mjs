import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const orbit = read('apps/web/src/features/ui/ObjectOrbit.tsx')
const orbitCss = read('apps/web/src/features/ui/ui-primitives.css')
const canvasVisual = read('apps/web/src/features/canvas/CanvasNodeVisual.tsx')
const projectCanvas = read('apps/web/src/features/canvas/ProjectCanvas.tsx')
const reconstruction = read('apps/web/src/reconstruction.css')
const interaction = read('apps/web/src/interaction-system.css')
const spatialCss = read('apps/web/src/spatial-components.css')
const production = [
  canvasVisual,
  read('apps/web/src/features/surfaces/SurfaceObject.tsx'),
  read('apps/web/src/features/surfaces/WorkflowSurface.tsx'),
  read('apps/web/src/features/reorganize/ReorganizePanel.tsx'),
].join('\n')

const results = []
const check = (name, ok) => { results.push([name, Boolean(ok)]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`) }

const reconstructionSelection = /\.canvas-node\.selected \.lcos-object::(?:before|after)/.test(reconstruction)
const spatialSelection = /\.canvas-node\.selected \.lcos-object::(?:before|after)/.test(spatialCss)
const interactionSelection = /\.canvas-node\.selected \.lcos-object::after \{[\s\S]*?border:\s*0;[\s\S]*?background:\s*conic-gradient\(from 26deg/.test(interaction)
const hostMotionBlock = interaction.match(/\.lcos-reconstructed \.canvas-node:not\(\.dragging\):not\(\.resizing\):not\(\[data-entity-kind="collection"\]\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
const reconstructedHost = reconstruction.match(/\.lcos-reconstructed \.canvas-node \{[\s\S]*?\n\}/)?.[0] ?? ''

check('Effective reconstructed CanvasNode remains an interaction host, not a visible universal card',
  /background:\s*transparent/.test(reconstructedHost) && /border:\s*0/.test(reconstructedHost) && /box-shadow:\s*none/.test(reconstructedHost) && /backdrop-filter:\s*none/.test(reconstructedHost))
check('Artifact identity still comes from the canonical detectFileIdentity taxonomy',
  canvasVisual.includes("export type FileIdentity = 'image' | 'video' | 'audio' | 'pdf' | 'ppt' | 'markdown' | 'link' | 'archive' | 'file'"))
check('PPT owns a 16:9 slide-deck body instead of portrait document paper',
  canvasVisual.includes("if (kind === 'ppt') return <SlideDeckFallback") && spatialCss.includes('.lcos-slide-deck-fallback') && spatialCss.includes('aspect-ratio: 16 / 9'))
check('Archive owns a bundle body and generic file owns a file silhouette',
  canvasVisual.includes('ArchiveBundleFallback') && canvasVisual.includes('GenericFileFallback') && spatialCss.includes('.lcos-archive-bundle-fallback') && spatialCss.includes('.lcos-generic-file-fallback'))
check('Link body retires the mini SaaS card shell',
  /\.lcos-reconstructed \.lcos-link-object \{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/.test(spatialCss))
check('Image remains the image body and media keeps media-native silhouettes',
  canvasVisual.includes("if (kind === 'image') return <ImageObject") && spatialCss.includes('.media-video .lcos-media-stage') && spatialCss.includes('.media-audio .lcos-media-stage::before'))
check('F4 Selection world-field remains the single CanvasNode visual owner',
  interactionSelection && !reconstructionSelection && !spatialSelection && !interaction.includes('animation:lcos-ring-travel'))
check('F4 Relation interaction ownership survives the F5 rebase',
  projectCanvas.includes('relationTargetId') && projectCanvas.includes('edge-terminal-hit') && projectCanvas.includes('edge-terminal-mark') && !projectCanvas.includes('edge-runner') && interaction.includes('@keyframes lcos-relation-flow'))
check('CanvasNode host motion does not animate morphology properties',
  hostMotionBlock.includes('left var(--lcos-dur-normal)') && hostMotionBlock.includes('top var(--lcos-dur-normal)')
  && hostMotionBlock.includes('opacity var(--lcos-dur-fast)') && hostMotionBlock.includes('transform var(--lcos-dur-fast)')
  && !/(?:box-shadow|background-color|border-color)/.test(hostMotionBlock))
check('ObjectOrbit lays satellites around a full 360 degree circle',
  orbit.includes('index * (360 / total)') && orbit.includes('lcos-orbit-track'))
check('Orbit is anchored to the Conversation Glyth body and stays in the compact ring range',
  projectCanvas.includes("anchor.querySelector('.lcos-conversation-glyth') ?? anchor") && orbit.includes('const SATELLITE_RING_GAP = 23'))
check('Orbit satellites are 36px icon instruments with labels only on hover/focus',
  orbitCss.includes('width: 36px;') && orbitCss.includes('.lcos-orbit-satellite-label') && orbitCss.includes('.lcos-orbit-satellite:hover .lcos-orbit-satellite-label'))
check('Current receiver stays read-only while latest L0 gives the freed Glyth satellite to Relation, not Lifecycle status',
  projectCanvas.includes("id: 'conversation-active'") && projectCanvas.includes("id: 'conversation-relation'")
  && !projectCanvas.includes("id: 'conversation-status'") && projectCanvas.includes('readOnly: true')
  && !projectCanvas.includes("id: 'conversation-active', label: '当前承接', icon: CheckCircle2, onClick"))
check('Ordinary artifacts and surfaces do not borrow Conversation Glyth',
  !production.includes('GlythAvatar') && !production.includes('<LcosGlyth'))

const passed = results.filter(([, ok]) => ok).length
console.log(`\nNative Visual F5 Rebase: ${passed}/${results.length} PASS`)
if (passed !== results.length) process.exitCode = 1
