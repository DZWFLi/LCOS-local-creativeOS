# WorkBuddy UI 包接入全过程明细与事故审计（2026-07-31）

> 读者：Codex（接管方）
> 作者：WorkBuddy（Buddy）
> 结论先行：**Porcelain Studio 2.0 视觉层未完整接入当前 worktree。`porcelain-studio.css` 文件存在但从未被引用；App.tsx / main.tsx / model.ts 均为旧版内容。UI 实际停留在 v0.7.1（旧视觉），不是 Porcelain。**
>
> **UPDATE（17:35）：Buddy 已二次修复，Porcelain Studio 2.0 完整接线成功。最终 commit `2d6f27b`。见第 7 节。**

---

## 1. 事故摘要

| 项 | 值 |
|----|-----|
| 输入包 | `C:\Users\1\Desktop\OS开发\LCOS_MVP_UI_Porcelain_Studio_2.0_20260730.zip` |
| 包声明版本 | web 0.7.3 / root 0.7.3 |
| 当前 worktree 版本 | web 0.7.3 / root 0.7.3（修复后） |
| 最终 commit | `2d6f27b`（Porcelain 完整接线） |
| 当前 porcelain 状态 | `porcelain-studio.css` 被 main.tsx 引用、App.tsx 带 `porcelain-studio-v2` 类、nodeMeta 七色匹配 PS tokens |
| 首次事故根因 | worktree 重建时 robocopy 用 `/XO`（exclude older）跳过备份中时间戳较旧的文件，导致 App.tsx / main.tsx / model.ts 未被 porcelain 版本覆盖 |

---

## 2. 时间线与每一步操作

### 阶段 A：包内审计（07-31 ~14:11）

