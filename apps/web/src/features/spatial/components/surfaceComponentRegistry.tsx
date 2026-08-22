import type { ComponentType } from 'react'
import type { SurfaceComponentType } from '../model/surfaceElementTypes'
import { SURFACE_COMPONENT_CATALOG, type SurfaceComponentCapabilityContract } from '../model/surfaceComponentCatalog'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'
import { FenceComponent } from './FenceComponent'
import { RegionComponent } from './RegionComponent'
import { PortalComponent } from './PortalComponent'
import { ContextPackComponent, EvolutionComponent, RelationshipFieldComponent, StructureMapComponent } from './ContextComponentRenderers'
import { CheckpointComponent, ReviewComponent, WorkflowStepComponent, WorkbenchFrameComponent } from './WorkflowComponentRenderers'

export interface SurfaceComponentDefinition extends SurfaceComponentCapabilityContract {
  readonly renderer: ComponentType<SurfaceComponentRenderProps>
}

const rendererByType: Readonly<Record<SurfaceComponentType, ComponentType<SurfaceComponentRenderProps>>> = {
  fence: FenceComponent,
  region: RegionComponent,
  portal: PortalComponent,
  'structure-map': StructureMapComponent,
  evolution: EvolutionComponent,
  'relationship-field': RelationshipFieldComponent,
  'context-pack': ContextPackComponent,
  'workflow-step': WorkflowStepComponent,
  review: ReviewComponent,
  checkpoint: CheckpointComponent,
  workbench: WorkbenchFrameComponent,
}

export const surfaceComponentRegistry: Readonly<Record<SurfaceComponentType, SurfaceComponentDefinition>> = Object.fromEntries(
  Object.entries(SURFACE_COMPONENT_CATALOG).map(([type, contract]) => [type, { ...contract, renderer: rendererByType[type as SurfaceComponentType] }]),
) as unknown as Readonly<Record<SurfaceComponentType, SurfaceComponentDefinition>>

export function resolveSurfaceComponent(type: SurfaceComponentType): SurfaceComponentDefinition {
  return surfaceComponentRegistry[type]
}
