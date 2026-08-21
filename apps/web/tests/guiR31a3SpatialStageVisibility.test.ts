import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../src/product-interface.css', import.meta.url), 'utf8')

describe('R3.1A3 spatial surface viewport visibility', () => {
  it('gives Context Graph and Signal Track a real viewport below the 48px surface header', () => {
    expect(css).toContain('.lcos-reconstructed .lcos-context-home-stage.lcos-presentation-spatial')
    expect(css).toContain('.lcos-reconstructed .lcos-signal-stage.lcos-presentation-spatial')
    expect(css).toMatch(/\.lcos-context-home-stage\.lcos-presentation-spatial,[\s\S]*?\.lcos-signal-stage\.lcos-presentation-spatial[\s\S]*?position:absolute;[\s\S]*?inset:48px 0 0;/)
  })
})
