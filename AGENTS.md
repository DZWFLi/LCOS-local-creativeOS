# AGENTS.md — Local Creative OS 开发规则

本文件是 Codex、WorkBuddy 和其他开发执行者的硬性工程规则。

## 1. 最高原则

1. Local Creative OS 不制作内容，只负责看、判断、派活、追踪、归档。
2. 一个 Project 只有一张持续存在的 Project Canvas。
3. Workspace 是 Semantic Viewport，不是页面、独立 Graph、真实目录或 GUI Project。
4. OS 管项目，Bridge 管执行，GUI 管会话，文件系统管内容。
5. AI 结果在用户确认前保持 Draft / Pending，不得自动覆盖人工 Current。
6. 旧 AdFrame 三栏 Demo 是 Review Prototype，不是新 App Shell。
7. 不允许从完整 PRD 自行推导并实现未获批准的功能。
8. 每次只执行获批 Sprint Scope。
9. 重大改动必须先给流程图和影响说明。
10. 所有交接、审计与报告必须保存为 Markdown。

## 1.5 上下文压缩协议（OPEN DEBTS 优先）

任何上下文压缩、轮次交接、Handoff 摘要或新会话接手：

1. **必须先读 `docs/OPEN_DEBTS.md`**，把未完成欠账逐项核对后再继续。
2. OPEN DEBTS 中每一项的状态必须如实更新（进行中/未动/已关闭），不允许"漏标"或"假装完成"。
3. 任何 Session 宣布完成前，对照施工包 Done 清单逐项勾选；缺一项必须在 Handoff 的 NOT IMPLEMENTED 里写明。
4. 宁可慢一倍，不欠账返工；发现返工立即停下交代，不边改边出问题。

## 2. 开始任务前必须阅读

1. `README.md`
2. `AGENTS.md`
3. 当前 Sprint / Handoff
4. 最新 PRD 冻结决策稿
5. 最新 UI & Interaction Spec 冻结决策稿
6. 相关 ADR
7. 当前仓库代码与测试

文档冲突时不要自行折中，按 README 的优先级执行并报告。

## 3. 开工前检查

必须执行：

```bash
git status
git branch
git log --oneline -10
git diff --check
```

检查 package.json、lockfile、README、AGENTS、TS/Vite 配置、测试、脚本、`.env*`、敏感信息、未跟踪文件和当前 Prototype 状态。

工作区不干净、存在敏感信息或分支不明确时，停止并报告。

## 4. Git 规则

- 不自动 Push；
- 不重写历史；
- 不使用 `git reset --hard` 清理未知更改；
- 不覆盖用户未提交文件；
- 大范围移动先审计并批准；
- 移动已跟踪文件优先 `git mv`；
- 一个任务保持小而可审查的提交；
- Tag、Branch、Commit 仅在明确授权后创建；
- 回滚优先使用可审查的 revert。

## 5. 变更协议

以下变更必须先输出：

1. 变更原因；
2. 变更前流程图；
3. 变更后流程图；
4. 用户操作变化；
5. 数据流变化；
6. 影响模块；
7. 文件与 Schema 迁移；
8. 开发成本；
9. 风险；
10. 验收条件；
11. 回滚方案。

适用于用户主流程、Workspace / Canvas、Artifact / View、Run 状态、数据实体、Local Core、Bridge、MCP、Connector、缓存、性能预算、文件覆盖、版本策略与 Sprint 优先级。

未获批准，不执行。

## 6. 架构边界

### `apps/web`

负责 App Shell、Project Tabs、Workspace Dock、Canvas、Nodes、Inspector、Command、UI Store、Local Core Query 和设计系统。

不负责直接读写任意本地文件、保存项目真相、明文凭证、直接管理 Codex 子进程或用 localStorage 保存 Project Graph / Run。

### `apps/local-core`

负责 Project / Workspace、文件导入、哈希、Watcher、Preview、SQLite、Context、Runtime、Connector、Version、实时事件与安全文件操作。

必须只绑定 `127.0.0.1`。

### `packages/domain`

只放纯领域类型与规则，不依赖 React、文件系统或网络框架。

### `packages/contracts`

放 Repository、Runtime、Connector、Preview、Context、Version 等边界接口。

### `packages/ui`

放通用视觉组件与 Token，不放项目业务状态。

### `packages/skills`

只放 Skill 规范、索引和加载边界，Alpha 不建插件市场。

### Bridge

负责 Run、状态、Executor、Event、Changed Files、Artifact Return、Retry、Cancel、waiting_input。

不负责 Canvas 坐标、UI、Preview 或 Workspace 视觉状态。

## 7. 冻结交互规则

不得擅自修改：

- `C` 创建 Command；
- Command 内 `Cmd/Ctrl + Enter` 执行 Run；
- 双击打开一度关系；
- Enter 打开 / 收起状态；
- 单击详情为屏幕坐标 Overlay；
- Overlay 使用 Portal，不进入 React Flow / ELK 布局；
- Inspector 单实例、局部导航栈；
- Esc 逐级退出；
- Inspector 默认关闭；
- Artifact Return：Target → Working → Run → Pending Return Zone；
- Alpha 备注：文件级、PPT/PDF 当前页级；
- Workspace Intent nullable；
- 一个 Artifact 可有多个 View；
- 一个 Artifact 默认每 Workspace 一个 View；
- 重复拖入定位已有 View；
- 额外引用必须显式创建。

## 8. UI 实现要求

节点必须区分：

- Source / Original；
- Working；
- Generated / Derived Draft；
- Context / Reference；
- Process / Run；
- Decision / Checkpoint。

