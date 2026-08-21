import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ContextTrackSegmentV0 } from '@local-creative-os/contracts'
import { getPresentationBridge, presentationBridgeKey, subscribePresentationBridge } from './presentationViewState'

const memory = new Map<string, ContextTrackSegmentV0[]>()

function keyOf(projectId: string, scopeId: string) {
  return `presentation-track:${projectId}:${scopeId}`
}

/**
 * Phase 3 §6.3：Signal Track 段（Presentation-only）。
 * Core PresentationView.state.trackSegments 是 committed truth；这里只是乐观层。
 * 首次（committed 无 trackSegments 且有种子）时写入一次种子，之后由用户操作驱动。
 */
export function useContextTrackState(
  projectId: string,
  scopeId: string,
  seedSegments: readonly ContextTrackSegmentV0[],
) {
  const trackKey = useMemo(() => keyOf(projectId, scopeId), [projectId, scopeId])
  const [segments, setSegmentsValue] = useState<ContextTrackSegmentV0[]>(() => memory.get(trackKey) ?? [...seedSegments])

  useEffect(() => {
    setSegmentsValue(memory.get(trackKey) ?? [...seedSegments])
    const bridgeKey = presentationBridgeKey(projectId, scopeId, 'context')
    let unsubscribeBridge: (() => void) | undefined
    let seededOnce = false

    const bindAndApply = (): void => {
      unsubscribeBridge?.()
      const bridge = getPresentationBridge(projectId, scopeId, 'context')
      if (bridge === undefined) return
      const applyCurrent = (): void => {
        const current = getPresentationBridge(projectId, scopeId, 'context')
        if (current?.state === null || current?.state === undefined) return
        if (current.state.trackSegments !== undefined) {
          memory.set(trackKey, current.state.trackSegments)
          setSegmentsValue(current.state.trackSegments)
          return
        }
        // 首次种子：committed 没有 trackSegments 时写一次（不循环）。
        if (!seededOnce && seedSegments.length > 0 && current.ready) {
          seededOnce = true
          current.patch((persisted) => ({ ...persisted, trackSegments: [...seedSegments] }))
          current.flushSoon()
          memory.set(trackKey, [...seedSegments])
          setSegmentsValue([...seedSegments])
        }
      }
      unsubscribeBridge = bridge.subscribe(applyCurrent)
      applyCurrent()
    }

    bindAndApply()
    const unsubscribeRegistry = subscribePresentationBridge(bridgeKey, bindAndApply)
    return () => { unsubscribeBridge?.(); unsubscribeRegistry() }
  }, [projectId, scopeId, seedSegments, trackKey])

  const setSegments = useCallback((next: ContextTrackSegmentV0[]) => {
    const bridge = getPresentationBridge(projectId, scopeId, 'context')
    if (!bridge?.ready) return
    bridge.patch((persisted) => ({ ...persisted, trackSegments: next }))
    bridge.flushSoon()
    memory.set(trackKey, next)
    setSegmentsValue(next)
  }, [projectId, scopeId, trackKey])

  return [segments, setSegments] as const
}
