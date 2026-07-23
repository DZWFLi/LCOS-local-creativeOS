# Local Core Development Runbook

> 适用阶段：Backend Phase 1A 后的绿色开发任务

## 启动

在后端 worktree 根目录执行：

```powershell
npm run dev:local-core
```

命令先编译 Local Core，再以前台进程启动：

```text
http://127.0.0.1:43121
```

当前没有自动重载、后台守护进程或子进程编排。停止服务使用当前终端的 `Ctrl+C`，Local Core 会关闭 HTTP server 并释放端口。

每个 HTTP 请求默认有 10 秒只读处理时限。超时返回 HTTP `408` 与稳定的 `ABORTED` 错误；不会因为等待 Catalog 或文件系统响应而无限占用请求。

## 健康检查

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:43121/health'
```

预期：

```json
{
  "status": "ok",
  "service": "local-core",
  "mode": "read_only_phase_1a",
  "version": "0.1.0"
}
```

## Project Catalog

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:43121/projects'
```

默认 CLI 启动没有注入 Project，因此预期为空：

```json
{
  "ok": true,
  "value": []
}
```

这不是磁盘扫描结果，也不代表前端 localStorage 已接管。

## Project Root 只读校验

```powershell
$body = @{ rootPath = 'E:\explicit-project' } | ConvertTo-Json
Invoke-RestMethod `
  -Method Post `
  -ContentType 'application/json' `
  -Body $body `
  -Uri 'http://127.0.0.1:43121/project-roots/validate'
```

校验只执行路径规范化、目录状态和读取权限检查；不会创建目录、递归扫描、写文件或创建 `.creative-os`。

## 端口冲突

端口 `43121` 被占用时，进程应直接启动失败并返回非零退出码。不要自动寻找其他网卡或随机端口，因为后续 Dev Proxy 需要稳定目标。

只读检查占用进程：

```powershell
Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 43121 -ErrorAction SilentlyContinue
```

不要自动终止未知进程。确认 owner 后再由用户决定是否关闭。

## 质量检查

局部：

```powershell
npm run check:local-core
```

该命令依次执行 Local Core 的 lint、typecheck、unit test 与 build。

阶段收口：

```powershell
npm run check
```

## 当前明确未接通

- Web Dev Proxy；
- Runtime Client；
- Browser Diagnostics；
- SQLite；
- Watcher；
- Bridge；
- SSE；
- Project Catalog 持久化；
- 真实用户文件写入。

上述能力不得从 Health 或 UI 中冒充为已实现。

## 已覆盖的绿色边界

- 非 loopback host 拒绝；
- 固定开发端口；
- 无效 timeout 配置拒绝；
- 请求超时映射为稳定 `ABORTED`；
- malformed JSON；
- 64 KiB request body 上限；
- unknown route；
- duplicate Project ID；
- allowed root containment；
- 启动前 Abort；
- 运行期 Abort 触发关闭；
- graceful shutdown；
- 端口释放后重新绑定。
