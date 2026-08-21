# BUILD INFO · LCOS PASS8 Standalone Desktop + Capture Baseline

日期：2026-08-18

## Freeze

```text
PASS8 = S10 productization source
      + PASS5 productization closeout
      + PASS6 Electron Desktop Alpha
      + PASS7 Capture convergence
      + PASS8 standalone baseline hardening
```

这是新的单一源码基线。不要再叠加 PASS6/PASS7 patch。

## PASS8 新增的工程收口

- Capture Float 保存屏幕位置，并在显示器布局变化后安全回落到主屏右下角。
- Capture Float drag-depth 计数，避免拖过内部子元素时 receiving 状态闪烁。
- Codex managed integration 更新时先清理旧托管副本，避免旧 MCP/Skill 文件残留。
- `baseline:bootstrap`：恢复依赖 + 刷新 Desktop workspace lockfile + ready doctor。
- `desktop:doctor`：检查 Desktop/Capture source、lockfile、依赖、端口和 Windows release prerequisites。
- Electron generated runtime/out/bridge build 目录加入 `.gitignore`。
- 根 `CODEX_START_HERE.md` / `PACKAGE_INFO.md` 已改为 PASS8 当前交接，旧版本归档在 `docs/archive/pre-pass8-root-handoffs/`。

## 当前不能在本环境完成的 Gate

当前容器无法解析 npm registry（`EAI_AGAIN`），因此无法替 Windows worktree 刷新 Electron/Forge 的 lockfile，也没有 Windows 环境生成 Squirrel installer。

这不是源码实现缺口。Codex 第一次在联网 Windows worktree 执行：

```bash
npm run baseline:bootstrap
```

即可恢复并锁定这些依赖。

## Windows QA 仍必须真实执行

- full typecheck/test/build
- deterministic S10 gate
- `desktop:start`
- Main Window + Runtime Supervisor
- Capture Float file/text/url drop
- Capture Space persistence + AI organize
- Capture → Existing Project Semantic Drop
- restart / exit orphan-process check

只有这些通过后，才进入 `desktop:make:win`。
