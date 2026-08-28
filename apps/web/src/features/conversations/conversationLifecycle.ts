import type { SessionPhase } from '@local-creative-os/contracts'
import type { LcosGlythState } from '../spatial/visual/glythMotion'

/** Lifecycle truth drives pose; activity timestamps drive only decay. */
export function glythStateFromSessionPhase(phase: SessionPhase | undefined): LcosGlythState {
  if (phase === 'busy' || phase === 'connecting') return 'working'
  if (phase === 'waiting_input') return 'waiting'
  if (phase === 'disconnected') return 'error'
  return 'stable'
}

export function sessionPhaseLabel(phase: SessionPhase | undefined): string {
  if (phase === 'busy') return '工作中'
  if (phase === 'waiting_input') return '等待输入'
  if (phase === 'connecting') return '连接中'
  if (phase === 'disconnected') return '已断开'
  if (phase === 'stale') return '信息可能过期'
  if (phase === 'online') return '在线'
  if (phase === 'dormant') return '休眠'
  return '状态未知'
}