1. 解压 UI 包到 `C:\Users\1\AppData\Local\Temp\lcos-ui-review\`。
2. 读 `CODEX_START_HERE_PORCELAIN_STUDIO_2.0.md`，确认冻结边界：不得改 Project/Scope/Workspace 行为、Canvas 交互、Run 流程、Runtime/Contract/Schema。
3. 包内实际变更声明：新增 `porcelain-studio.css`、`main.tsx` 末尾加载、App 根加 `porcelain-studio-v2` 类、Canvas Node 加 `data-node-*` 属性、nodeMeta 语义色调整、版本升至 0.7.3。
4. SHA 对比：`runtimeBridge.ts`、`localCoreClient.ts` 与 worktree **完全一致**（Runtime 合同未动）。✅
5. CSS 文件 `foundation.css` / `surface.css` / `v07.css` / `v071.css` 与 worktree **完全一致**（设计工作室没改它们，视觉全在新 CSS 里）。✅

### 阶段 B：向旧 worktree 复制（07-31 ~14:15）

6. 用 PowerShell `Copy-Item -Force` 向 `E:\Codex 项目\OS开发\.worktrees\mvp-fast-build` 复制 **26 个文件**：
   - 新增 `apps/web/src/porcelain-studio.css`
   - `apps/web/src/model.ts`、`main.tsx`、`App.tsx`
   - `features/canvas/`：CanvasMiniMap、CanvasNodeVisual、NodeContextToolbar、NodeInfoPopover、ProjectCanvas
   - `features/create/`：CreateContentDialog、LinkReferenceDialog、ProjectCreateDialog、RunConfirmDialog、ScopeCreateDialog
   - `features/diagnostics/`：RuntimeDiagnosticsPage、runtime-diagnostics.css
   - `features/handoff/HandoffDialog.tsx`
   - `features/project/ProjectDrive.tsx`
   - `features/shell/`：CapabilityPopover、V07TopBar
   - `features/ui/`：ConfirmDialog、InlineNodeRename
   - `features/workrail/`：PreviewSurface、WorkRail
   - `features/workspace/`：WorkspaceDialog、WorkspaceDock
7. 质量链通过：lint 0 err / typecheck 4/4 / web test **113/113** / build PASS。⚠️ 注意：这些测试只验证"代码能编译、逻辑没坏"，**不验证 porcelain CSS 是否生效**（vitest 不渲染浏览器）。
8. 验证 `data-testid="creative-os-app"`、`data-testid="canvas"` 等 14 处 E2E 合同保留。✅

### 阶段 C：worktree 损坏与修复（07-31 ~14:49-16:52）

9. **背景**：原 worktree 是孤儿状态（昨天 commit `aa8f80a` 建立在 orphan worktree 上），git 元数据损坏，`git status` 报 "bad object HEAD"，launcher 拒绝启动（"Refusing to start from unexpected branch (detached)"）。
10. 尝试 1：`git update-ref` + 手写 ref 文件 → 失败（commit 对象 aa8f80a 在主仓库 object store 中**不存在**，属 worktree 私有对象，已被清理）。
11. 尝试 2：`git worktree remove --force` → 失败（目录被 dev 进程锁定）。
12. Dz 关闭进程后：`Move-Item` 旧目录 → `_mvp-fast-build-bak`，从 commit `a896cd5` 重建新 worktree + 新分支 `codex/mvp-fast-build`。
13. 用 robocopy 从 `_mvp-fast-build-bak` 向新 worktree 搬回所有文件，**关键参数 `/XO`（exclude older）**，意图是"保留新 worktree 中较新的文件"。
14. ⚠️ **事故点**：备份目录中的 porcelain 版本 `App.tsx`/`main.tsx`/`model.ts` 文件时间戳为 07-30，而新 worktree 从 `a896cd5` checkout 出的同路径文件时间戳为 07-31。robocopy `/XO` 判定备份文件"更旧"，**跳过不覆盖** → porcelain 接线丢失。
15. 提交 `cd51c7f`（148 files, +17955）：实际内容 = a896cd5 的旧 UI + 孤立的 porcelain-studio.css + 备份中未冲突的文件。

### 阶段 D：local-core 编译失败与补救（07-31 ~17:01-17:16）

16. `npm run build --workspace @local-creative-os/local-core` → **133 个类型错误**（`@local-creative-os/domain`/`contracts` 缺 FileRecord/PreviewRecord/RunReview 等导出）。
17. 原因：新 worktree 的 packages/ 与 apps/local-core/ 仍为 a896cd5 旧版，与备份中较新的源码不匹配。
18. robocopy 同步 packages ×2 轮（首轮 `/XO` 失败，改 `/IS /IT` 强制覆盖）→ 错误 133→61→17。
19. 最后强制覆盖 `apps/local-core/src` → **0 错误**，build 成功，`dev:open` 可启动（Core 200 / Web 200 实测）。
20. 提交 `45932be`、`a4a7332`（修复 packages 与 local-core 同步）。

---

## 3. 最终 git 状态

```
codex/mvp-fast-build @ a4a7332
├── cd51c7f  feat: Porcelain Studio 2.0 UI integration + E2E fix + merge gate handoff（实际未接线）
├── 45932be  fix: sync packages/contracts and packages/domain from worktree backup
└── a4a7332  fix: full sync packages/contracts, packages/domain, local-core from backup
```

| 文件 | 期望（Porcelain） | 实际 | 状态 |
|------|------------------|------|------|
| `apps/web/src/porcelain-studio.css` | 新文件 | 存在，被跟踪 | ⚠️ 孤儿文件 |
| `apps/web/src/main.tsx` | +1 行 import porcelain | 旧版（无 import） | ❌ 未接线 |
| `apps/web/src/App.tsx` | 根元素 `porcelain-studio-v2` 类 | 旧版（无该类） | ❌ 未接线 |
| `apps/web/src/model.ts` | nodeMeta 低饱和色 | 旧版 | ❌ 未接线 |
| 14 个 feature 组件 | porcelain 类名 | 旧版 | ❌ 未接线 |
| `apps/web/package.json` | 0.7.3 | 0.7.1 | ❌ 版本未更新 |
| root `package.json` | 0.7.3 | 0.6.1 | ❌ 版本未更新 |

---

## 4. 根因复盘（Buddy 的责任）

1. **robocopy 用错参数**：`/XO` 在"备份→新 worktree"方向是反的。应使用 `/IS /IT` 强制覆盖（阶段 D 的教训本应在阶段 C 就应用）。
2. **提交未验证**：`cd51c7f` 提交前未 grep 验证 `porcelain-studio-v2` 类是否真的进了 App.tsx——质量链跑的是测试，不是视觉接线验证。
3. **没有把"文件已复制"与"UI 已生效"区分开**：lint/typecheck/test/build 全绿给了虚假安全感，Vitest 不渲染浏览器，CSS 接线错误测不出来。
4. **worktree 修复过程拖太久**：孤儿 worktree 问题昨天就该彻底重建，拖到今天与 UI 接入叠加，放大了事故。

---

## 5. 修复指引（给 Codex）

正确接入 = 用包内 porcelain 版本覆盖这些文件（包在 `C:\Users\1\AppData\Local\Temp\lcos-ui-review\LCOS_MVP_UI_Porcelain_Studio_2.0_20260730\` 或重新解压 zip）：

```
apps/web/src/App.tsx
apps/web/src/main.tsx
apps/web/src/model.ts
apps/web/src/porcelain-studio.css          # 已有，校验内容
apps/web/src/features/canvas/*.tsx         # 5 个
apps/web/src/features/create/*.tsx         # 5 个
apps/web/src/features/diagnostics/*        # 2 个
apps/web/src/features/handoff/HandoffDialog.tsx
apps/web/src/features/project/ProjectDrive.tsx
apps/web/src/features/shell/*.tsx          # 2 个
apps/web/src/features/ui/*.tsx             # 2 个
apps/web/src/features/workrail/*.tsx       # 2 个
apps/web/src/features/workspace/*.tsx      # 2 个
apps/web/package.json                       # 0.7.3
package.json                                # 0.7.3
```

覆盖后必须验证：
1. `grep porcelain-studio-v2 apps/web/src/App.tsx` → 有
2. `grep porcelain apps/web/src/main.tsx` → 有 import
3. `grep -c "ps-source\|#6687b8" apps/web/src/model.ts` → >0
4. `npm run build`（web）→ PASS
5. 浏览器打开 `http://127.0.0.1:5173` → Canvas 暖白 `#f4f4f1`，Porcelain Card 风格
6. 113 web tests 保持全绿
7. Runtime 合同回归：`runtimeBridge.ts` / `localCoreClient.ts` 与包内 SHA 一致

> 注：备份目录 `E:\Codex 项目\OS开发\.worktrees\_mvp-fast-build-bak` 保留完整 porcelain 版源码，可作为第二来源。验证通过后此目录可删。

---

## 6. 需要 Codex 决策

- 本次 porcelain 接线错误的责任在 Buddy，不改动任何 Runtime 合同，风险可控。
- 是否由 Codex 直接完成接线并提交，还是退回上一版重新走流程？
- `_mvp-fast-build-bak` 保留期限。

---

_WorkBuddy 2026-07-31 17:20 生成，如实记录_

---

## 7. 二次修复（Buddy，17:35）—— 已成功

### 关键认知修正
- **porcelain 包 = 完整最新源码 + 视觉层**（不只是 26 个视觉文件）
- 包的 runtime/state/tests 本身就是匹配的整套源码（含 `updateActiveContext`、`ActiveContextProjection` 等最新 API）
- git HEAD 里的 runtime/state 反而是被 `/XO` 跳过的新文件缺失版本
- 正确做法：**整个 `apps/web/src` + `apps/web/tests` 用包内版本强制覆盖（/IS /IT）**，再补 package.json 版本号

### 修复步骤
1. `robocopy porcelain/apps/web/src → worktree/apps/web/src /E /IS /IT`
2. `robocopy porcelain/apps/web/tests → worktree/apps/web/tests /E /IS /IT`
3. 覆盖 `apps/web/package.json` + `package.json`（0.7.3）

### 接线验证（全绿）
| 检查点 | 结果 |
|--------|------|
| `grep porcelain-studio-v2 App.tsx` | ✓ 1 处 |
| `grep porcelain main.tsx` | ✓ `import './porcelain-studio.css'` |
| `nodeMeta` 七色匹配 PS tokens（#6687B8/#496FAE/#7556C9/#4D9084/#6F7D89/#AA7B3E/#B45F54） | ✓ |
| `porcelain-studio.css` 60KB | ✓ |
| 版本 0.7.3（root + web） | ✓ |

### 质量链（全绿）
| 阶段 | 结果 |
|------|------|
| web typecheck | 0 error |
| web test | 28 files / 113 tests PASS |
| web build | PASS（CSS 235KB 含 porcelain） |
| local-core typecheck | 0 error |
| 运行时验证 | Core :43121 health 200 / Web :5173 200，Vite 实际服务 porcelain-studio.css，VITE_LCOS_VERSION=0.7.3 |

### 最终 commit
```
2d6f27b feat: Porcelain Studio 2.0 完整接线（修复此前 /XO 导致的接线丢失）
```

### 经验（必须固化）
1. robocopy 从备份/包目录→worktree，必须用 `/IS /IT`（含相同/旧文件），**禁止 `/XO`**
2. UI 包接入时：质量链通过 ≠ 接线成功，必须验证接线点（grep 类名/import/颜色 token）
3. 视觉接入验证必须做浏览器级验证（Vite 实际服务 CSS、VERSION 常量），不能只看 vitest
4. porcelain 包是完整源码基线，不是补丁——整体覆盖而不是挑选文件
