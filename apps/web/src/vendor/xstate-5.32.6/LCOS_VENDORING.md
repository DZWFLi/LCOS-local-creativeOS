# XState core 5.32.6 · LCOS local vendor record

- Upstream: `statelyai/xstate`
- Upstream version: `xstate 5.32.6`
- Donor snapshot commit: `21872cdc93a3baddbcf43f1d83553991d39f28ab`
- License: MIT
- Local donor manifest SHA-256: `91087e0ef47f64871ddb854cd9db4a94011c04f0d8dac02c817e12f8fdabba47`
- Copied scope: `packages/core/src`, `packages/core/LICENSE`, `packages/core/README.md`, upstream `packages/core/package.json` as `UPSTREAM_PACKAGE.json`.
- LCOS packaging change: a local `package.json` exposes the upstream `#is-development` import condition while source is consumed directly by Vite/TypeScript. Upstream `src/`, LICENSE, README and package metadata are copied intact; LCOS adds only the local package boundary/provenance files outside `src/`.
- LCOS owner: A24 Voice transient lifecycle only. This does not replace LCOS canonical project/runtime state.
