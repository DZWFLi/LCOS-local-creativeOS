# Runtime Runbook

## 1. 当前可运行面

当前只有 Web Fixture、Domain 与 Contracts；不存在 Local Core Runtime。

```text
apps/web             前端 Fixture / Prototype
packages/domain      纯 TypeScript 领域词汇与少量规则
packages/contracts   纯边界接口
apps/local-core      不存在
Bridge Adapter       不存在
SQLite / migration  不存在
```

根脚本：

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run smoke
```

包级隔离验证：

```powershell
npm run lint --workspace @local-creative-os/domain
npm run typecheck --workspace @local-creative-os/domain
npm run test --workspace @local-creative-os/domain
npm run lint --workspace @local-creative-os/contracts
npm run typecheck --workspace @local-creative-os/contracts
npm run test --workspace @local-creative-os/contracts
```

## 2. 当前运行真实性

- Web `dev` / `preview` 使用 `127.0.0.1`；
- Preview Adapter 返回 `origin: "fixture"`，不读文件；
- Runtime Adapter 的 `getRun` / `retryRun` 返回 `FIXTURE_ONLY`；
- Run 生命周期在 `App.tsx` 内以内存和定时推进实现；
- “已全部保存”实际写浏览器 localStorage；
- 没有 HTTP API、SSE、文件句柄、进程、Watcher 或 Bridge 连接。

## 3. Phase 0 后第一条 Runtime 的运行合同

仅在基线与 Phase 0 获批后：

```text
Local Core process
  bind 127.0.0.1 only
  expose health
  validate project root read-only
  list explicit catalog entries read-only
  support AbortSignal / graceful close
```

不得出现：

- `0.0.0.0`、局域网或公网监听；
- SQLite；
- Watcher；
- Bridge；
- 任意文件创建、移动、覆盖或删除；
- 自动扫描未知用户目录；
- `.creative-os` 写入；
- Mock 返回伪装成 Runtime。

## 4. 结构化健康建议（提案，未实现）

```ts
type HealthStatus = {
  status: 'ok'
  service: 'local-core'
  mode: 'read_only_phase_0'
  version: string
}
```

健康检查只证明进程、loopback 绑定和关闭能力，不证明数据库、文件预览或 Bridge 可用。

## 5. 验证节奏

日常小切片：

- 相关 lint / typecheck / unit；
- 启停测试；
- loopback 拒绝测试；
- 路径校验与取消测试。

以下节点才跑完整链：

- 首次 Web Adapter 接入；
- Schema migration；
- Runtime / Bridge 接通；
- 稳定提交；
- 跨轨整合或阶段收口。
