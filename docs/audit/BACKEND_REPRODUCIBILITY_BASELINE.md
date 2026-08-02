# LCOS Backend Reproducibility Baseline

> Date: 2026-08-02
> Slice: H0A
> Status: H0A complete; ready for review

## Decision

Use the Git tree as the canonical backend delivery source. Do not use flattened
or manually assembled ZIP packages as merge evidence. A deterministic SHA-256
manifest covers every tracked file except the manifest itself.

## Baseline

```text
source branch: codex/mvp-fast-build
source HEAD: ffe8045
hardening branch: codex/backend-hardening-20260802
Node: v22.22.3
npm: 10.9.8
Python: 3.12.10
tracked files before H0A: 522
```

The source worktree was clean before creating the hardening branch. The
Universal Resource Import U0-U5 baseline already existed as commit `ffe8045`,
so no synthetic duplicate baseline commit was created.

## Reproducibility Contract

- Preserve the monorepo directory hierarchy.
- Generate archives from a clean Git tree, never from an ad-hoc file list.
- Hash known text formats after canonical LF normalization and hash binary
  formats as raw bytes. This keeps the same manifest valid for a Windows
  checkout and for Git ZIP exports that normalize mixed line endings.
- Reject normalized path collisions before packaging.
- Reject tracked build/cache artifacts.
- Exclude `MANIFEST.sha256` from its own hash set.
- Verify the manifest after generation and before delivery.

Commands:

```powershell
npm run audit:manifest:write
npm run audit:manifest:verify
```

## Validation

The staged Git index was exported to a new directory under the Windows temp
root. That directory contained no `.git` metadata and did not reuse the source
worktree's dependencies.

| Check | Actual result |
|---|---|
| Clean index export | PASS; monorepo hierarchy preserved |
| `npm ci` in exported directory | PASS; 68 packages, 0 vulnerabilities |
| Web unit | PASS; 121 / 121 |
| Local Core unit | PASS; 164 / 164 |
| Domain unit | PASS; 5 / 5 |
| Contracts unit | PASS; 4 / 4 |
| Normalized path collisions | PASS; 0 |
| Tracked generated artifacts | PASS; 0 |
| SHA-256 manifest | PASS; 524 source files; manifest excludes itself |
| `git diff --check` | PASS |

The Web tests emitted two expected `not a git repository` diagnostics while
reading optional development build identity from the exported tree. They did
not affect test execution or product behavior; all Web tests passed.

## Known Limitations

- This Slice does not create a distributable ZIP. It establishes the canonical
  inputs and validation needed to create one without path flattening.
- `.dev-launcher/target.json` remains an intentionally tracked, machine-specific
  launcher guard from the earlier MVP worktree. It is not a backend source
  artifact and currently prevents `dev:open` on the hardening branch. Its
  configuration ownership must be corrected with the launcher changes in H0B;
  H0A does not silently weaken that guard.
- H0B API authentication and H0C import transaction hardening are intentionally
  not included.

## Rollback

Revert the H0A commit. No Schema, Runtime, project file, or user data migration
is involved.
