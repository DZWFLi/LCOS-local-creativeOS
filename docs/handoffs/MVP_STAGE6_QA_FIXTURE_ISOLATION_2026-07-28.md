# MVP Stage 6 — QA Fixture Isolation

Date: 2026-07-28
Branch: `codex/mvp-fast-build`
Base before this slice: `4fdd2ea docs(audit): inventory legacy portasplit fixtures`

## Summary

Started the legacy PortaSplit cleanup by isolating frontend fixtures into an explicit QA namespace.

This slice does not delete fixture scenarios. It moves them out of generic production-looking paths and gates `?state=` / `?perf=` query scenarios to development builds only.

## Implemented

- Moved fixture files:
  - `apps/web/src/fixtures.ts` → `apps/web/src/qa-fixtures/fixtures.ts`
  - `apps/web/src/state/projectFixtures.ts` → `apps/web/src/qa-fixtures/projectFixtures.ts`
  - `apps/web/src/adapters/fixtureAdapter.ts` → `apps/web/src/qa-fixtures/fixtureAdapter.ts`
- Updated App and test imports to use `qa-fixtures`.
- Gated QA URL parameters behind `import.meta.env.DEV`:
  - `?state=...`
  - `?perf=...`

## Not implemented

- No fixture data deletion.
- No CSS deletion.
- No Bridge / Run semantics.
- No Artifact Return cleanup.
- No visual rewrite.
- No Schema or Domain changes.

## Flow

Before:

```text
Production-looking App imports
→ ./fixtures
→ ./state/projectFixtures
→ ?state= can seed QA states anywhere the code runs
```

After:

```text
App imports explicit QA namespace
→ ./qa-fixtures/fixtures
→ ./qa-fixtures/projectFixtures
→ ?state= and ?perf= only work in DEV
```

## Files

- `apps/web/src/App.tsx`
- `apps/web/src/qa-fixtures/fixtures.ts`
- `apps/web/src/qa-fixtures/projectFixtures.ts`
- `apps/web/src/qa-fixtures/fixtureAdapter.ts`
- `apps/web/tests/fixtures.test.ts`
- `apps/web/tests/fixtureAdapter.test.ts`
- `apps/web/tests/projectSessions.test.ts`
- `apps/web/tests/workContext.test.ts`
- `apps/web/tests/canvasScopes.test.ts`
- `apps/web/tests/scopeLayout.test.ts`
- `apps/web/tests/v06Phase31Hotfix.test.ts`
- `docs/handoffs/MVP_STAGE6_QA_FIXTURE_ISOLATION_2026-07-28.md`

## Tests

Focused:

```text
npm run typecheck --workspace @local-creative-os/web
npx vitest run apps/web/tests/fixtures.test.ts apps/web/tests/fixtureAdapter.test.ts apps/web/tests/projectSessions.test.ts apps/web/tests/workContext.test.ts apps/web/tests/canvasScopes.test.ts apps/web/tests/scopeLayout.test.ts apps/web/tests/v06Phase31Hotfix.test.ts --reporter=verbose
```

Result:

```text
PASS
20 passed
```

## Browser / Runtime visible change

In dev, QA routes remain available.

In production build semantics, `?state=` and `?perf=` no longer seed QA states because those parameters are ignored unless `import.meta.env.DEV` is true.

## Risk

The production App still has an explicit Demo fallback path for offline Local Core. This slice isolates fixtures structurally but does not yet remove all Demo fallback logic.

## Next

Recommended next cleanup slice:

```text
Production copy cleanup:
ProjectCreateDialog / ScopeCreateDialog / WorkspaceDialog / Diagnostics placeholders
```

Then:

```text
Prop-drive CanvasNodeVisual and PreviewSurface content
```

