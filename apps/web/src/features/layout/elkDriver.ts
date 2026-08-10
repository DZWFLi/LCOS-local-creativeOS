import type { ElkLike } from './elkLayoutAdapter'

/**
 * Phase C: real ELK driver (lazy-loaded so the main bundle stays lean).
 * The Surface never imports elkjs; it goes Surface → layoutService → adapter → driver.
 */
let elkPromise: Promise<ElkLike> | null = null

export function elkDriver(): Promise<ElkLike> {
  if (elkPromise === null) {
    elkPromise = import('elkjs/lib/elk.bundled.js').then((module) => {
      const ElkCtor = (module as { default?: new () => unknown }).default ?? module
      const elk = new (ElkCtor as new () => { layout(graph: unknown): Promise<unknown> })()
      return { layout: (graph) => elk.layout(graph) } as ElkLike
    })
  }
  return elkPromise
}
