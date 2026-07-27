# DEV LAUNCHER V2 REVIEW

Date: 2026-07-27

## Completed

- Added explicit launcher target config at `.dev-launcher/target.json`.
- Added `npm run dev:target`.
- Updated `scripts/dev-launcher.mjs` to validate target path and branch.
- Updated managed-process detection so child node processes of recorded npm PIDs are treated as LCOS-owned.
- Added a thin repository CMD entry at `scripts/open-lcos-dev.cmd`.
- Added an exceptional stop helper at `scripts/stop-lcos-dev.cmd`.

## Desktop policy

The desktop should expose one normal user entry:

```text
Local Creative OS Dev
```

The old separate start/stop CMD files are retired. Shutdown is controlled by closing the LCOS app-mode browser window. `npm run dev:stop` remains available for exceptional cleanup.

## Tests required

- `npm run dev:target`
- `npm run dev:status`
- `npm run dev:open`
- Repeat `npm run dev:open` while already running
- Close LCOS app window and confirm ports `5173` / `43121` are free

## Not changed

- No product data model changes.
- No Runtime Contract changes.
- No SQLite / Bridge / Watcher / Preview changes.
