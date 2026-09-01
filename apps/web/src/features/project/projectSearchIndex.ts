import { useEffect, useMemo, useRef, useState } from 'react'
import type { LocalCoreClient } from '../../runtime/localCoreClient'
import { searchProjectFocusEntries, type ProjectFocusSearchEntry } from '../../state/projectFocus'
import {
  mergeProjectSearchResults,
  projectSearchResultFromRemote,
  projectSearchResultIndexItems,
  type ProjectSearchIndexResult,
} from './projectSearchIndexModel'

export type { ProjectSearchIndexResult } from './projectSearchIndexModel'
export {
  projectSearchAnchorLabel,
  projectSearchHumanKind,
  projectSearchMatchReasonLabel,
  projectSearchResultForIndexId,
} from './projectSearchIndexModel'

export interface UseProjectSearchIndexInput {
  readonly open: boolean
  readonly initialQuery?: string
  readonly projectId: string
  readonly client: LocalCoreClient
  readonly searchEntries?: readonly ProjectFocusSearchEntry[]
}

export interface ProjectSearchIndexState {
  readonly query: string
  readonly setQuery: (query: string) => void
  readonly loading: boolean
  readonly error: string | null
  readonly results: readonly ProjectSearchIndexResult[]
  readonly indexItems: ReturnType<typeof projectSearchResultIndexItems>
  readonly activeIndex: number
  readonly setActiveIndex: (index: number) => void
  readonly activeResult: ProjectSearchIndexResult | null
}

export function useProjectSearchIndex(input: UseProjectSearchIndexInput): ProjectSearchIndexState {
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState<readonly ProjectSearchIndexResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const requestSeq = useRef(0)

  useEffect(() => {
    if (!input.open) return
    setQuery(input.initialQuery ?? '')
    setRemote([])
    setError(null)
    setActiveIndex(0)
  }, [input.initialQuery, input.open, input.projectId])

  useEffect(() => {
    if (!input.open) return
    const normalized = query.trim()
    if (!normalized) {
      setRemote([])
      setLoading(false)
      setError(null)
      return
    }
    const seq = ++requestSeq.current
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      void input.client.projectSearch(input.projectId, normalized, {
        limit: 28,
        types: ['artifact', 'resource', 'note', 'conversation', 'file'],
      }, controller.signal)
        .then((call) => {
          if (seq !== requestSeq.current) return
          if (!call.result.ok) {
            setError(call.result.error.message)
            setRemote([])
            return
          }
          setError(null)
          setRemote(call.result.value.hits.map(projectSearchResultFromRemote))
        })
        .catch((cause) => {
          if (seq !== requestSeq.current || controller.signal.aborted) return
          setError(cause instanceof Error ? cause.message : '搜索暂不可用')
          setRemote([])
        })
        .finally(() => {
          if (seq === requestSeq.current) setLoading(false)
        })
    }, 150)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [input.client, input.open, input.projectId, query])

  const local = useMemo<readonly ProjectSearchIndexResult[]>(() => {
    const normalized = query.trim()
    if (!normalized) return []
    return searchProjectFocusEntries(input.searchEntries ?? [], normalized).slice(0, 12).map((entry) => ({
      key: entry.key,
      title: entry.title,
      kind: entry.kind,
      sourceIds: entry.sourceIds,
    }))
  }, [input.searchEntries, query])

  const results = useMemo(() => mergeProjectSearchResults(local, remote), [local, remote])

  useEffect(() => {
    setActiveIndex((current) => Math.max(0, Math.min(current, Math.max(0, results.length - 1))))
  }, [results.length])

  const indexItems = useMemo(() => projectSearchResultIndexItems(results), [results])
  const activeResult = results[activeIndex] ?? null

  return {
    query,
    setQuery,
    loading,
    error,
    results,
    indexItems,
    activeIndex,
    setActiveIndex,
    activeResult,
  }
}
