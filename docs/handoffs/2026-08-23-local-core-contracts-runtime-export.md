# Local Core contracts runtime export correction

## Task summary

Restore the built Local Core and Playwright harness after the contracts package gained runtime exports.

## Actual scope

- Keep TypeScript consumers on `packages/contracts/src/index.ts` for declarations.
- Route Node runtime imports to the existing bundled `packages/contracts/dist/index.js`.
- Make `dev:local-core` execute the same domain + contracts + Local Core build chain as E2E and Desktop.
- No schema, Project Truth, API, canvas, or interaction change.

## Flow change

Before:

`Local Core dist -> contracts package -> src/index.ts -> unresolved ./context-prompt.js -> process exits`

After:

`Local Core dist -> contracts package runtime export -> dist/index.js -> server listens on 127.0.0.1:43121`

## Modified files

- `package.json`
- `packages/contracts/package.json`

## Verification

- `npm run build:local-core`: PASS.
- Direct built Local Core startup: PASS.
- `GET http://127.0.0.1:43121/health`: PASS, returned `status=ok`.
- `npm run test:e2e`: the previous 0 ms `Local Core did not start` blocker is removed. 21 browser tests executed: 9 passed, 12 failed on inherited/stale UI interaction contracts. These failures are tracked separately and are not hidden by this runtime correction.

## Risk and rollback

- Risk: invoking Local Core without first generating `packages/contracts/dist/index.js` now fails explicitly. All maintained root launch/build paths generate it first.
- Rollback: revert this commit to restore source export behavior, which also restores the known Node runtime failure.

## Remaining

- Reconcile the 12 browser failures against the frozen v0.1 interaction decisions; update stale tests only where the product behavior is intentional, and fix real regressions separately.
