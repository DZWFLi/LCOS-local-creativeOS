import { createHash } from 'node:crypto'

import type {
  CompiledContextPromptV1,
  ContextCacheTelemetryV1,
  ContextManifestOrderedItemV0,
  ContextManifestV0,
} from '@local-creative-os/contracts'
import { CONTEXT_PROMPT_SERIALIZER_V1 } from '@local-creative-os/contracts'

export interface ContextPromptManifestSourceV1 {
  /** Schema v0 manifests persisted before project labels were added only contain id. */
  readonly project: Pick<ContextManifestV0['project'], 'id'> & Partial<Pick<ContextManifestV0['project'], 'name'>>
  readonly target?: ContextManifestV0['target']
  readonly orderedItems?: ContextManifestV0['orderedItems']
  readonly lockedElements?: ContextManifestV0['lockedElements']
  readonly resourceRefs?: ContextManifestV0['resourceRefs']
  readonly cachePlan?: ContextManifestV0['cachePlan']
}

export interface CompileContextPromptV1Input {
  readonly manifest: ContextPromptManifestSourceV1
  readonly userTask: string
  readonly outputIntent: 'create' | 'revise' | 'analyze'
  /** Current selection is attention, not Saved Context truth. */
  readonly selectionArtifactIds?: readonly string[]
  readonly runConstraints?: readonly string[]
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function normalize(value: string): string {
  return value.normalize('NFC').replace(/\r\n?/g, '\n')
}

function scalar(value: string): string {
  return normalize(value).replace(/\n+/g, ' ').trim()
}

function estimateTokens(value: string): number {
  // Provider-neutral estimate only. Actual provider usage belongs in adapter telemetry.
  return Math.ceil(Buffer.byteLength(value, 'utf8') / 4)
}

function renderItem(item: ContextManifestOrderedItemV0): string {
  const lines = [
    `<context-item role="${item.role}" identity="${scalar(item.identity)}">`,
    `title: ${scalar(item.title)}`,
  ]
  if (item.artifactId) lines.push(`artifact: ${scalar(item.artifactId)}`)
  if (item.revisionId) lines.push(`revision: ${scalar(item.revisionId)}`)
  if (item.mimeType) lines.push(`mime: ${scalar(item.mimeType)}`)
  if (item.sourceAnchor) lines.push(`anchor: ${scalar(item.sourceAnchor)}`)
  if (item.contentHash) lines.push(`content-hash: ${scalar(item.contentHash)}`)
  if (item.content !== undefined) lines.push('content:', normalize(item.content).trimEnd())
  lines.push('</context-item>')
  return lines.join('\n')
}

function stableItems(manifest: ContextPromptManifestSourceV1): readonly ContextManifestOrderedItemV0[] {
  const order = manifest.cachePlan?.stableItemIdentities ?? []
  if (order.length === 0) return []
  const byIdentity = new Map<string, ContextManifestOrderedItemV0>()
  for (const item of manifest.orderedItems ?? []) if (!byIdentity.has(item.identity)) byIdentity.set(item.identity, item)
  return order.flatMap((identity) => {
    const item = byIdentity.get(identity)
    return item === undefined ? [] : [item]
  })
}

function itemRevisionKey(item: ContextManifestOrderedItemV0): string | undefined {
  if (item.artifactId === undefined) return undefined
  return `${item.artifactId}@${item.revisionId ?? 'current'}`
}

function dynamicItems(manifest: ContextPromptManifestSourceV1): readonly ContextManifestOrderedItemV0[] {
  const stableIdentity = new Set(manifest.cachePlan?.stableItemIdentities ?? [])
  const stableRevisionKeys = new Set(stableItems(manifest).map(itemRevisionKey).filter((value): value is string => value !== undefined))
  return (manifest.orderedItems ?? []).filter((item) => {
    if (stableIdentity.has(item.identity)) return false
    const key = itemRevisionKey(item)
    return key === undefined || !stableRevisionKeys.has(key)
  })
}

export function compileContextPromptV1(input: CompileContextPromptV1Input): CompiledContextPromptV1 {
  const manifest = input.manifest
  const plan = manifest.cachePlan
  const stable = stableItems(manifest)
  const stableContextBody = stable.map(renderItem).join('\n\n')

  const stableSections = [
    '# LCOS Stable Context Prefix',
    `serializer: ${CONTEXT_PROMPT_SERIALIZER_V1}`,
    ...(plan?.routeId ? [`route: ${scalar(plan.routeId)}`] : []),
    ...(plan?.skillId ? [`skill: ${scalar(plan.skillId)}${plan.skillVersion ? `@${scalar(plan.skillVersion)}` : ''}`] : []),
    ...(plan?.capabilityProfileId ? [`capability-profile: ${scalar(plan.capabilityProfileId)}`] : []),
    '',
    '## Project Baseline',
    `project-id: ${scalar(manifest.project.id)}`,
    `project-name: ${scalar(manifest.project.name ?? manifest.project.id)}`,
    '',
    '## Saved Context Snapshot',
    `saved-context-id: ${scalar(plan?.savedContextId ?? 'none')}`,
    stableContextBody || '(no saved-context members)',
  ]
  const stablePrefix = `${normalize(stableSections.join('\n')).trim()}\n`
  const stablePrefixHash = sha256(stablePrefix)
  const snapshotHash = sha256(`${scalar(plan?.savedContextId ?? 'none')}\n${stableContextBody}`)
  const snapshotId = `context-snapshot-v1-${snapshotHash}`

  const focus = [...new Set(input.selectionArtifactIds ?? plan?.focusArtifactIds ?? [])]
  const dynamic = dynamicItems(manifest)
  const dynamicSections = [
    '# LCOS Dynamic Task Tail',
    `output-intent: ${input.outputIntent}`,
    ...(manifest.target === null || manifest.target === undefined ? [] : [`target-artifact: ${scalar(manifest.target.artifactId)}`, `target-revision: ${scalar(manifest.target.revisionId)}`]),
    ...(focus.length === 0 ? [] : ['', '## Current Focus', ...focus.map((id) => `- ${scalar(id)}`)]),
    ...(dynamic.length === 0 ? [] : ['', '## Context Delta / Active Items', dynamic.map(renderItem).join('\n\n')]),
    ...((manifest.lockedElements ?? []).length === 0 ? [] : ['', '## Current Locked Elements', ...(manifest.lockedElements ?? []).map((value) => `- ${normalize(value).trim()}`)]),
    ...(manifest.resourceRefs === undefined || manifest.resourceRefs.length === 0
      ? []
      : ['', '## Current Resource References', ...manifest.resourceRefs.map((ref) => `- ${scalar(ref.role)}:${scalar(ref.resourceId)}@${scalar(ref.sourceRevisionId)}`)]),
    ...(input.runConstraints === undefined || input.runConstraints.length === 0
      ? []
      : ['', '## Run Constraints', ...input.runConstraints.map((value) => `- ${normalize(value).trim()}`)]),
    '',
    '## User Task',
    normalize(input.userTask).trim(),
  ]
  const dynamicTail = `${normalize(dynamicSections.join('\n')).trim()}\n`
  const dynamicTailHash = sha256(dynamicTail)
  const cacheFamily = [
    'lcos',
    scalar(manifest.project.id),
    scalar(plan?.savedContextId ?? 'project'),
    CONTEXT_PROMPT_SERIALIZER_V1,
    scalar(plan?.routeId ?? 'runtime'),
    scalar(plan?.skillId ? `${plan.skillId}@${plan.skillVersion ?? 'unknown'}` : 'skill-neutral'),
    scalar(plan?.capabilityProfileId ?? 'capability-neutral'),
  ].join(':')

  return {
    schemaVersion: 1,
    serializerVersion: CONTEXT_PROMPT_SERIALIZER_V1,
    projectId: manifest.project.id,
    ...(plan?.savedContextId === undefined ? {} : { savedContextId: plan.savedContextId }),
    snapshotId,
    ...(plan?.routeId === undefined ? {} : { routeId: plan.routeId }),
    ...(plan?.skillId === undefined ? {} : { skillId: plan.skillId }),
    ...(plan?.skillVersion === undefined ? {} : { skillVersion: plan.skillVersion }),
    ...(plan?.capabilityProfileId === undefined ? {} : { capabilityProfileId: plan.capabilityProfileId }),
    stablePrefix,
    dynamicTail,
    stablePrefixHash,
    dynamicTailHash,
    stablePrefixChars: stablePrefix.length,
    dynamicTailChars: dynamicTail.length,
    stablePrefixTokensEstimated: estimateTokens(stablePrefix),
    dynamicTailTokensEstimated: estimateTokens(dynamicTail),
    cacheFamily,
  }
}

export function contextCacheTelemetryV1(compiled: CompiledContextPromptV1, provider?: string): ContextCacheTelemetryV1 {
  return {
    schemaVersion: 1,
    serializerVersion: compiled.serializerVersion,
    projectId: compiled.projectId,
    ...(compiled.savedContextId === undefined ? {} : { savedContextId: compiled.savedContextId }),
    snapshotId: compiled.snapshotId,
    ...(compiled.routeId === undefined ? {} : { routeId: compiled.routeId }),
    ...(compiled.skillId === undefined ? {} : { skillId: compiled.skillId }),
    stablePrefixHash: compiled.stablePrefixHash,
    stablePrefixChars: compiled.stablePrefixChars,
    dynamicTailChars: compiled.dynamicTailChars,
    estimatedStableTokens: compiled.stablePrefixTokensEstimated,
    estimatedTailTokens: compiled.dynamicTailTokensEstimated,
    cacheFamily: compiled.cacheFamily,
    ...(provider === undefined ? {} : { provider }),
  }
}
