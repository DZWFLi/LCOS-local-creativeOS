/**
 * Screen-space label contract shared by Beacon, document titles and aggregate
 * regions. Rendering belongs to a mature map-label provider (deck.gl); this
 * module deliberately contains no collision/DOM placement algorithm.
 */
export type SpatialLabelRole = 'navigation' | 'marker' | 'marker-cluster' | 'selection' | 'glyth' | 'region' | 'document' | 'auxiliary'
export type SpatialLabelCollisionGroup = 'navigation' | 'marker' | 'world-label'

export interface SpatialLabelDatum {
  readonly id: string
  readonly label: string
  readonly x: number
  readonly y: number
  readonly role: SpatialLabelRole
  readonly priority: number
  readonly collisionGroup: SpatialLabelCollisionGroup
  readonly minPixelSize: number
  readonly maxPixelSize: number
}

export const SPATIAL_LABEL_PRIORITY = {
  beacon: 1000,
  searchFocus: 950,
  selected: 900,
  activeGlyth: 800,
  region: 650,
  importantDocument: 500,
  document: 300,
  auxiliary: 100,
} as const

export function spatialLabelPriority(input: {
  readonly beacon?: boolean
  readonly selected?: boolean
  readonly activeGlyth?: boolean
  readonly region?: boolean
  readonly important?: boolean
}): number {
  if (input.beacon) return SPATIAL_LABEL_PRIORITY.beacon
  if (input.selected) return SPATIAL_LABEL_PRIORITY.selected
  if (input.activeGlyth) return SPATIAL_LABEL_PRIORITY.activeGlyth
  if (input.region) return SPATIAL_LABEL_PRIORITY.region
  if (input.important) return SPATIAL_LABEL_PRIORITY.importantDocument
  return SPATIAL_LABEL_PRIORITY.document
}