不能只靠颜色区分，必须结合形态、图标、边框、位置、文案和状态。

默认密度：

- 当前 Workspace 5–8 个主内容节点；
- Process 默认 0–3 个；
- Inspector 默认关闭；
- 非焦点关系减弱；
- 技术配置渐进披露。

视觉优先级：

```text
文件内容 / 缩略图
→ 节点形态与图标
→ 当前选择 / 操作目标
→ 待处理 / 异常 / Running
→ 分类色
→ Workspace 环境色
→ 虹彩与 Liquid Chrome
```

## 9. Canvas 与性能要求

```text
0–80：完整
81–150：简化
151–300：聚合
300+：总览
```

- 不承诺 300 个完整节点同屏；
- 持续流动线最多 2 条；
- 只有 Active Run / 当前选中关系允许持续动效；
- Zoom out 停止复杂边动画；
- Workspace 相机移动时暂停复杂动画；
- 节点组件必须 memo；
- 高频 viewport、hover、selection 不得触发全图业务重渲染；
- Inspector 不得订阅全部 nodes 数组；
- 布局写入必须 debounce / batch；
- 自动排布不得覆盖用户稳定锚点；
- 自动排布必须先预览后确认。

性能降级顺序：

1. 关闭流动边；
2. 关闭复杂阴影；
3. 降低缩略图分辨率；
4. 折叠 Process；
5. 聚合辅助节点；
6. 视口外简化 / 虚拟化。

## 10. 存储与缓存规则

- 正式数据、可再生缓存和临时文件分离；
- SQLite 不存大 BLOB；
- 原始文件默认链接；
- 缓存使用内容哈希；
- 默认全局缓存 5GB；
- Cache 可清理，Project 必须仍可恢复；
- localStorage 只能保存可丢失 UI 偏好；
- Project Graph、Run、Revision、Checkpoint 必须写 Local Core；
- 拖动期间只写内存，停止后 debounce 300–800ms 批量保存；
- Heavy Task 并发 1；
- Light Task 并发 2–3；
- 临时目录任务结束清理；
- schemaVersion 与 migration 必须存在。

## 11. 文件与冲突规则

- 导入文件不默认移动原文件；
- 重复文件优先引用；
- 写入前校验哈希；
- 外部修改标记 stale；
- 冲突进入 `waiting_input`；
- Alpha 单写 Run；
- 不允许 Codex、Buddy 和用户同时静默覆盖同一文件；
- AI 修改默认保存为新版本；
- 覆盖必须预览、确认并保留 Revision；
- 删除 ArtifactView 不删除 Artifact；
- GUI 直接修改登记为 External Change；
- 不自动归因给最近 Run；
- `.creative-os` 仅 Local Core 写入。

## 12. 安全要求

- 不提交 Key、Token、Cookie 或 OAuth 凭证；
- 使用 `.env.example`；
- Connector 展示授权范围和身份；
- 敏感 Context 不写普通日志；
- Debug 模式才保存完整请求与响应；
- 高风险操作必须有日志、确认与回滚；
- 外部命令参数必须校验和转义；
- 不在未知目录执行递归删除或批量重命名；
- 不开放局域网或公网监听；
- 不引入遥测，除非明确批准。

## 13. 代码质量要求

- TypeScript 严格模式；
- 不新增 `any`，确需使用必须解释；
- 领域类型禁止复制多份；
- UI、Domain、Infra 分层；
- Adapter 实现不泄漏到 UI；
- 错误使用结构化 Error / Result；
- 异步任务支持取消；
- 文件句柄、Blob URL、子进程必须释放；
- 不吞掉错误；
- 不用 Mock 冒充真实能力；
- Fake / Mock / Placeholder 必须明确标识；
- 不为了“未来通用”创建复杂泛型平台；
- 不引入未使用依赖；
- 不大规模改格式掩盖真实 Diff。

## 14. 测试与验收

最低检查链：

```text
lint
→ typecheck
→ unit test
→ build
→ smoke test
```

每项任务至少提供修改文件列表、命令与真实结果、新增测试、未通过项、浏览器 / Runtime 验证、风险和回滚点。

Golden Path：

```text
打开 Project
→ 恢复 Workspace
→ 拖入文件
→ 查看状态
→ 查看关系
→ Preview / Note
→ 创建 Command
→ 检查 Context
→ Run
→ waiting_input
→ review
→ Artifact Return
→ Accept / Retry
→ Checkpoint
→ 重启恢复
```

失败路径至少包括：文件缺失、Preview 失败、Bridge 断线、Codex 不可用、文件冲突、无权限、自动归位失败、SQLite migration 失败、本地路径变化。

## 15. 每次交付必须生成

放入 `docs/handoffs/` 或 `docs/audit/`：

- 任务摘要；
- 实际范围；
- 变更流程图；
- 修改文件；
- 测试结果；
- 截图或证据路径；
- 风险；
- 未完成；
- 下一步；
- 回滚说明。

报告必须诚实区分已完成、Mock、占位、未接通、未验证和阻塞。

## 16. 停止条件

遇到以下情况停止并报告：

- 文档核心冲突；
- 用户主流程需要改变；
- 需要升级主要框架；
- 需要新增数据库或桌面壳；
- 需要大规模移动文件；
- 需要改变冻结对象模型；
- 需要突破 Alpha 范围；
- 需要处理未知敏感信息；
- 无法保证回滚；
- 测试基线持续失败；
- 当前工作区不干净；
- 需要猜测用户意图；
- 修改文件数量明显超过任务预期。
