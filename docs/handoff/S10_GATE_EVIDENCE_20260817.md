# S10 Gate 证据收集 · 2026-08-17（只收集，未修完）

> 按 CODEX_MINIMAL_SUPPLEMENT_REQUEST_S10 执行到 deterministic gate 暴露问题为止；
> 按 Dz 指示**只收集证据**，剩余修复交给 GPT。

## 1. 基线状态

- branch：`codex/r1-vision-merge-20260812`
- HEAD：`950acba`（S3 收口）+ 全部未提交改动（Pass1–Pass4、UI 缩放/右键收口、PASS5）
- 依赖：`npm ci` PASS（129 packages，0 vulnerabilities）
- PASS5 patch：**干净应用**（36 文件，0 冲突；路径归一化见下）
- PASS5 是 `diff -ruN` 格式，`---`/`+++` 深度不同：`--- /mnt/data/lcos_fullstack_0817/LCOS_FULLSTACK_0.1_FRONTEND_CLOSEOUT_20260817/` → `a/`，`+++ /mnt/data/LCOS_FULLSTACK_PRODUCTIZATION_PASS5_20260817/` → `b/` 后 `git apply -p1`

## 2. Deterministic Gate 结果

`npm run check:0.1:deterministic`（node scripts/productization-s10-release-gate.mjs --deterministic）

| 阶段 | 结果 |
| --- | --- |
| 1 lint | PASS（修复脚本后才能启动，见 §4） |
| 2 typecheck | PASS |
| 3 unit/contract tests | **FAIL**（首次 15/466；对齐旧契约后 1/466 残留） |
| 4+ architecture / integration / build / E2E / golden | 未执行（gate 在阶段 3 停止） |

## 3. 单元测试失败证据

### 3.1 首次失败（PASS5 刚应用、未做任何适配）：15 failed / 451 passed

8 个文件：

1. `productizationS4S8Contract.test.ts`（4）— **PASS5 自带测试路径 bug**：`webRoot = join(process.cwd(), 'apps','web','src')`，但 vitest workspace cwd 已是 `apps/web` → ENOENT `apps/web/apps/web/src/...`
2. `guiR31aCloseout.test.ts`（1）— 断言旧 `semanticRightDrop.ts` 内容；PASS5 已把它降级为 `semanticDrop.ts` 的兼容 re-export
3. `crossSurfaceDropContract.test.ts`（1）— 同上（surface 常量已迁到 `semanticDrop.ts`）
4. `newSceneSemanticDropContract.test.ts`（2）— 同上（常量 + Escape 处理在 `semanticDrop.ts`；rail 的 cancel 信号改为 `semanticDrop.current = null`）
5. `guiR31aProjectNodeFoundation.test.ts`（2）— 断言 `if (event.button === 2)` / `beginRightDrop`；PASS5 改为 `semanticDropTriggerFromPointer` / `beginCanvasSemanticDrop`
6. `guiR3DirectManipulation.test.ts`（1）— 同上 + 旧 `cancelRightDrop` / 左键注释
7. `dialogDismissalContract.test.ts`（1）— ImmersiveViewer 已迁移到 `@base-ui/react/drawer`（`dismissFromBackdrop` 协议不再适用）
8. `gui5ReorganizeContract.test.ts`（3）— ReorganizePanel 已改为 Drawer + proposal 语义（`lcos-reorganize-change-summary` / `移出当前画布` / `已安全撤回本轮整理`）

### 3.2 残留失败（对齐后）：1 failed / 465 passed

`guiR3DirectManipulation.test.ts > restores Right-button drag as the only cross-space drop gesture`

```
AssertionError: expected ProjectCanvas.tsx to contain 'const guard = (menuEvent: Event) =>'
```

- 测试期望本地命名守卫 `const guard = (menuEvent: Event) =>`；
- PASS5 的 `beginCanvasSemanticDrop` 内联赋值：`contextMenuGuard.current = (menuEvent: Event) => menuEvent.preventDefault()`（无 `const guard` 局部名）。
- 二选一由 GPT 决定：测试改为断言 `contextMenuGuard.current = (menuEvent: Event) =>`，或实现改为局部 `const guard` 再安装。

## 4. 本机已做的适配（GPT 复核用，均为最小改动）

1. `scripts/productization-s10-release-gate.mjs` — **Windows 必需**：原 `spawnSync('npm.cmd', ...)` 直接 EINVAL，改为 `node + npm_execpath` 方式（Linux 上无影响）。
2. `apps/web/tests/productizationS4S8Contract.test.ts` — webRoot 去掉重复 `apps/web`（修复 PASS5 自带路径 bug）。
3. 其余 7 个契约测试断言对齐到 PASS5 权威实现（§3.1 清单），未改任何业务代码。

## 5. Release Evidence 状态

- `docs/handoff/SESSION_10_REAL_HARNESS_EVIDENCE.md` 已按模板创建，**所有 REAL_HARNESS marker 未填**（真实 Codex harness 未执行；deterministic FAIL 也阻塞 release）。
- `npm run check:0.1:release` 未运行（前置 deterministic 未 PASS）。
- 未伪造任何 ID；Scripted/mock worker 未使用。

## 6. 复现命令

```bash
npm run check:0.1:deterministic
npm run test --workspace @local-creative-os/web
```

## 7. 交给 GPT 的最小任务清单

1. 修残留 1 个断言（§3.2）。
2. 重跑 deterministic gate 到全 PASS（含 E2E/golden，均未执行过）。
3. 执行真实 Codex Harness Golden Project（13 步），回填 `SESSION_10_REAL_HARNESS_EVIDENCE.md`。
4. 跑 `npm run check:0.1:release`。
