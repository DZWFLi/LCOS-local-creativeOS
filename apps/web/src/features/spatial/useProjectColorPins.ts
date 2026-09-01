import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ColorPinDefinitionV0,
  ColorPinMembershipV0,
  ColorPinSnapshotV0,
  NavigationResolutionV0,
  SpatialMarkerTargetRefV0,
} from '@local-creative-os/contracts'
import type { LocalCoreClient } from '../../runtime/localCoreClient'

export interface ProjectColorPinRecord {
  readonly definition: ColorPinDefinitionV0
  readonly membership: ColorPinMembershipV0
  readonly resolution: NavigationResolutionV0 | null
}

export interface ProjectColorPinsReadModel {
  readonly snapshot: ColorPinSnapshotV0
  readonly records: readonly ProjectColorPinRecord[]
  readonly loading: boolean
  readonly refresh: () => Promise<void>
  readonly assign: (input: { readonly targetRef: SpatialMarkerTargetRefV0; readonly colorPinId?: string; readonly color?: string; readonly label?: string }) => Promise<ProjectColorPinRecord | null>
  readonly removeMembership: (membershipId: string) => Promise<boolean>
}

const EMPTY_SNAPSHOT: ColorPinSnapshotV0 = { definitions: [], memberships: [] }

/**
 * Web read-model adapter for canonical Color Pin truth.
 * Core owns definitions/memberships + navigation resolution; Web owns no color-pin persistence.
 */
export function useProjectColorPins(client: LocalCoreClient, projectId: string): ProjectColorPinsReadModel {
  const [snapshot, setSnapshot] = useState<ColorPinSnapshotV0>(EMPTY_SNAPSHOT)
  const [records, setRecords] = useState<readonly ProjectColorPinRecord[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!projectId) { setSnapshot(EMPTY_SNAPSHOT); setRecords([]); return }
    setLoading(true)
    try {
      const listed = await client.listColorPins(projectId, signal)
      if (!listed.result.ok) return
      const nextSnapshot = listed.result.value
      const definitions = new Map(nextSnapshot.definitions.map((definition) => [definition.id, definition]))
      const next = (await Promise.all(nextSnapshot.memberships.map(async (membership) => {
        const definition = definitions.get(membership.colorPinId)
        if (!definition) return null
        const resolved = await client.resolveNavigationTarget(projectId, membership.targetRef, signal)
        return {
          definition,
          membership,
          resolution: resolved.result.ok ? resolved.result.value : null,
        } satisfies ProjectColorPinRecord
      }))).filter((value): value is ProjectColorPinRecord => value !== null)
      if (!signal?.aborted) { setSnapshot(nextSnapshot); setRecords(next) }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [client, projectId])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const refresh = useCallback(async () => { await load() }, [load])

  const assign = useCallback(async (input: { readonly targetRef: SpatialMarkerTargetRefV0; readonly colorPinId?: string; readonly color?: string; readonly label?: string }) => {
    const call = await client.assignColorPin(projectId, input)
    if (!call.result.ok) return null
    const resolution = await client.resolveNavigationTarget(projectId, call.result.value.membership.targetRef)
    const record: ProjectColorPinRecord = {
      definition: call.result.value.definition,
      membership: call.result.value.membership,
      resolution: resolution.result.ok ? resolution.result.value : null,
    }
    await load()
    return record
  }, [client, load, projectId])

  const removeMembership = useCallback(async (membershipId: string) => {
    const call = await client.removeColorPinMembership(projectId, membershipId)
    if (!call.result.ok) return false
    await load()
    return true
  }, [client, load, projectId])

  return useMemo(() => ({ snapshot, records, loading, refresh, assign, removeMembership }), [assign, loading, records, refresh, removeMembership, snapshot])
}
