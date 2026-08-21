# DEV CMD Failure Diagnosis

Date: 2026-07-27

## Checked files

- `C:\Users\1\Desktop\OS开发\启动 Local Creative OS Dev.cmd`
- `C:\Users\1\Desktop\OS开发\关闭 Local Creative OS Dev.cmd`

## Original content

```bat
@echo off
chcp 65001 >nul
cd /d "E:\Codex 项目\OS开发\.worktrees\phase3-stage1-4"
npm run dev:open
```

```bat
@echo off
chcp 65001 >nul
cd /d "E:\Codex 项目\OS开发\.worktrees\phase3-stage1-4"
npm run dev:stop
pause
```

## Root cause

1. The desktop CMD files hard-coded the current Phase 3 worktree, so they would silently become stale after the active test target moved.
2. The start CMD used `npm run dev:open` directly instead of `call npm.cmd run dev:open`; double-click Windows CMD sessions can exit or fail differently from an interactive shell, especially when PATH or batch invocation differs.
3. The desktop had two user-facing entries, start and stop, even though the V2 launcher lifecycle should stop services when the LCOS app-mode browser window exits.
4. The repository launcher recorded parent npm PIDs, while the listening ports are owned by child node processes. A repeat launch could therefore misclassify an old managed LCOS process as a foreign port conflict.

## Fix direction

- Keep all launch logic inside `scripts/dev-launcher.mjs`.
- Add `.dev-launcher/target.json` as the explicit test target.
- Keep desktop CMD as a thin entry only.
- Make the launcher consider child processes of recorded PIDs as managed LCOS processes.
