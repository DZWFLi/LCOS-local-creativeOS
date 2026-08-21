# LCOS A-H 未完成工作与下一步（给开发）

> 日期：2026-08-11
> 来源：各阶段 Handoff 的 Explicitly NOT implemented + H-GUI Completion Gate 审计
> 冻结基线：commit `21a754d` / tag `pre-huabu-audit-2026-08-11` / 分支 `research/huabu-gap-audit-20260811`

---

## 一、GUI Gate 明确缺口（NOT DONE，共 5 项）

详见 [LCOS_H_GUI_COMPLETION_GATE_EVIDENCE_20260811.md](LCOS_H_GUI_COMPLETION_GATE_EVIDENCE_20260811.md)，这 5 项是 A-H 宣称完成前必须补的：

| # | 缺口 | 现状 | 补法 |
| --- | --- | --- | --- |
| 1 | Capture Spawn Zone 连续捕获全叠同一点 | 常量 `{480,240}`（capture-application-service.ts:21），实测 28 视图重叠 | Presentation Engine 分配新捕获区域/碰撞检测（后端已就绪，前端接线） |
| 2 | Node 空字段/工程噪音 | NodeInfoPopover 常显"版本/来源/流程/Preview/Revision ID"空值 | 有值才显示；Revision ID 后置到 History/Developer |
| 3 | Anchored Note 锚定定位 | 无 anchorRefs 字段与交互 | Note/Text 加 anchorRefs，点击 camera locate + 高亮 |
| 4 | Pinned Capture Target UI | 只有 CLI/API | GUI 显示当前 pinned 项目 + 切换入口 |
| 5 | Reorganize Ghost GUI | 后端 proposal/preview/apply/rollback 全通，前端未接 | Before → Ghost After → Apply/Reject 可视化 |

## 二、A-H 各阶段未完成项汇总

### Phase A

- `projects.name` 仍 NOT NULL（兼容策略：fallback + title_mode；Agent 频繁改名时建议评估真正 nullable）
- GUI 真人点击验收未做（Phase H 统一）

### Phase B

- provisional project 快速创建（B15）未接（等 Capture 入口需要时）
- Staging 表无 TTL 清理（Phase I）
- browserTabBindings 缺真实浏览器扩展数据源（Phase C 扩展已建，未装）

### Phase C

- Native Messaging（C8）留 Phase J
- Desktop Quick Capture 全局快捷键弹窗（C9）未做
- 剪贴板自动监听（C10）未做（需桌面 shell 事件源）
- Preview 收口（ResourceDetailDialog 工程字段、ImmersiveViewer 更多类型）留 Phase H（本轮 Gate 已列）

### Phase D

- Anchored Note（D9）未做 → 上表 #3
- Ghost Preview GUI（D17）未做 → 上表 #5
- merge 摘要生成需 LLM（Curator 提交 proposal 前创建汇总节点）
- Edge LOD 精细调优（基础有，细调留 Phase H/I）

### Phase E

- Eval fixtures 实装（tests/skill-fixtures/ 只写了规划 README）
- SkillPatchProposal 自动化（等 badcase 积累）
- Trace 无 TTL（Phase I）

### Phase F

- Embedding benchmark（qwen3-embedding vs nomic）→ docs/benchmarks/（需用户 pull 模型）
- Semantic affinity hint 自动计算（需要项目 semantic profile）
- LocalIntelligenceQueue / 小模型 worker（Phase I 资源治理）
- GUI 设置页（F30）轻量状态显示

### Phase G

- Local Agent Browser file chooser 拦截（需内嵌浏览器控制面）
- Claude/Gemini provider adapter（模式已定，chatgpt 为样例）
- Cross-session Bridge dispatch（Context Continuity Golden Case 后接）
- GUI Run Rail session 状态显示

### Phase H

- Shell 去重（V07TopBar 死代码未清；ProjectStrip/WorkspaceRail/WorkRail 职责评审）
- WorkRail/ArtifactWorkbench/PreviewSurface 职责划分
- AgentContextSurface 3 秒轮询未并入 SSE/事件驱动
- MiniMap 遮挡复测
- 前端 Presentation hierarchy 落 Core（最后一块内存态）

## 三、Phase I / J 待办（性能硬化与正式软件）

### Phase I（资源与性能硬化，A-H Golden 后开始）

- 基线：12GB Windows / 8GB Apple Silicon；真实并行（LCOS + ChatGPT Desktop + WorkBuddy + 3-4 会话 + 浏览器）
- I1 Measurement first（idle RAM / 100-500 nodes / preview / search / KNN / Ollama）
- I2 ResourceGovernor（Low/Balanced/Performance：Ollama load/unload、semantic/preview/indexing 队列、cache 释放）
- I3 Ollama 资源策略（NUM_PARALLEL=1、keep_alive 短、embedding on-demand）
- I4 Canvas（offscreen preview 释放、thumbnail tier、LOD、virtualization）
- I5 Session Context（多 Agent 共享 project index，每 session 只存 refs）
- I6 真机 Gate

### Phase J（正式软件收口 / RC）

- Runtime Host installer / single-instance / auto-start / Tray / global shortcut
- `.lcosproj` 双击关联 + OS context menu
- browser extension 签名/打包
- upgrade/migration / uninstall 数据保留 / crash recovery / diagnostics
- 第三方 license / NOTICE / Ollama 组件打包 / approved model manifest
- release signing / RC regression / 体积冻结

## 四、建议执行顺序

```text
1. GUI Gate 5 缺口（上表一）——开发优先
2. Phase H 剩余（Shell 去重 / 轮询改事件 / Presentation 落 Core）
3. 真人 Golden Acceptance 走查（浏览器）
4. Phase I 基线测量 → ResourceGovernor
5. Phase J 打包
```

