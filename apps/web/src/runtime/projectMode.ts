/**
 * Production / Fixture storage boundary helper (Phase A).
 *
 * Production runtime: semantic mutations go to Local Core (applyMutations).
 * Fixture / Story / QA: prototypeStorage remains allowed.
 * Invariant: a production runtime project must never fall back to
 * prototypeStorage for semantic mutations.
 */
export const isRuntimeProjectMode = (mode: string): boolean => mode === 'runtime'
