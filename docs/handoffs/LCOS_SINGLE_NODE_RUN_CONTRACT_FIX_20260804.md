# 单节点 Run 合同修复（2026-08-04）

## 问题

单个受管节点选择“修改 / 新版本 / 编辑对象”后，Web 已发送 `outputIntent`、`targetArtifactId`、`targetRevisionId` 与 `resultPolicy`，但 Local Core HTTP 白名单未接受后两个字段，导致请求在进入 Runtime Application Service 前返回 `INVALID_ARGUMENT`。

同时，Runtime Application Service 没有把用户选择的 Base Revision 传给 Context Manifest；即使只放宽 HTTP 校验，也会静默改用 Artifact Current Revision。

## 修复

- Run HTTP 合同接受并校验 `targetRevisionId`、`resultPolicy`。
- Canonical `CreateRuntimeRunInput` 支持显式 Base Revision。
- ContextManifest 构建支持显式目标 Revision，并验证它真实属于目标 Artifact。
- Run 使用冻结 Manifest 中的 Revision，不再静默替换用户选择。
- analyze/create 仍禁止携带修改目标或 Base Revision；revise 仍必须有显式目标。

## 验证

- Context Manifest / Runtime HTTP：13/13 PASS。
- Local Core typecheck：PASS。
- Web typecheck：PASS。
- `git diff --check`：PASS。

## 用户可见变化

单节点选择后输入指令，使用“修改 → 新版本 → 当前编辑对象”可以成功创建 Run；选定的 Base Revision 与结果策略真实进入 Canonical Run。

## 风险与回滚

未修改 Schema，不改变 Accept/Current 生命周期。可通过回退本报告列出的 Contracts、Manifest Service、Runtime Service、Server 与测试改动恢复。
