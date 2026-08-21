# LCOS 更新包接收与合并 SOP（固定流程）

> 适用场景：UI/开发侧每交付一次更新（patch + SHA256 + notes，或整包 + 校验文件）时，Codex 侧必须按本流程执行。目的：每次更新可复现、不丢本地修复、不把模型变更当回归、不留假验收。

## 0. 收到更新包后，先做这三件事（顺序不可乱）

1. **核对 SHA256**：`Get-FileHash <patch> -Algorithm SHA256` 必须与随附校验文件完全一致；不一致立即停下报告，不应用。
2. **读 notes**：冻结/修订的模型、基线版本、明确未关闭的 debt、真机 Gate 清单。**notes 里说的「本轮不得覆盖」区域（如 Rail UX 文件）在合并时视为禁区**。
3. **核对基线**：notes 声明的基线（如 R3.1A3 + A3.1）与当前 HEAD 是否一致；不一致时预期会有冲突，按第 2 节处理，不要惊讶、不要退回。

## 1. 合并前预检

```bash
git status --short          # 记录当前未提交改动（历史积累，正常）
git apply --check <patch>   # 找出真正冲突的文件
```

- 预检失败 ≠ patch 坏：绝大多数是基线差异或本地改动叠加。
- 用 `--exclude` 把干净部分先应用，冲突文件单独手工合并：

```powershell
git apply --exclude=<file1> --exclude=<file2> <patch>
```

## 2. 冲突文件手工合并规则

1. **保留本地修复**：本地已有且语义更新的写法（如变量重构、跨 Scope 修复）不被 patch 回退。
2. **叠加新语义**：patch 新增的能力（新字段/新函数/新模型）必须完整落入本地文件。
3. **合并后立即用 typecheck 兜底**：函数签名一变，所有调用点必须同步（本轮先例：`memberEntityRefs` 全链路）。
4. **README/决策稿等文档冲突**：以新模型为准替换旧区块，并保留旧记录指针。

## 3. 旧契约测试失效的处理（重要：不是回归）

- 模型变更后，旧断言「预期新行为」失败 = **预期失效**，不是 bug。
- 先对照 notes 确认该断言描述的是被替换的旧模型（本轮先例：v06 Collection 子画布、v07 Workspace 与 Scope 的关系、projection 节点字段、Context dot 点击格式）。
- 按**实际新代码**修订断言（不要按想象写），修订时保持测试的「契约验证」性质，不删成空壳。
- 拿不准的失效先问，不擅自放宽断言。

## 4. Core 侧

- patch 自带 Core 代码在严格模式下常会报类型错（本轮：`delete_workspace` 的 `projectId` 可为 undefined）。
- 修编译错误，不关严格模式、不改 `any`：加守卫/窄化，保持与原语义一致。

## 5. 验证门禁（按顺序，全过才算合并完成）

```text
git diff --check
→ web typecheck
→ local-core typecheck
→ web vitest（排除 3 个环境级 e2e spec：golden-path / interaction-foundation / vnext-phase4，它们在加载期失败且与改动无关）
→ local-core vitest
→ web vite build
→ local-core tsc 构建
```

本机基线（2026-08-14）：web 195 files / 944 tests；local-core 80 files / 394 tests。新增测试必须出现在结果里（确认真的跑了）。

## 6. 运行时与浏览器冒烟

1. 开发栈已死则重启：`npm run dev:stack`（vite 5173 / local-core 43121 / bridge），确认端口监听。
2. 无头浏览器加载项目页（Playwright）：rail 项、主画布、底栏「上下文/工作流」在位，无致命 console 错误。
3. 404 分类：`presentation:*` 首次 NOT_FOUND → 自动播种，正常；其余 404 才是问题。
4. 浏览器插件远程控制通道不可用时，如实告知用户手动刷新，不用别的自动化冒充。

## 7. 真机 A Gate 与 GUI 修复

- 按 notes 的 Gate 清单逐项让用户手测（Context/Workflow Graph、右键投送、reload 成员保持、Collection 不克隆、Rail 新 UX 不被覆盖）。
- 用户报的 GUI 问题按根因修，修完必须用无头浏览器复现「修复前失败 → 修复后通过」（本轮先例：rail 指针捕获劫持 click、底栏主画布不退出 Workspace 场景）。

## 8. 文档与欠账（每轮必须更新）

- `docs/OPEN_DEBTS.md`：合并状态、修复记录、明确未关闭的 debt（不得把 debt 伪装成完成）。
- `docs/handoffs/`：新交接 MD，至少含：来源与校验、合并清单、手工合并明细、测试修订、验证结果、待办 Gate、回滚方式。
- 模板参考：`docs/handoffs/R31A_CLOSEOUT_UPDATE_FLOW_20260814.md`。

## 9. 提交纪律

- 不自动 push、不自动 commit；等用户确认。
- 建议拆分：`merge` 一个 commit + `fix` 一个 commit，历史可单独 revert。
- 提交后回滚用 revert，不重写历史。

## 10. 回滚

- 未提交：丢弃工作区即可（本轮无 schema migration，`memberEntityRefs` 可选，旧数据兼容）。
- 已提交：按 merge/fix 两个 commit 逐个 revert。

## 常见坑速查（本轮先例）

| 坑 | 处理 |
| --- | --- |
| `git apply --check` 失败 | 基线差异 → `--exclude` 分治 + 手工合并，不是退回 |
| 旧测试报「不包含 createChildScopeFromSelection」 | 模型已改 → 按新语义修断言 |
| Core tsc 报 undefined 参数 | patch 自带代码严格模式问题 → 加守卫 |
| 侧栏视图点不动 | 指针捕获劫持 click → 拖过阈值才捕获 |
| 空视图回不到主画布 | 底栏主画布提前返回未清场景 → 补清 workspace/workflow |
| 一进项目一堆 presentation 404 | 首次播种正常，不是错误 |
