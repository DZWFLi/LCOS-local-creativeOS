# Phase C Handoff

## Completed

- **ELK 真实驱动**：`elkDriver.ts`（懒加载 elkjs bundled），经既有 `elkLayoutAdapter` DI 边界接入
- **fCoSE 真实驱动**：`cytoscapeFcoseDriver.ts`（headless Cytoscape + fcose，懒加载），经 `fcoseLayoutAdapter` 接入，`randomize:false` + 初始位置 + `fixedNodeConstraint`（pinned 不动）
- **Layout Routing（C3）**：Workflow「整理」→ ELK layered；Context Graph → fCoSE relational refine（builtin 立即渲染 + 异步细化）；free/manual 保持现有引擎；任何引擎失败 → builtin fallback（`layoutPreview` 已有语义，补测试）
- **Manual Anchor（C4）**：pinned 由 Phase B `pinnedViewIds` 持久化，两个 adapter 都强制 pinned 不动；解除后引擎可重排
- **Incremental Stability（C5）**：fCoSE randomize:false + 初始位置（旧节点小幅调整）；`movedLayoutIds` 规则测试确认已有节点不报移动
- **预热（C6 前段）**：App 挂载后台预载引擎，首次「整理」不再付 bundle 导入成本；性能 Gate 42/100/200 节点六次布局总耗时 ~1.4s，未启用 worker
- **visualFamily（C7）**：`visualFamily.ts` 机械映射（Artifact kind/MIME/conversation artifactId/SKILL.md/url/run/output），CanvasNodeVisual 优先使用；feedback title-regex 标 TODO（未被替代）
- **Edge 溯源元数据（C9）**：CanvasEdge 增加 scope/origin/label，画布与 Strands 边渲染 `edge-scope-*` class
- **Workflow Skill CTA 移除（C10）**：Skill 按钮与空态入口删除，Skill 文件为普通可引用对象；Selection/Agent 保留

## Files changed

```text
apps/web/src/features/layout/elkDriver.ts                   C1
apps/web/src/features/layout/cytoscapeFcoseDriver.ts        C2
apps/web/src/features/layout/cytoscape-fcose.d.ts           C2 类型声明
apps/web/src/features/layout/layoutEngines.ts               C3 懒加载注册表
apps/web/src/features/layout/fcoseLayoutAdapter.ts          C2 结果类型
apps/web/src/features/surfaces/WorkflowSurface.tsx          C3 ELK 整理
apps/web/src/features/surfaces/ContextGraphSurface.tsx      C3 fCoSE refine
apps/web/src/features/presentation/visualFamily.ts          C7
apps/web/src/features/canvas/CanvasNodeVisual.tsx           C7/C8
apps/web/src/model.ts                                       C9
apps/web/src/features/canvas/ProjectCanvas.tsx              C9
apps/web/src/features/surfaces/ContextFlowSurface.tsx       C9
apps/web/src/App.tsx                                        预热
apps/web/package.json + package-lock.json                   elkjs/cytoscape/fcose
apps/web/tests/elkDriver / fcoseDriver / layoutFallback / incrementalLayoutStability / visualFamily / workflowNoSkillRuntime
```

## Contracts frozen

```text
LayoutEngine id：'elk' | 'fcose'（DI 边界不变，外部算法只返回 positions + routes）
CanvasEdge.scope: 'domain' | 'presentation' | 'runtime'；origin；label
VisualFamily：text/document/image/url/conversation/skill/run/output/unknown
```

## Migrations

```text
无（Phase C 纯 GUI/依赖层）
```

## Tests run

```text
npm run lint / typecheck                    : PASS
npm run test                                : web 274/274 · core 265/265 · domain 5/5 · contracts 4/4
npm run test:architecture                   : 86/86
npm run build                               : PASS
性能 Gate                                    : 42/100/200 节点，ELK+fCoSE 六次布局总 ~1.4s（阈值 4s/次）
Playwright E2E                              : 6/6（fCoSE 关系图 / ELK 预览 / 应用 / reload 保留）
```

## Acceptance evidence

```text
ELK 42 节点布局 + pinned 锚点保持（0,0）
fCoSE fixedNodeConstraint 断言（fcoseOptions）
关系图 2 local objects 渲染（context members 3 节点场景）
Workflow 布局预览出现「1 个关系簇 · 0 个手工锚点」→ 应用无崩溃
reload 后 presentations 2 个 view 保留
```

## Known compatibility paths still present

```text
builtinLayout（无外部引擎/离线 fallback）
feedback title-regex（TODO，未删除）
NodeKind/WorkspaceIntent（DEPRECATED_BEHAVIORAL_HINT）
```

## Explicitly NOT implemented

```text
Layout Worker（性能 Gate 未触发，C6 条件不成立）
AI 自动摘要 / Search / Curator Skill / new workflow UI / Memory Graph
```

## Risks for next phase

```text
elkjs/fcose 是 dev 首次加载较慢的依赖（已预热）；生产 build 会预打包。
Context Graph 的 fcose refine 与手动拖拽位置并存：enginePositions 在用户拖动后
重置为 builtin（手动画布优先）。
```

## Repository state

```text
branch  : codex/backend-hardening-20260802
commits : c969512（Phase C 主体）· 27e0565（预热）
HEAD    : 27e0565
dev 栈  : Core 43121 + Web 5173（npm ci 统一依赖后重启）
```
