import type { ComponentProps } from 'react'
import { WorkRail } from '../workrail/WorkRail'

export interface WorkRailHostProps {
  readonly rail: ComponentProps<typeof WorkRail>
}

/** 右侧工作台宿主：轨道状态与回调全部来自上层注入。 */
export function WorkRailHost(props: WorkRailHostProps) {
  return <WorkRail {...props.rail} />
}
