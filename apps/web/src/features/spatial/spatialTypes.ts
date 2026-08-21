import type { Camera } from '../../model'

export type SpatialLod = 'full' | 'simplified' | 'overview'
export type SpatialDensity = 'comfortable' | 'compact' | 'constrained'

export interface SpatialPoint { x: number; y: number }
export interface SpatialBounds { x: number; y: number; width: number; height: number }
export interface SpatialInsets { left: number; right: number; top: number; bottom: number }
export interface SpatialSize { width: number; height: number }
export interface SpatialPlacement extends SpatialBounds { id: string }

export type SpatialCameraSetter = (camera: Camera | ((current: Camera) => Camera)) => void

export type SpatialPointerSession =
  | { kind: 'idle' }
  | { kind: 'pan'; pointerId: number; start: SpatialPoint; originCamera: Camera }
  | { kind: 'marquee'; pointerId: number; start: SpatialPoint; current: SpatialPoint; moved: boolean }
  | { kind: 'node-drag'; pointerId: number; id: string; start: SpatialPoint; origin: SpatialPoint }

export const IDLE_SPATIAL_POINTER: SpatialPointerSession = { kind: 'idle' }
