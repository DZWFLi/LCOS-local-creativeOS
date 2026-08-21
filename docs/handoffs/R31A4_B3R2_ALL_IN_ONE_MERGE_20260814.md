# R3.1A4–B3-r2 All-in-One 本地合入交接（2026-08-14）

## 任务摘要

将 `LCOS-R3.1A4-B3R2-ALL-IN-ONE-20260814.patch` 保留式合入当前脏工作树，修订被新产品语义替代的历史契约测试，并完成代码级质量门禁。本轮没有 Commit 或 Push。

## 来源与校验

- 来源包：`C:/Users/1/Desktop/OS开发/第一性重构/8.14收口/LCOS-R3.1A4-B3R2-ALL-IN-ONE-20260814.patch`
- SHA256：`CB9B8B6A74A771A6DC0E6D9DEB8BAE58500077770A0A2E69B7F3B4E49FAB2CF8`
- 校验结论：与交付的 SHA256 文件一致。
- 合入前备份：`.codex-runtime/update-backups/20260814-r31a4-b3r2-preapply/`

## 实际范围

- Arrange：Freeform / Grid Presentation 模式、Grid 位移预览与提交、临时 Region、Region 显式提升 Collection。
- Context：项目级关系图与 Signal Track / Mind Map 详情投影，Selection 仅在明确加入后成为成员。
- Workflow：项目级 Graph 与 Edge-first Canvas；步骤放对象，条件、依赖、交接写在 Presentation 关系上；移除固定 Workflow Pages 与伪 operator UI。
- Identity：跨投影复用 DotGlyph。
- Navigation：Search 与 Focus 分流；F 定位，Ctrl/Cmd+F 搜索。
- Input：Tap / Companion 模式与右键浏览器默认行为保护。
- Local Core：schema 35 关系索引迁移及持久化测试同步。

## 变更流程

```text
交付 Patch + SHA
  → 校验哈希
  → 备份当前脏工作树
  → 无冲突文件批量应用
  → 3 个冲突文件保留式手工合并
  → 修订历史静态契约
  → 修订 schema 35 持久化断言
  → 静态门禁 / lint / typecheck / unit / build / diff-check
```

## 冲突与保护

- `apps/web/src/App.tsx`：保留既有 Rail、Light Curtain 与当前选择逻辑，同时接入 Collection 原地展开、Grid/Region、Search/Focus 新路径。
- `apps/web/src/features/canvas/ProjectCanvas.tsx`：保留既有画布交互，接入 Grid、Region、Collection 展开和 Focus affordance。
- `apps/web/src/features/surfaces/ContextRelationshipHomeSurface.tsx`：补齐 marquee 回调，不把 Context membership 重新做成 Core Truth。
- 未自动清理、覆盖或提交用户已有改动。

## 测试结果

- R3.1A4 static：13/13 PASS。
- R3.1A5 static：11/12；唯一失败是旧版“Search 与 Focus 同一入口”，已由 A6 冻结决策主动替代。
- R3.1A6 static：10/10 PASS。
- R3.1B1-r2 static：11/11 PASS。
- R3.1B3-r2 static：17/17 PASS。
- Web unit：93 files，432/432 PASS。
- Local Core unit：80 files，394/394 PASS。
- Domain unit：5/5 PASS。
- Contracts unit：6/6 PASS。
- lint：PASS（保留既有 warning，无 error）。
- typecheck：PASS。
- Web production build：PASS。
- Local Core build：PASS。
- `git diff --check`：PASS。

## 未验证

- 尚未执行真实浏览器鼠标手操 Gate：Grid 重排、Region 提升、Context 三投影、Workflow 连线与关系说明、右键跨空间投送、窄窗/侧栏动态适配。
- 尚未执行完整 Golden Path 与 Windows 原生壳验收。

## 风险

- 当前工作树在合入前已包含大量未提交 GUI 改动；虽然已做备份并逐冲突合并，但最终提交前仍需按批次审阅 diff。
- Web 构建仍报告大 chunk warning（ELK/Cytoscape/主包）；不阻塞本轮功能，但正式封装前应做代码分割与启动性能预算。
- schema 35 迁移已通过单测，真实历史项目数据库的备份升级仍需 Runtime/Golden Path 验证。

## 回滚

1. 不使用 `reset --hard`。
2. 以 `.codex-runtime/update-backups/20260814-r31a4-b3r2-preapply/tracked-working-tree.patch` 恢复合入前 tracked diff。
3. 以同目录 `untracked-files.zip` 恢复合入前未跟踪文件。
4. 对本轮变更采用逐文件审阅式反向 patch；数据库测试项目使用临时库，不回写真实项目。

## 下一步

按真实浏览器 Gate 清单集中手操验收；发现问题后只修与本轮能力相关的交互，不扩展产品对象模型。验收通过后再按用户授权拆分提交。
