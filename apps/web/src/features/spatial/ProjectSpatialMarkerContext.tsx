import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  NavigationResolutionV0,
  SpatialMarkerIntentV0,
  SpatialMarkerScopeV0,
  SpatialMarkerTargetRefV0,
  StableSurfaceRefV0,
} from '@local-creative-os/contracts'
import { useLocalCoreClientOrNull } from '../../runtime/LocalCoreClientContext'

export interface ProjectSpatialMarkerRecord {
  readonly intent: SpatialMarkerIntentV0
  readonly resolution: NavigationResolutionV0 | null
}

interface ProjectSpatialMarkerContextValue {
  readonly projectId: string
  readonly records: readonly ProjectSpatialMarkerRecord[]
  readonly loading: boolean
  readonly refresh: () => Promise<void>
  readonly resolveMarker: (markerId: string) => Promise<NavigationResolutionV0 | null>
  readonly createMarker: (input: { readonly targetRef: SpatialMarkerTargetRefV0; readonly scope: SpatialMarkerScopeV0; readonly sourceSurfaceRef?: StableSurfaceRefV0 }) => Promise<SpatialMarkerIntentV0 | null>
  readonly deleteMarker: (markerId: string) => Promise<boolean>
}

const ProjectSpatialMarkerContext = createContext<ProjectSpatialMarkerContextValue | null>(null)

/**
 * R2-A canonical owner for durable Spatial Marker Intent in Web.
 * Core owns intent + target resolution; Web only caches the current read model.
 * Pin / edge-cursor / cluster / screen coordinates never enter this context.
 */
export function ProjectSpatialMarkerProvider({ projectId, children }: { readonly projectId: string; readonly children: ReactNode }) {
  const client = useLocalCoreClientOrNull()
  const [records, setRecords] = useState<readonly ProjectSpatialMarkerRecord[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!client || !projectId) { setRecords([]); return }
    setLoading(true)
    try {
      const listed = await client.listSpatialMarkers(projectId, signal)
      if (!listed.result.ok) return
      const next = await Promise.all(listed.result.value.map(async (intent) => {
        const resolved = await client.resolveNavigationTarget(projectId, intent.targetRef, signal)
        return {
          intent,
          resolution: resolved.result.ok ? resolved.result.value : null,
        } satisfies ProjectSpatialMarkerRecord
      }))
      if (!signal?.aborted) setRecords(next)
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

  const resolveMarker = useCallback(async (markerId: string): Promise<NavigationResolutionV0 | null> => {
    if (!client || !projectId) return null
    const record = records.find((item) => item.intent.id === markerId)
    if (!record) return null
    const call = await client.resolveNavigationTarget(projectId, record.intent.targetRef)
    if (!call.result.ok) return null
    const resolution = call.result.value
    setRecords((current) => current.map((item) => item.intent.id === markerId ? { ...item, resolution } : item))
    return resolution
  }, [client, projectId, records])

  const createMarker = useCallback(async (input: { readonly targetRef: SpatialMarkerTargetRefV0; readonly scope: SpatialMarkerScopeV0; readonly sourceSurfaceRef?: StableSurfaceRefV0 }) => {
    if (!client || !projectId) return null
    const call = await client.createSpatialMarker(projectId, input)
    if (!call.result.ok) return null
    const marker = call.result.value
    const resolutionCall = await client.resolveNavigationTarget(projectId, marker.targetRef)
    const record: ProjectSpatialMarkerRecord = {
      intent: marker,
      resolution: resolutionCall.result.ok ? resolutionCall.result.value : null,
    }
    setRecords((current) => [...current.filter((item) => item.intent.id !== record.intent.id), record])
    return marker
  }, [client, projectId])

  const deleteMarker = useCallback(async (markerId: string) => {
    if (!client || !projectId) return false
    const call = await client.deleteSpatialMarker(projectId, markerId)
    if (!call.result.ok) return false
    setRecords((current) => current.filter((item) => item.intent.id !== markerId))
    return true
  }, [client, projectId])

  const value = useMemo<ProjectSpatialMarkerContextValue>(() => ({ projectId, records, loading, refresh, resolveMarker, createMarker, deleteMarker }), [createMarker, deleteMarker, loading, projectId, records, refresh, resolveMarker])
  return <ProjectSpatialMarkerContext.Provider value={value}>{children}</ProjectSpatialMarkerContext.Provider>
}

export function useProjectSpatialMarkersOrNull(): ProjectSpatialMarkerContextValue | null {
  return useContext(ProjectSpatialMarkerContext)
}
