import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const checks = []
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) })
function readRequired(file) {
  const target = path.join(root, file)
  if (!fs.existsSync(target)) { checks.push({ name: `required source exists: ${file}`, ok: false }); return '' }
  return fs.readFileSync(target, 'utf8')
}

const app = readRequired('apps/web/src/App.tsx')
const model = readRequired('apps/web/src/model.ts')
const bridge = readRequired('apps/web/src/runtime/runtimeBridge.ts')
const client = readRequired('apps/web/src/runtime/localCoreClient.ts')
const projection = readRequired('apps/web/src/features/entities/projectEntityProjection.ts')
const glyth = readRequired('apps/web/src/features/conversations/ConversationGlyth.tsx')
const lifecycle = readRequired('apps/web/src/features/conversations/conversationLifecycle.ts')
const controller = readRequired('apps/web/src/features/conversations/ConversationControllerDialog.tsx')
const birth = readRequired('apps/web/src/features/provenance/birthProvenance.ts')
const birthBadge = readRequired('apps/web/src/features/provenance/BirthProvenanceBadge.tsx')
const canvas = readRequired('apps/web/src/features/canvas/ProjectCanvas.tsx')
const focus = readRequired('apps/web/src/features/spatial/useSpatialFocusRequest.ts')
const beacon = readRequired('apps/web/src/features/spatial/SpatialBeaconLayer.tsx')
const markerSystem = readRequired('apps/web/src/features/spatial/spatialMarkerSystem.ts')
const edgeGeometry = readRequired('apps/web/src/features/spatial/edgePinGeometry.ts')
const conversationSpace = readRequired('apps/web/src/features/surfaces/ConversationSpaceSurface.tsx')
const shell = readRequired('apps/web/src/features/shell/AppShellView.tsx')
const dock = readRequired('apps/web/src/features/shell/SurfaceDock.tsx')
const viewer = readRequired('apps/web/src/features/viewer/artifactViewerRegistry.tsx')

check('Conversation physical identity is the Core conversationViewId',
  bridge.includes('conversationByViewId') && bridge.includes("entityKind: 'conversation'") &&
  projection.includes('canonical Core-backed conversationViewId') && projection.includes("ref.type === 'conversation'") &&
  !projection.includes('frontendConversationPosition'))

check('Conversation refs resolve an existing Core-backed node only',
  projection.includes("nodes.find((item) => item.entityKind === 'conversation' && item.conversation?.id === ref.id)") &&
  projection.includes('return existing ? [existing] : []'))

check('Active Controller truth comes only from ActiveReceiverIdentity',
  app.includes('activeReceiverIdentity(activeProjectId') && app.includes('setActiveReceiverIdentity(identity)') &&
  !app.includes('getProjectReceiverBinding(activeProjectId)'))

check('Controller linkage is explicit link-session and never inferred',
  client.includes('linkConnectedConversationSession') &&
  app.includes('item.conversationSessionId === conversationSessionId') &&
  app.includes('Explicit > inferred: even one candidate is not auto-selected.') &&
  controller.includes('只建立显式 ConversationSession ↔ ConnectedConversation 链接') && !controller.includes('provider ===') && !controller.includes('title ==='))

check('SessionLifecycle drives pose while Activity Decay stays presentation-only',
  model.includes('lifecyclePhase?: SessionPhase') && lifecycle.includes("phase === 'busy'") &&
  lifecycle.includes("phase === 'disconnected'") && glyth.includes('Activity recency is presentation decay only') &&
  /conversationGlythStateFromRecent[\s\S]*?return 'stable'/.test(glyth))

check('stale and disconnected remain different lifecycle truths',
  lifecycle.includes("phase === 'disconnected') return 'error'") && lifecycle.includes("phase === 'stale') return '信息可能过期'") &&
  !app.includes('receiverSessionStale'))

check('Birth Provenance reads Core and fails closed on partial/unknown lineage',
  birthBadge.includes('client.artifactBirth(projectId, artifactId)') &&
  birth.includes("birth.origin !== 'run-return'") && birth.includes('!birth.birthRunId') &&
  birth.includes('!birth.conversationSession') && birth.includes('!birth.conversationViewId'))

check('Birth Glyth is static and locates canonical Conversation view only',
  birthBadge.includes('animated={false}') && birthBadge.includes('onLocateConversationView?.(conversationViewId)') &&
  !birthBadge.includes('setConversationSpaceId') && !birthBadge.includes('onOpenConversation'))

check('Conversation enters a Project-local Subcanvas, not generic Artifact Reader',
  app.includes('const enterConversationSurface') && app.includes('setConversationSpaceId(conversationId)') &&
  shell.includes('conversationScene ? <ConversationSpaceSurface') &&
  conversationSpace.includes('client.conversationProjection(projectId, conversationId') &&
  conversationSpace.includes('client.conversationMessages(projectId, conversationId') &&
  viewer.includes("if (node.entityKind === 'conversation') return 'fallback'"))

check('Conversation Subcanvas is not a fourth persisted top-level Surface',
  shell.includes('Project-local deeper scene') && !dock.includes("| 'conversation'") && !dock.includes("'conversation' as const"))

check('Double Click and Orbit Enter converge on the same Conversation Subcanvas entry',
  app.includes('enterConversationSurface(node.conversation.id)') &&
  canvas.includes("id: 'conversation-open'") && canvas.includes('onOpenConversation?.(conversationOrbit.conversationId)') &&
  app.includes('onOpenConversation: enterConversationSurface'))

check('Focus/Provenance uses destination-guarded Spatial Beacon with motion completion, not fit+timeout replay',
  app.includes("targetTestId: 'canvas'") && focus.includes('request.targetTestId') &&
  focus.includes("phase: 'approach'") && focus.includes("phase: 'arrival'") &&
  focus.includes('requestAnimationFrame') && !focus.includes('setTimeout(') && beacon.includes('data-beacon-phase') &&
  // F6A2 收编：Beacon 是瞬时高优先 Spatial Marker（offscreen → edge-cursor 由统一投影承接）
  beacon.includes("attention: 'beacon' as const") && beacon.includes('SpatialMarkerLayer') &&
  markerSystem.includes("'world-pin' | 'edge-cursor'") && edgeGeometry.includes('Math.atan2'))

const birthLocate = app.match(/const locateBirthConversationSource[\s\S]*?\n\s*\}, \[activateOverview\]\)/)?.[0] ?? ''
check('Birth/Where navigation is read-only and never mutates Selection',
  birthLocate.includes('setProjectFocusRequest') && !birthLocate.includes('selectNode') && !birthLocate.includes('clearSelection'))

check('Back/Esc exits the deeper scene without resetting Main camera or Selection',
  app.includes("else if (conversationSpaceId) setConversationSpaceId(null)") &&
  shell.includes("props.conversationScene ? <ConversationSpaceSurface") &&
  !conversationSpace.includes('clearSelection') && !conversationSpace.includes('setSelection') &&
  !conversationSpace.includes("useSpatialSessionCamera(props.projectId, 'main'") )

let failed = 0
for (const item of checks) { console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}`); if (!item.ok) failed += 1 }
console.log(`\n${checks.length - failed}/${checks.length} LCOS v0.15 Conversation Truth contracts passed`)
if (failed) process.exit(1)
