# Universal Resource Import — U5 交付（Workbench 展示 + Web 零表单入口 + E2E 收口）

> 日期：2026-08-02
> 依据：`CODEX_UNIVERSAL_RESOURCE_IMPORT_CODE_LEVEL_PLAN.md` Slice U5
> 状态：已完成，未提交（等待 Dz 指示）

## Decision

U5 完成：Web 新增「通用导入」面板（文件/文件夹/ZIP/链接，全部零表单）；节点资源理解状态实时显示；新增资源详情对话框（系统识别/能力/Read First/安全状态/重新分析/内容预览）；浏览器 E2E 覆盖零表单导入与重启恢复。**GPT 方案五个 Slice（U0–U5）全部完成。**

## Current evidence

- `apps/web/src/features/resources/UniversalImportPanel.tsx`：文件（多选）、文件夹（webkitdirectory + webkitRelativePath → base64）、ZIP（multipart）、链接四个入口；仅可选备注；客户端执行单文件 10MB / 总数 50MB / 200 文件限制
- `apps/web/src/features/resources/ResourceDetailDialog.tsx`：按 artifactId 查资源 → 展示 detectedKinds（高可信/可能/待确认）、能力、Read First、信任/可读/可执行、摘要、警告、内容预览；「重新分析」按钮
- 节点状态：导入后节点 subtitle 显示 已理解/部分理解/理解失败/理解中；60s 轮询刷新（仅 Runtime 模式）
- 入口：快捷能力面板新增「通用导入」；节点状态浮层新增「资源理解」按钮
- E2E：新增「链接 + Skill 文件夹零表单导入 → 重载后 Descriptor 仍在」用例，7/7 通过

## Changed files

| 文件 | 变更 |
|---|---|
| `apps/web/src/features/resources/UniversalImportPanel.tsx` | 新建 |
| `apps/web/src/features/resources/ResourceDetailDialog.tsx` | 新建 |
| `apps/web/src/runtime/localCoreClient.ts` | importResourceDirectory / importResourceArchive / resourceRead |
| `apps/web/src/App.tsx` | 面板/详情接入、reloadRuntimeProject、refreshResourceStatuses、60s 轮询 |
| `apps/web/src/features/canvas/NodeInfoPopover.tsx` | 「资源理解」按钮 |
| `apps/web/src/features/shell/CapabilityPopover.tsx` | 「通用导入」入口 |
| `tests/e2e/golden-path.spec.ts` | U5 浏览器用例 |
| `apps/web/tests/localCoreClient.test.ts` | 目录/ZIP 客户端测试 |

## Tests actually run

| 阶段 | 结果 |
|---|---|
| lint / typecheck（4 workspace） | ✅ |
| web unit | ✅ 29 files / **121 tests** |
| local-core unit | ✅ 34 files / **164 tests** |
| domain / contracts | ✅ 5 / 4 |
| architecture / integration | ✅ 27 / 5 |
| build / smoke | ✅ |
| E2E | ✅ **7/7**（新增 U5 零表单 + 持久化用例） |

## Known limitations

- Workbench 完整动态面板（五态切换）未做——本片以「资源理解详情 + 节点状态」落地 GPT 方案 U5 的最小展示面；完整 Workbench 属于合并后 UI 深化
- 目录拖放 UI 依赖 webkitdirectory 文件选择（浏览器级目录拖入仍需后续增强）
- 60s 轮询为轻量方案（SSE 后置）

## Rollback

纯前端新增 + E2E；无 Schema 变更、无数据破坏；可独立 revert。

## Go / Stop

**STOP — U5 交付点。GPT 方案 U0–U5 全部完成，最终收口报告见 `UNIVERSAL_RESOURCE_IMPORT_FINAL_20260802.md`。**

---

_Codex 2026-08-02，全部结果基于本次实测。_
