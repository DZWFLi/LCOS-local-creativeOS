# TO_ADFRAME_REUSABLE_REVIEW_AUDIT

> status: `draft_not_dispatched`  
> handoff_id: `OS-ADFRAME-REVIEW-AUDIT-001`  
> project_id: `local-creative-os`  
> task_id: `not_dispatched`

## 目标项目

- Source / Coordinator：`codex://threads/019f7958-59f0-7833-bf02-288b90b4222a`
- Target：`codex://threads/019f69d0-f0f0-7612-98f1-8c6bb245a323`
- 冻结旧仓库：`E:\Codex 项目\演示demo`
- OS 仓库：`E:\Codex 项目\OS开发`

## 任务目标

对旧 AdFrame Review Prototype 做只读、文件级可复用性审计，回答哪些能力可作为 Local Creative OS 的 Review 模块来源，哪些与旧三栏 App Shell 强耦合，哪些只是 Mock / CopyOnly / Placeholder。

本任务只产出审计，不迁移代码。

## 审计范围

- Review、Decision、Locked Elements、Script Version、Compare；
- Repository、Evaluator、Runtime Adapter；
- 领域类型、状态存储、导入导出和持久化边界；
- 组件与 `App`、旧布局、样式及 Mock 数据的耦合；
- 现有测试和可运行证据。

## 允许

- 只读检查旧仓库代码、配置、测试和 Git；
- 运行不修改源码和依赖的现有检查命令；
- 在正式派发后，仅写回下面指定的 OS Return 报告。

## 禁止

- 修改 `E:\Codex 项目\演示demo` 的任何文件；
- 安装或升级依赖、格式化全仓库、迁移代码；
- 把旧 App Shell、三栏布局或 Prototype 路由作为 OS 目标架构；
- 把 Mock / CopyOnly / Placeholder 写成真实能力；
- 创建 Commit、Tag、Branch 或 Push。

## 交付

正式派发后的唯一写入路径：

`E:\Codex 项目\OS开发\docs\audit\ADFRAME_REUSABLE_REVIEW_AUDIT_RETURN.md`

报告必须包含：

1. 文件级 `KEEP / EXTRACT / REWRITE / ARCHIVE` 清单；
2. 每项能力的入口、依赖、状态所有权和 App Shell 耦合；
3. 领域类型重复与边界泄漏；
4. 真实能力、Mock、CopyOnly、Placeholder 的明确标记；
5. 可复用测试与缺失测试；
6. 建议迁移顺序、预计文件数量和主要风险；
7. “不应迁移”的明确清单；
8. 所有结论对应的文件路径和运行证据。

## 验收

- 旧仓库 Git 状态与派发前一致；
- Return 文件存在，结论能追溯到具体文件；
- 没有代码迁移或依赖变更；
- 能支持 OS 决定 Sprint 1 的最小 Review 模块范围；
- 不对 Canvas、Workspace、Local Core 或 Bridge 范围做越权设计。

## 截止时间

未设定；正式派发时补充。

