import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** One shared reduced-motion source for Spatial Surface primitives/components. */
export function useReducedSpatialMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches === true)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia(QUERY)
    const apply = () => setReduced(media.matches)
    apply()
    media.addEventListener?.('change', apply)
    return () => media.removeEventListener?.('change', apply)
  }, [])
  return reduced
}
