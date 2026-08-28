import { useEffect, useState } from 'react'
import type { ArtifactBirthProvenanceV1 } from '@local-creative-os/contracts'
import { useLocalCoreClientOrNull } from '../../runtime/LocalCoreClientContext'
import { LcosGlyth } from '../spatial/visual/LcosGlyth'
import { canonicalBirthConversationView } from './birthProvenance'

const cache = new Map<string, ArtifactBirthProvenanceV1 | null>()
const inflight = new Map<string, Promise<ArtifactBirthProvenanceV1 | null>>()

async function readBirth(projectId: string, artifactId: string, client: NonNullable<ReturnType<typeof useLocalCoreClientOrNull>>): Promise<ArtifactBirthProvenanceV1 | null> {
  const key = `${projectId}:${artifactId}`
  if (cache.has(key)) return cache.get(key) ?? null
  const existing = inflight.get(key)
  if (existing) return existing
  const request = client.artifactBirth(projectId, artifactId).then((call) => call.result.ok ? call.result.value : null).catch(() => null).then((value) => { cache.set(key, value); inflight.delete(key); return value })
  inflight.set(key, request)
  return request
}

/** Static provenance marker. It locates the source Glyth; it never enters the conversation directly. */
export function BirthProvenanceBadge({ projectId, artifactId, onLocateConversationView }: {
  readonly projectId: string
  readonly artifactId: string
  readonly onLocateConversationView?: (conversationViewId: string) => void
}) {
  const client = useLocalCoreClientOrNull()
  const [birth, setBirth] = useState<ArtifactBirthProvenanceV1 | null>(() => cache.get(`${projectId}:${artifactId}`) ?? null)
  useEffect(() => {
    if (!client) return
    let alive = true
    void readBirth(projectId, artifactId, client).then((value) => { if (alive) setBirth(value) })
    return () => { alive = false }
  }, [artifactId, client, projectId])
  const conversationViewId = canonicalBirthConversationView(birth)
  if (!conversationViewId) return null
  return <button type="button" className="lcos-birth-provenance" aria-label="定位生成这份材料的对话" title="来自这段对话" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onLocateConversationView?.(conversationViewId) }}>
    <LcosGlyth state="stable" size={18} animated={false} />
  </button>
}
