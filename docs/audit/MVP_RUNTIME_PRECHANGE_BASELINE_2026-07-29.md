# MVP Runtime Pre-change Baseline

Date: 2026-07-29
Branch: `codex/mvp-fast-build`
HEAD: `4341eb9`
Schema Version: `5`
Scope: pre-Schema / pre-Adapter baseline only

## Summary

The LCOS baseline is green before entering the Canonical Run / RuntimeDispatch
red zone.

The first `npm ci` attempt failed with Windows `EPERM` because the current
worktree's LCOS dev stack held the Rolldown native module open. Ownership was
verified with `npm run dev:status`; only the recorded LCOS stack was stopped with
`npm run dev:stop`. The second `npm ci` succeeded.

The dev stack remains stopped after this audit.

## Commands and results

```text
npm ci
PASS after stopping the recorded LCOS dev stack
68 packages installed
0 vulnerabilities

npm run check:fast
PASS

npm run test:integration
PASS — 1 file / 5 tests

npm run test:architecture
PASS — 3 files / 24 tests

npm run check
PASS
```

`check:fast` and `check` each included:

```text
lint
typecheck
unit tests
architecture tests
web build
```

Observed unit totals per pass:

```text
Web          26 files / 102 tests
Local Core   12 files /  85 tests
Domain        1 file  /   5 tests
Contracts     1 file  /   4 tests
Architecture  3 files /  24 tests
```

## Existing warnings

Eight lint warnings are present:

- seven in `apps/web/src/App.tsx`:
  - six React hook dependency warnings;
  - one unused-expression warning;
- one intentional-control-regex warning in
  `apps/local-core/src/import-copy-service.ts`.

Node also reports that `node:sqlite` is experimental.

No warning was treated as a passing test failure. No warning was fixed in this
read-only gate.

## Working tree effect

`npm ci` refreshed `node_modules` only. No package manifest or lockfile changed.
No product code, Schema or Runtime state was changed.

## Go / Stop

Baseline result: **GO for read-only Run / Schema audit**.

This baseline does not authorize Migration, Canonical Run or Adapter
implementation.

