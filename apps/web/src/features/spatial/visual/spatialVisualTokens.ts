export const spatialVisualTokens = {
  segment: {
    thickness: 2,
    radius: 999,
    opacity: .42,
  },
  motion: {
    fastMs: 140,
    normalMs: 220,
    slowMs: 360,
  },
  glyph: {
    size: 18,
  },
} as const

export const spatialMotionDuration = (durationMs: number, reducedMotion: boolean): number => reducedMotion ? 0 : durationMs
