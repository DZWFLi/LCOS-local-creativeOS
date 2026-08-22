import type { ComponentType } from 'react'
import type { SurfaceComponentType } from '../model/surfaceElementTypes'
import { SURFACE_COMPONENT_CATALOG, type SurfaceComponentCapabilityContract } from '../model/surfaceComponentCatalog'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'
import { FenceComponent } from './FenceComponent'
import { RegionComponent } from './RegionComponent'
import { PortalComponent } from './PortalComponent'
import { SurfacePanelComponent } from './SurfacePanelComponent'

export interface SurfaceComponentDefinition extends SurfaceComponentCapabilityContract {
  readonly renderer: ComponentType<SurfaceComponentRenderProps>
}

const rendererByType: Readonly<Record<SurfaceComponentType, ComponentType<SurfaceComponentRenderProps>>> = {
  fence: FenceComponent,
  region: RegionComponent,
  portal: PortalComponent,
  'structure-map': SurfacePanelComponent,
  evolution: SurfacePanelComponent,
  'relationship-field': SurfacePanelComponent,
  'context-pack': SurfacePanelComponent,
  'workflow-step': SurfacePanelComponent,
  review: SurfacePanelComponent,
  checkpoint: SurfacePanelComponent,
  workbench: SurfacePanelComponent,
}

export const surfaceComponentRegistry: Readonly<Record<SurfaceComponentType, SurfaceComponentDefinition>> = Object.fromEntries(
  Object.entries(SURFACE_COMPONENT_CATALOG).map(([type, contract]) => [type, { ...contract, renderer: rendererByType[type as SurfaceComponentType] }]),
) as unknown as Readonly<Record<SurfaceComponentType, SurfaceComponentDefinition>>

export function resolveSurfaceComponent(type: SurfaceComponentType): SurfaceComponentDefinition {
  return surfaceComponentRegistry[type]
}
