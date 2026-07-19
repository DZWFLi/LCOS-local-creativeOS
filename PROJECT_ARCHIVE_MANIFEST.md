# AdFrame Script Review — 项目归档说明

归档日期：2026-07-19  
项目阶段：Day 3 作品集 Demo（功能冻结）  
当前分支：`refactor/reusable-review-core`

## 项目定位

AdFrame Script Review 是一套商业视频脚本 AI 协同评审台。它将 Brief、脚本版本、人工创意判断与 Mock AI Skill 分析绑定到具体脚本段落，并形成可执行的 Keep / Modify / Remove 决策及 Codex Handoff。

当前稳定业务链路：

`Brief → Script Version → Segment → Human Review / Mock AI → Decision → Compare → Codex Handoff`

## 已完成范围

- PortaSplit / The Thinker 单项目案例
- Brief Snapshot 与脚本 V1 / V2 / V3
- 脚本段落选择与版本比较
- Human Review Card
- Mock AI Draft 与 Accept / Revise / Reject
- 综合 Decision 与下一版目标
- localStorage 持久化与 Reset Demo
- Markdown、JSON 与 Codex Handoff 导出
- README、Case Study、三分钟演示稿和 Day 1–3 验收材料
- 1366×768 与 1024×768 浏览器验证

## 关键入口

- 产品说明与启动方法：`README.md`
- 前端源码：`src/`
- 静态资源：`public/`
- 项目文档与 QA 证据：`docs/`
- Git 历史：`.git/`
- WorkBuddy 协作证据：`.workbuddy/`

## 本地恢复

```powershell
npm install
npm run dev
```

质量检查：

```powershell
npm run lint
npm run build
```

## 归档策略

ZIP 保留源码、文档、静态资产、QA 证据、WorkBuddy 证据与完整 Git 历史。

为减少体积，以下可重建目录不进入 ZIP：

- `node_modules/`：运行 `npm install` 可恢复
- `dist/`：运行 `npm run build` 可恢复

## 注意事项

- 当前 AI 分析属于演示用 Mock 数据，不代表已接入真实模型 API。
- 当前版本刻意维持单项目结构；Match Night、多项目切换、真实 API、CLI/Bridge 产品接入均留作后续路线。
- 归档时仓库未配置 Git Remote，因此 ZIP 与本机 Git 历史是主要恢复依据。
