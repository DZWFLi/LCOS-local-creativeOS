# ADR：.lcosproj 工程文件 — 真相定位与迁移路径（DZ-PROJ-08~11）

> 日期：2026-08-03
> 状态：**已批准；P1 施工完成（2026-08-03）** — export/open/inspect/rebind 已实现并实测；P2–P4 待续

## P1 完成记录（2026-08-03）

- `LcosprojService.exportProject`：全真相拷贝（Canvas/Content/Work History/Memberships，19 张表）+ `lcosproj_meta`（schemaVersion 12、相对路径 Locator、rootHint、导出时间）+ 临时文件原子替换
- `LcosprojService.open / inspect`：工程文件导入回运行库（先清旧行再整表插入），inspect 只读预览
- `LcosprojService` 重绑定：目录搬迁后按 relativePath + hash 校验重定位；缺失文件标 missing，内容变化标 stale/current
- API：`POST /projects/:id/export-lcosproj`、`POST /lcosproj/open`、`GET /lcosproj/inspect`
- CLI：`lcos project export/open-file/inspect-file`；web client 三个对应方法
- 验证：391 测试全绿；真实项目 `disposable-mvp-sample` 导出 299KB（4 Artifact/4 Run/4 Dispatch/1 Binding/1 Manifest/3 Relations/2 Notes/1 Checkpoint），inspect 回读一致

## Context

当前 Project 唯一身份是全局 Metadata Repository（`phase2.sqlite`）里的 Catalog 记录，根路径为绝对路径。目录移动、盘符变化、跨机器复制后需要重新定位甚至重建项目（DZ-PROJ-08/09/10）。用户需要像 Premiere/DaVinci 一样可双击打开、备份、迁移的工程文件。

## Decision（待批准）

### 真相定位：`.lcosproj` = 每项目 SQLite，最终成为该项目的 Project Truth

推荐方向：以工程文件（自带扩展名的 SQLite）作为每个项目的完整真相；全局 Catalog 降级为「最近打开项目索引」。理由：

- 复用现有 Metadata Repository 设计（事务、Migration、索引）；
- 项目级数据随文件搬迁，天然解决盘符/路径问题；
- 大媒体不内嵌，用户文件仍是链接，符合现有架构规则。

### 分阶段迁移（不一次性推倒全局库）

| 阶段 | 内容 | 验收 |
|---|---|---|
| P1 | ADR 批准后：`.lcosproj` Contract + schemaVersion + 原子备份；export/open/rebind 适配器（从全局库导出，打开工程时恢复） | 同盘移动、跨盘移动、中文/长路径 |
| P2 | Catalog 降级为最近打开索引；工程 ID 稳定 | 复制到另一台机器无凭证打开 |
| P3 | 项目级表逐步迁入 `.lcosproj`；Runtime/Cache/凭证继续外置 | 旧 Schema 升级、写入中断恢复 |
| P4 | 一次性升级入口：现有项目生成 `.lcosproj` | 7 个真实项目无损迁移（用现有 phase2 库副本验证） |

### 工程文件内容（16.3 对齐）

保存：Project Identity、Canvas Truth（Scopes/Workspaces/Memberships/Views/Relations/States）、Content Identity（Artifacts/Revisions/FileRecords/相对 Locator/Hash）、Work History（Runs/Manifest/Returns/Decisions/Session Summary/Checkpoint）。
不保存：大媒体 BLOB、Preview Cache、Runtime staging、凭证、MCP URL、绝对路径作为唯一身份。

### Locator 恢复顺序（16.4）

工程文件旁相对根 → root alias → Catalog 最近位置 → 授权搜索根按 relativePath+hash 匹配 → 找不到只问一次“重新定位”。

## 备选方案（不推荐）

1. `.lcosproj` 只做导出/恢复载体，全局库继续双写：短期省事，但长期双真相（文档明确禁止）。
2. 纯 JSON 工程文件：脆弱、无事务/迁移，不满足生产要求。
3. 直接把 phase2.sqlite 全库复制当工程文件：跨项目污染、无法独立迁移。

## 影响

- 新增：`ProjectFileContract`、export/open/rebind 服务、`.lcosproj` 读写器（复用 metadata-repository 模式）
- 修改：Project Catalog 语义（最近打开索引）、`createProject/open` 流程（打开文件夹→发现 `.lcosproj`→恢复；否则新建）
- 风险：P3 迁移期需要反向读取兼容；写入中断要有原子备份恢复
- 成本：P1–P2 约 1 个开发批次；P3–P4 视项目表规模另估

## 回滚

每个阶段独立提交；P1/P2 不破坏全局库（新增导出/打开路径）；未批准前不写入任何新表。

---

_Codex 2026-08-03。批准后按 P1→P4 施工，每个阶段单独 Handoff。_
