import type { CSSProperties, ReactNode } from 'react'
import type { Camera } from '../../model'
import { spatialCameraTransform } from './spatialCamera'

interface Props {
  camera: Camera
  children: ReactNode
  className?: string
  testId?: string
  style?: CSSProperties
}

export function SpatialViewport({ camera, children, className = '', testId, style }: Props) {
  return <div data-testid={testId} className={`lcos-spatial-viewport ${className}`.trim()} style={{ ...style, transform: spatialCameraTransform(camera) }}>{children}</div>
}
