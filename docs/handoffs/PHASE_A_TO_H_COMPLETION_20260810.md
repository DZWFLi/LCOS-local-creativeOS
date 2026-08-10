# LCOS Phase Construction A→H 完成收口

基线：Fullstack `569dad8`（Phase 包基线）→ 当前 HEAD `4dde049`
分支：`codex/backend-hardening-20260802`

## 各 Phase 交付

| Phase | 内容 | 关键证据 | Commit |
|---|---|---|---|
| A Contract Freeze & Detox | Relation 端点 view/workspace 校验；PresentationViewV0/Curation 契约；服务骨架；legacy heuristic 冻结 | 架构 86/86 | 2b567d4 · e786cab · adb4570 |
| B Presentation Persistence | v21 presentation_views + CAS + SSE；Web facade/bridge；membership 持久化 | Core 重启后 context/workflow 保留；E2E 6/6 | 638d589 · 66c4cdb |
| C Presentation Engine | ELK/fCoSE 真实驱动；路由/增量/锚点；visualFamily；Edge 溯源；Skill CTA 移除 | 42/100/200 节点 1.4s；E2E 6/6 | c969512 · 27e0565 |
| D CLI Read + Search V0 | CurationQueryService；federated search；node/selection read；presentation show | CLI 真实进程 4 命令全过 | 9bfc18d |
| E CLI Write + Curation Patch | v22 relation provenance；managed text revision+legacy 迁移；CurationPatch + receipts；GUI 自动刷新 | CLI create/update/apply → GUI 出现 → reload 保留 | b35e444 |
| F Curator V1 | skill 包 + 9 references + 5 golden fixtures；不建 Run 硬规则 | 架构 93/93；安装 6 skills | b4331e7 |
| G Semantic Retrieval | v23 search_documents 派生层；SemanticIndexService；FTS+vector+related pipeline；vec0 native | vec0.dll 289KB；FTS 命中测试；fallback 保证 | 1ddf1a1 |
| H Skill Mining + External | lcos-skill-author；七段式结构；cleanup 评估（不删）；MCP 高层策略确认 | 架构 98/98；安装 7 skills | 4dde049 |

## 最终验证链

```text
npm run lint              : 0 error
npm run typecheck         : PASS
npm run test              : web 274/274 · core 281/281 · domain 5/5 · contracts 4/4
npm run test:architecture : 98/98
npm run build             : PASS
CLI real-process smoke    : read/write/apply/patch 全过
Playwright E2E            : Phase B/C/E 共 15 项全过
```

## 用户可感知的能力

```text
1. GUI 整理/上下文/工作流 + Presentation 持久化（重启不丢）
2. 关系图 fCoSE / 大纲与思维导图 ELK 布局（内置 fallback）
3. Agent 一句话“整理进 LCOS”：lcos-project-curator 自动 search → read → create → relation → presentation
4. CLI 全链路：node read/create/update、selection read、presentation show/patch、curation apply、search
5. 语义检索：FTS + vector（Ollama 装好后自动启用）+ related 邻居
6. 经验炼 Skill：lcos-skill-author 把 Selection 炼成七段式 Skill 并安装
```

## 待用户/后续

```text
1. 安装 Ollama + nomic-embed-text → 跑 smoke:conversation-semantic，启用 native KNN/hybrid
2. F15 真实 Agent Gate：普通会话说“把今天这几轮整理进 LCOS”验证（skill 已装）
3. H14 最终 Acceptance 7 步演示（GUI 二次整理 → Selection → Skill Author → 新项目调用）
4. dev 栈以 phaseb-e2e-token 运行（Core 43121 / Web 5173）
```

## 存档

```text
docs/handoffs/PHASE_{A..H}_*.md（每 Phase Handoff）
docs/audit/SEMANTIC_WINDOWS_ACCEPTANCE_20260810.md
docs/audit/CLEANUP_EVALUATION_PHASE_H_20260810.md
```
