import { createContext, useContext, type ReactNode } from 'react'
import type { ActiveSpatialViewportEnvironment } from './activeSpatialViewport'

const ActiveSpatialViewportContext = createContext<ActiveSpatialViewportEnvironment | null>(null)

export function ActiveSpatialViewportProvider(props: {
  readonly value: ActiveSpatialViewportEnvironment
  readonly children: ReactNode
}) {
  return <ActiveSpatialViewportContext.Provider value={props.value}>{props.children}</ActiveSpatialViewportContext.Provider>
}

export function useActiveSpatialViewport(): ActiveSpatialViewportEnvironment | null {
  return useContext(ActiveSpatialViewportContext)
}
