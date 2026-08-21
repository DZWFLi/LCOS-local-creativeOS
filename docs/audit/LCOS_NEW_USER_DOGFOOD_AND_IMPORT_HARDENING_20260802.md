# LCOS 新用户 Dogfood 与导入链路加固（2026-08-02）

## 任务摘要

以新用户身份建立隔离的虚构 AIGC 项目“LUMINA 生物发光香氛”，使用真实 Markdown、TXT、JSON、JPG、DOCX 文件，贯穿 Project 打开、目录建图、文件导入、CLI、Run、Light Bridge、Artifact Return、Accept 与重启恢复。测试数据与 Runtime 均位于被忽略的 `.codex-runtime/`，未写入用户项目或主开发 worktree。

## 变更流程

```text
此前：选择目录 → 创建空 Project → 用户逐个拖文件 → 少数扩展名可导入
现在：选择目录 → 只读扫描 → 展示数量/体积/跳过项 → 用户明确确认
      → 文件成为 Artifact/View → 文件夹成为 Collection Scope → 重启恢复
```

```text
此前：Run → 不受 Bridge 支持的 taskType → 或 result 合同 500 → 表面按钮无闭环
现在：Run → canonical taskType → Agent pull/start → canonical result
      → pending ArtifactReturn + Draft Revision → Accept/Reject/Retry → finalize Provider
```

## 实际修复

- 文件格式识别集中到单一 Registry；导入能力与 Preview 能力解耦。
- DOCX、Office、音视频、压缩包、设计源文件及未知二进制可先成为持久化 Artifact；不再用 Preview 支持范围阻断导入。
- 同 Project、同内容哈希的文件导入复用已有 Artifact/Revision，避免重复复制和重复节点。
- 新增 Project Root 只读扫描和显式确认；忽略 `.creative-os`、`.git`、`.svn`、`node_modules`，拒绝符号链接，限制深度与文件数量。
- 非空目录确认后建立文件节点与子目录 Collection Scope。
- 恢复 Space + 空白画布左键创建节点。
- 修复 CLI 单文件导入误按目录遍历；补 Project create/open、Run create/dispatch/recover/sync/finalize、Return accept/reject/retry。
- 修复 LCOS Run taskType 与 Light Bridge Capability Registry 漂移。
- Bridge v1 结果统一使用 `summary`；旧 CLI `shortSummary` 仅在提交边界兼容归一化；非法合同返回结构化 422，不再泄漏 500。
- 无显式选择时，Context Manifest 自动包含目标所在集合及相邻集合的有限上下文（最多 12 个 Artifact，仍受字符预算约束）。
- Light Bridge launcher 优先发现仓库隔离 Python 环境，避免机器全局 Python 缺包导致不可复现启动。

## Dogfood 证据

- Project：`project-lumina-生物发光香氛-8da69f9d`
- 完成 Run：`run-3f4c65f4-a5d9-44fe-9940-6494cdc1db30`
- Bridge Task：`task-99bc7ab1-b38f-5d32-a169-6fad877dfb6d`
- Artifact Return：`return-fbd45f75a9b00afcb4201e27546b59d5cdab60620344b6fb2b476a7a9b2c20d4`
- 原始文件哈希：`12339eca2b1958ef14834e840dc35f864a621ab861b63d1685b00afe057cb53c`
- Accept 后 Run 为 `completed`，Return 为 `adopted`，新 Revision 为 `current`，Provider 为 `completed`，`finalizePending=false`。
- Local Core 停止并以同一 SQLite 重启后，Project、Run、Return 和 Revision 均恢复。

## 边界与未完成

- “可导入”不等于“可生成富预览”：DOCX 等格式现在可靠入库，但内容抽取/缩略图仍需各 Renderer/Analyzer 独立实现并明确显示 unsupported。
- Context 自动邻域是保守默认值，不替代未来的语义检索；大项目仍需显式选择、资源匹配和 Context 预览。
- 本次没有改变 Domain 核心语义或执行 Schema，没有引入新依赖。

## 回滚

本次代码可按提交整体 revert。Project Root 扫描在用户确认前只读；索引失败时删除本次刚创建的 Project 元数据，不删除或移动源文件。缓存与 Dogfood 数据可直接删除，不影响用户 Project Truth。
