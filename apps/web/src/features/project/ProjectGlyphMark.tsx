import { iconShapes, type LcosIconShape } from '../ui/iconShapes'

const PROJECT_SHAPES: readonly LcosIconShape[] = ['pebble', 'leaf', 'squircle', 'petal']

function pickProjectShape(seed: string): LcosIconShape {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return PROJECT_SHAPES[Math.abs(hash) % PROJECT_SHAPES.length] ?? 'pebble'
}

/**
 * Project identity glyph.
 *
 * Deliberately NOT a Conversation Glyth/Bloub. It uses LCOS' already-approved
 * organic SVG icon repertoire, so Project Launcher can have a floating organic
 * identity mark without borrowing lifecycle/receiver semantics from Glyth.
 * F6A Core visual-profile persistence will later choose the exact glyph/tint.
 */
export function ProjectGlyphMark({ label, variantSeed = label, shapeId, size = 72, className = '', color, scale = 1, orientation = 0 }: {
  readonly label: string
  readonly variantSeed?: string
  readonly shapeId?: LcosIconShape
  readonly size?: number
  readonly className?: string
  readonly color?: string
  readonly scale?: number
  readonly orientation?: number
}) {
  const shape = iconShapes[shapeId ?? pickProjectShape(variantSeed)]
  return <span
    className={`project-glyth-mark project-glyph-mark${className ? ` ${className}` : ''}`}
    role="img"
    aria-label={label}
    style={{ color, transform: `rotate(${orientation}deg) scale(${scale})` }}
  >
    <svg viewBox={shape.viewBox} width={size} height={size} aria-hidden="true">
      <path className="project-glyph-mark-body" d={shape.path}/>
    </svg>
  </span>
}
