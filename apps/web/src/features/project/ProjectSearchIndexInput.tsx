import { useEffect, useRef } from 'react'
import { LoaderCircle, Search, X } from 'lucide-react'

interface Props {
  readonly query: string
  readonly loading: boolean
  readonly error: string | null
  readonly resultCount: number
  readonly activeIndex: number
  readonly overflowExpanded: boolean
  readonly onQueryChange: (query: string) => void
  readonly onActiveIndexChange: (index: number) => void
  readonly onSubmitActive: () => void
  readonly onCloseOverflow: () => void
  readonly onClose: () => void
}

/** Compact Search control hosted by the one Top Spatial Index slot. */
export function ProjectSearchIndexInput(props: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return <div className={`lcos-centered-search-control${props.error ? ' has-error' : ''}`} data-testid="centered-search-control">
    <Search size={15} aria-hidden="true" />
    <input
      ref={inputRef}
      value={props.query}
      onChange={(event) => props.onQueryChange(event.target.value)}
      placeholder="找项目里的任何东西"
      aria-label="搜索当前项目"
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          props.onActiveIndexChange(Math.max(0, Math.min(props.resultCount - 1, props.activeIndex + 1)))
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          props.onActiveIndexChange(Math.max(0, props.activeIndex - 1))
          return
        }
        if (event.key === 'Enter' && props.resultCount > 0) {
          event.preventDefault()
          props.onSubmitActive()
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          if (props.overflowExpanded) props.onCloseOverflow()
          else props.onClose()
        }
      }}
    />
    {props.loading
      ? <LoaderCircle size={14} className="lcos-centered-search-spinner" aria-label="搜索中" />
      : props.query
        ? <button type="button" aria-label="清空搜索" onClick={() => props.onQueryChange('')}><X size={13} /></button>
        : <kbd>Esc</kbd>}
  </div>
}
