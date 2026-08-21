import type { CSSProperties } from 'react'

export type LcosSignalState =
  | 'stable'
  | 'focus'
  | 'sending'
  | 'receiving'
  | 'working'
  | 'pending'
  | 'kept'
  | 'reverting'
  | 'conflict'
  | 'failed'

const signalCells = [
  [6, 3, 'north-west'], [9, 3, 'north-east'],
  [4, 5, 'west-upper'], [7, 5, 'core-a'], [8, 5, 'core-b'], [11, 5, 'east-upper'],
  [3, 8, 'west'], [6, 8, 'core-c'], [9, 8, 'core-d'], [12, 8, 'east'],
  [4, 11, 'west-lower'], [7, 11, 'core-e'], [8, 11, 'core-f'], [11, 11, 'east-lower'],
  [6, 13, 'south-west'], [9, 13, 'south-east'],
] as const

/**
 * LCOS 16×16 system signal.
 *
 * This is deliberately NOT an object/file-type icon. The same seed changes
 * posture to express what LCOS is doing to an object: focus, send, receive,
 * agent work, review, keep/revert, conflict or failure.
 */
export function LcosSignalGlyph({ state = 'stable', className = '', label }: { state?: LcosSignalState; className?: string; label?: string }) {
  return <svg
    className={`lcos-signal-glyph ${className}`}
    viewBox="0 0 16 16"
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    data-signal-state={state}
  >
    {signalCells.map(([x, y, role], index) => <rect
      key={role}
      className="lcos-signal-cell"
      data-signal-role={role}
      data-cell-index={index}
      x={x - .42}
      y={y - .42}
      width=".84"
      height=".84"
      rx=".18"
      style={{ '--cell-i': index } as CSSProperties}
    />)}
  </svg>
}
