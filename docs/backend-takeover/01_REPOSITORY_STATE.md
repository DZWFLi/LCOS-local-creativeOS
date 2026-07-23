# Repository State

## 1. Git 现场

执行时间：2026-07-23。

```text
branch: refactor/reusable-review-core
HEAD:   1f856971e789aac73a84ab4d963d80cf321dfd91
```

工作区明显不干净：

- 已修改：`index.html`、`package.json`、`package-lock.json`；
- 未跟踪：`apps/`、`packages/`、`tests/e2e/`、多张截图、前端测试目录、后端交接目录等；
- `git diff --stat`：3 files changed, 68 insertions, 12 deletions；
- `git diff --check`：返回 0；仅有 LF→CRLF 警告；
- `apps/local-core`：不存在（`Test-Path` 为 `False`）。

当前 HEAD 仍是旧 AdFrame 基线向 Workspace 重构过渡的提交；工作区内的 Web、Domain、Contracts 并未进入 Git 真相。

## 2. 候选包真实性

ZIP 实测 SHA256 与交接一致：

```text
0EEEDB459F3AC778053E2C5885EDD205FDD32208F27D62FCE262C77D5ED40626
```

候选包回归结论是 `PARTIAL PASS`，不是正式已合并发布：

- 22 test files / 73 tests；
- build 1802 modules；
- Chrome console 0 error / 0 warn；
- Child Scope 返回父层后缺可重进 Container；
- Accept / Checkpoint 仅 Fixture 状态证明，没有同一正常链闭环。

## 3. 主仓库与候选包哈希差异

比较范围：`apps/web`、`packages/domain`、`packages/contracts`、`packages/ui`、`scripts`、根 `package.json`、lockfile、`index.html`；排除 `node_modules`、`dist`、coverage。

| 类别 | 数量 | 说明 |
|---|---:|---|
| 候选包独有 | 37 | Work Rail、Project Drive、Scope、Clipboard、History、v0.6 测试等 |
| 同路径不同内容 | 20 | App、Canvas、Workspace、Fixture、根脚本和 lockfile 等 |
| 主仓库独有 | 8 | 旧 Inspector、Command、NodeStatusOverlay、旧样式与旧 Run 测试等 |
| 内容相同 | 13 | 包括当前 Domain / Contracts 实现 |

因此 `apps/web` 不是候选包的可靠同义副本。不能在当前 Web 上直接实现后端 Adapter 后再假设可无冲突套入 v0.6.0。

候选独有的关键文件包括：

- `ProjectDrive.tsx`、`WorkRail.tsx`、`PreviewSurface.tsx`；
- `canvasScopes.ts`、`prototypeStorage.ts`、`workContext.ts`；
- Scope / Layout / Clipboard / History / Creation Flow 相关测试。

主仓库独有关键文件包括旧 `Inspector.tsx`、`CommandComposer.tsx`、`NodeStatusOverlay.tsx`，整合时必须由前端 owner 决定保留或删除，后端不得代选。

## 4. 质量命令

根仓库已有五条命令均执行，未创建新命令：

| 命令 | 退出码 | 实际结果 |
|---|---:|---|
| `npm run lint` | 0 | 2 条 React hooks `exhaustive-deps` warning |
| `npm run typecheck` | 0 | Web TypeScript 通过 |
| `npm run test` | 0 | 31 files / 98 tests |
| `npm run build` | 0 | 1789 modules；生成 2 个 assets |
| `npm run smoke` | 0 | Preview 与 2 个 assets 可访问 |

证据限制：

- 根脚本只显式调用 `@local-creative-os/web`；
- Web Vite 配置 `root: '../..'`，`vitest run` 从仓库根收集测试；
- 候选展开目录位于仓库内，因此 31/98 是混合工作区结果，不能作为当前主仓 Web 的隔离测试证明；
- build 写入根 `dist/`，但没有业务源码修改。

包级补测：

| Package | lint | typecheck | test |
|---|---|---|---|
| Domain | PASS | PASS | 1 file / 3 tests |
| Contracts | PASS | PASS | 1 file / 1 test |

## 5. 推荐基线

推荐顺序：

1. 前端 owner 以候选 ZIP 哈希为输入，执行可审查整合；
2. 从仓库测试发现范围中排除 `前端测试/`、证据包与临时展开目录；
3. 根质量门显式覆盖 Web、Domain、Contracts；
4. 完整质量链通过后创建一个新的前端集成基线提交；
5. 从该提交创建 `codex/backend-phase-0` 独立 worktree。

不推荐：

- 继续在当前脏目录多人并行；
- 从当前 HEAD 创建干净 worktree 后手工复制未跟踪的候选文件；
- 把 ZIP 回归结果当成主仓质量结果；
- 后端自行解决前端独有/删除文件选择。
