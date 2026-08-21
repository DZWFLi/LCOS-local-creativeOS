import { createElkLayoutEngine } from './elkLayoutAdapter'
import { elkDriver } from './elkDriver'
import { createFcoseLayoutEngine } from './fcoseLayoutAdapter'
import { cytoscapeFcoseDriver } from './cytoscapeFcoseDriver'
import type { LayoutEngineRegistry } from './layoutService'

/**
 * Phase C: lazy external layout engines (ELK layered + fCoSE relational).
 * External algorithms are refiners only; layoutService keeps the builtin fallback.
 */
let enginesPromise: Promise<LayoutEngineRegistry> | null = null

export function loadPresentationLayoutEngines(): Promise<LayoutEngineRegistry> {
  if (enginesPromise === null) {
    enginesPromise = Promise.all([elkDriver(), cytoscapeFcoseDriver()]).then(([elk, fcose]) => ({
      layered: createElkLayoutEngine(elk),
      relational: createFcoseLayoutEngine(fcose),
    }))
  }
  return enginesPromise
}
