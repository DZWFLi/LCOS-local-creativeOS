import { createContext, useContext } from 'react'
import type { SpatialMarkerTargetRefV0 } from '@local-creative-os/contracts'
import type { ProjectColorPinRecord, ProjectColorPinsReadModel } from './useProjectColorPins'

export interface ProjectColorPinRuntime extends ProjectColorPinsReadModel {
  readonly projectId: string
}

const ProjectColorPinContext = createContext<ProjectColorPinRuntime | null>(null)

export const ProjectColorPinProvider = ProjectColorPinContext.Provider

export function useProjectColorPinRuntime(): ProjectColorPinRuntime | null {
  return useContext(ProjectColorPinContext)
}

export function colorPinTargetRef(projectId: string, viewId: string): SpatialMarkerTargetRefV0 {
  return { projectId, kind: 'view', id: viewId }
}

export function colorPinRecordsForTarget(
  records: readonly ProjectColorPinRecord[],
  targetRef: Pick<SpatialMarkerTargetRefV0, 'kind' | 'id'>,
): readonly ProjectColorPinRecord[] {
  return records.filter((record) => record.membership.targetRef.kind === targetRef.kind && record.membership.targetRef.id === targetRef.id)
}
