# B4 Evaluation Report

## Evaluated without external package install

### Static contract suite

119/119 across A4, A5, A6, B1, B3, B3R4, B3R5, B3R6, B4.

### TypeScript syntax transpile

All changed TS/TSX files are transpiled with the globally available TypeScript compiler as a syntax check. Semantic workspace typecheck is not claimed without dependencies.

### Executable attacks

1. **Space close, meaning weak**: pure spatial remains low-priority `spatial_neighbourhood`.
2. **Space close + same Scene**: same_scene wins over spatial.
3. **Space far + explicit Relation**: relation wins.
4. **Intent Retrieval vs weak spatial**: retrieved item competes in shared optional token budget and is not starved.
5. **Viewport movement**: no semantic fingerprint change and no model re-run.
6. **Selection change**: semantic fingerprint changes and model may rerun.
7. **Provider failure**: next configured utility provider is attempted.
8. **No provider**: deterministic Intent fallback remains available.
9. **Responses structured output**: strict schema + `store:false`, no forced sampling parameter.
10. **Candidate suppression**: dismissal state prevents immediate repeat.

## Not evaluated in this sandbox

- visual pixel-level GUI QA
- Playwright interactions
- full Vitest suite
- workspace semantic typecheck
- production build
- live calls to paid providers

These are environmental verification debts, not hidden PASS results.
