# Local Creative OS v0.6.0 · 完整前端候选包

这是 v0.6 的累计前端版本，不需要再拼接 Phase 1、Phase 2 和 Phase 3。当前代码基线已经合并：

- Phase 1.1：居中执行确认、Canvas 完整锁定、输入与画布稳定性；
- Phase 2.1：选中 → 输入 → 确认 → 执行 → 返回 → 接受 / 继续修改；
- Phase 3.1：Project Drive、多项目隔离、Root / Child Canvas Scope、面包屑、子画布、自动布局、快捷键与项目标签修复。

当前定位是 **v0.6.0 前端完整回归候选版**。它仍然使用前端 Fixture 模拟 Run、Artifact Return 和本地状态，不代表 Local Core、Bridge、Codex Runtime 或真实文件写回已经接通。截图不会突然替后台写代码，虽然它们经常被寄予这种离谱期待。

## 产品主流程

用户只需理解：

1. Canvas：内容与关系；
2. Work Rail：当前焦点、任务和输入；
3. Project / Canvas Scope：项目与空间层级。

黄金路径：

```text
选择内容
→ 在 Work Rail 输入修改要求
→ Ctrl/Cmd + Enter 或发送
→ 居中确认 Target / Context
→ 开始执行
→ Waiting Input / Running
→ Artifact Return 自动进入 Compare
→ 接受为当前版本或继续修改
```

复杂的 Command、Context Snapshot、Run、Revision 和 ArtifactView 由系统记录，不要求用户先手动创建过程节点。

## 空间模型

```text
Project Drive
└── Project Package
    └── Project Graph
        ├── Root Canvas Scope
        ├── Child Canvas Scope
        ├── Workspace Semantic Viewport
        └── ArtifactView
```

一个项目只有一个 Project Graph。子画布是 Scope，不是第二套 Graph；同一 Artifact 可在父子 Scope 中拥有不同 ArtifactView。

## 启动

环境建议：Node.js 20+，npm 10+。

```bash
npm ci
npm run dev
```

默认地址：

```text
http://127.0.0.1:5173/
```

完整质量链：

```bash
npm run check
```

包含：lint、typecheck、unit test、build、smoke。

## 完整测试

从这里开始：

```text
CODEX_START_HERE.md
CODEX_RUN_V0.6.0_FULL_REGRESSION.md
```

测试必须优先走正常交互。`?state=` 只用于在前置链路失败后继续验证目标渲染，不得用 Fixture 通过替代正常链路通过。

## 目录

```text
apps/web/                  React + Vite 前端
packages/contracts/        前后端共享合同
packages/domain/           前端 Alpha 领域合同
packages/ui/               UI 公共入口
scripts/                   构建 Smoke
public/                    公共资源
docs/product/              v0.6 交互冻结文档
docs/release/              v0.6.0 特性、限制与交接
docs/archive/              Phase 历史材料，仅供追溯
```

## 正式测试入口

```text
/?state=drive              Project Drive
/?state=confirm            执行确认与 Canvas Lock
/?state=phase2-single      单文件任务闭环
/?state=phase2-multi       多选 Target / Context 推断
/?state=running            执行中
/?state=waiting            等待输入
/?state=review             Artifact Return / Compare
/?state=accepted           接受结果与 Checkpoint
/?state=scope              已有 Child Scope
/?state=scope-create       创建 Child Scope
/?state=layout             自动布局预览
/?state=project-huaxin     第二项目 Graph
/?perf=80                  80 节点
/?perf=150                 150 节点
/?perf=300                 300 节点
```

## 当前边界

- 使用前端 Fixture，不代表真实执行通道；
- 未接 Local Core、本地文件 Watcher、Bridge、Codex Runtime；
- 未完成真实文件哈希、Revision 写回、Connector 权限与跨项目文件导入；
- Delivery 只保留前端基础对象和 Checkpoint 入口；
- 区域标注、完整 Skill 编排和 300+ 节点生产级性能不属于本轮验收范围。
