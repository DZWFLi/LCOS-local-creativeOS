# Real Bound Web Workbench

## 审计发现

Stage 3 交接声称已有 Web Workbench，但当前实现同时存在三个反证：

- `WebWorkbench.tsx` 没有任何生产引用；
- Routine 名称和“3 个页面”完全硬编码；
- Catalog 将 Workbench 标记为 `planned`，人和 Agent 均无法创建。

## 修正

- Workbench 升级为真实 `presentation` component，可从 Component Shelf 创建。
- `prepare-workbench` / quick-note / agent-tool 等受控 Intent 可生成 Ghost Proposal，再 Keep / Revert。
- Workbench 只读取 `projectViewId(s)` 显式绑定，并显示真实 Project 对象。
- “打开对象”回到现有 Reader / Open 链，不伪造内置浏览器或外部 URL。
- Quick Note 明确是当前挂载期间的临时态，不写 Project Truth。
- Agent Tool Runtime 未接通，四个 Tool slot 显式 disabled。

## 没有做

- 没有保存 Cookie / Token / 浏览器 Profile。
- 没有声称可以一键恢复多个 URL。
- 没有新增 Schema、Local Core RPC 或第四一级页面。
- 没有用 `presentation.variant` 偷存复杂 Routine 数据。

## 修改文件

- `apps/web/src/features/workbench/WebWorkbench.tsx`
- `apps/web/src/features/spatial/components/WorkflowComponentRenderers.tsx`
- `apps/web/src/features/spatial/model/surfaceComponentCatalog.ts`
- `apps/web/src/spatial-components.css`
- `apps/web/tests/surfaceComponentFoundation.test.ts`

## 验证

- Web typecheck：PASS。
- Foundation behavior：14/14 PASS。
- Spatial static gate：22/22 PASS。

## 剩余真实缺口

- Project 持久化 Routine URL locator、活动页和多页恢复需要正式 Presentation / Local Core 合约。
- Agent Tool 执行需要真实 Runtime capability。
- 上述两项不得由前端 fixture 冒充。

## 回滚

单独 revert 本批提交；无数据迁移。
