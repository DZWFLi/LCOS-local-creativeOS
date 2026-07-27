# v0.6.1 Dev Launcher Handoff

## Summary

新增开发期一键启动 / 状态 / 关闭脚本，避免每次手工查端口、拼 PowerShell、猜 Health URL。

## Commands

```text
npm run dev:open
npm run dev:status
npm run dev:stop
```

## Behavior

- `dev:status` 显示 version、branch、commit、working tree 状态、记录 PID、5173 / 43121 端口占用。
- `dev:stop` 只关闭本 worktree `.codex-runtime` 记录的 LCOS 进程，包括旧 `dev-stack.pid`。
- `dev:open` 要求 worktree clean，随后启动 Local Core + Web，等待 Health / Web 就绪，打开独立 app-mode 浏览器窗口。
- 如果关闭 app-mode 浏览器窗口，launcher 会停止本次 Web + Local Core。
- 如果端口被非记录的进程占用，launcher 报告冲突并拒绝乱杀。

## Not Changed

- 无 SQLite schema / migration。
- 无产品 Contract 变化。
- 无真实用户文件写入。
- 无 lockfile 修改。

## Tests

```text
node --check scripts/dev-launcher.mjs
npm run dev:status
npm run dev:stop
```

Manual result:

```text
dev:stop released 5173 / 43121 from the previous LCOS dev stack.
```

## Next Verification

After committing this launcher:

```text
npm run dev:open
```

Expected:

```text
✓ Local Core 43121
✓ Web 5173
✓ Browser opened
```
