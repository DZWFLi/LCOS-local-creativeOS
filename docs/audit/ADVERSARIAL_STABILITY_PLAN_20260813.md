# LCOS 全栈对抗式稳定性测试计划（2026-08-13）

> 背景：I/J 正式封装前，先以对抗式方法（并发、故障注入、异常输入、资源压力）
> 逼出稳定性问题，而不是只跑功能通过性测试。

## 覆盖面

| 面 | 入口 | 对抗点 |
|---|---|---|
| GUI | Web 5173 | 多标签页同项目并发保存、保存风暴、SSE 断线重连、大画布、长时间挂机连接泄漏 |
| CLI | tools/lcos-agent/cli.mjs | 命令全集、错误参数、重复/并发调用、断线重试、退出码 |
| MCP | lcos-agent / lcos-runtime server | 工具连续调用、非法输入、会话恢复、工具瘦身边界 |
| Bridge | 43122 light-bridge | 任务幂等创建、并发 claim、心跳超时、取消、waiting_input、断线重连 |
| Ollama | 11434 | 服务可用性、模型清单、embedding 接口、向量检索冒烟 |
| Core | 43121 | 并发写 CAS、外键顺序、kill/重启恢复、锁等待 |

## 执行批次

### L1（不打断用户环境，API/CLI 级）
- [ ] CLI 命令全集 + 异常输入 + 并发重复调用
- [ ] MCP bridge E2E（现有脚本）
- [ ] Bridge 幂等/并发 create（假任务，不派发真实 worker）
- [ ] 并发保存竞争：N 个客户端同时保存同一临时项目（模拟多标签页）
- [ ] Ollama 状态与 embedding 冒烟

### L2（需要短暂重启 Core，提前告知用户）
- [ ] Core kill → 重启 → 数据恢复、页面降级/重连
- [ ] SSE 断线后页面自愈
- [ ] 保存风暴 + 队列自愈
- [ ] 大项目压力（几百节点渲染/导入）

### L3（深度故障注入）
- [ ] 磁盘/权限异常、token 过期、SQLite 锁竞争
- [ ] Bridge 断线后 Run 状态对账
- [ ] 长时间挂机内存/连接泄漏

## 判定标准

- PASS：行为正确 + 日志无未处理异常 + 数据一致 + 可自愈
- FAIL：静默丢数据 / 永久卡死 / 错误不降级 / 状态错乱
- PARTIAL：有降级但体验差（记录，排期修）

## 结果台账

| 日期 | 面 | 用例 | 结果 | 证据 | 修复 |
|---|---|---|---|---|---|
| 2026-08-13 | CLI | 命令面完整、异常输入退出码、8 并发 project list | PASS | cli --help / show missing→exit 1 / 8/8 | 无 |
| 2026-08-13 | MCP | Bridge 全链路 E2E（claim/start/review + 工具边界） | PASS | lcos-mcp-bridge-e2e.mjs：agent 37 + executor 8 | 无 |
| 2026-08-13 | Bridge | 缺字段 payload 拒绝 | PASS | 422 + 字段级 detail | 无 |
| 2026-08-13 | Core | 20 并发同版本保存竞争 | PASS | 1 OK + 19 STALE_CAS + 0 异常，版本单调 | 无 |
| 2026-08-13 | Ollama | 服务/模型/embedding 冒烟 | PASS（拉模型后） | nomic-embed-text 274MB；embed 768 维；smoke:conversation-semantic vector 命中 | `ollama pull nomic-embed-text` 已完成 |
| 2026-08-13 | Core 路由 | 语义索引 GET/POST 被 /conversations/:id 抢占 | **FAIL→已修** | semantic-index 404「对话不存在」；宽泛正则先匹配 | 路由顺序修复（semantic 块前置），typecheck/build/重启后 200 |
| 2026-08-13 | 语义检索 | VNext3 真实项目端到端 | PASS | 30/30 消息索引 ready（768 维）；「氛围感」词法 0 命中、语义召回「画面基调怎么定？」 | 无 |
| 2026-08-13 | Core 故障注入 | kill→重启→数据恢复 | PASS | GV=10/artifacts=69/索引 ready/7 项目全一致；故障期 Web/Bridge 存活 | 无 |
| 2026-08-13 | SSE | 断线检测 + 自动重连 | PASS | terminated → 1.5s 重试 → Core 恢复后自动重连收帧 | 无 |
| 2026-08-13 | Core | 保存风暴（10 次顺序连存） | PASS | 10/10 成功、45ms、版本 1→11 单调 | 无 |
| 2026-08-13 | Core | 大项目压力（200 节点） | PASS | 保存 58ms / 加载 11ms，引用校验报错清晰 | 无 |
| 2026-08-13 | 打开项目链路 | 11 类工况矩阵 | PASS 22/23（唯一 fail=不存在项目 404，属正确降级） | 8 并发打开同项目 8/8（28-38ms）、8 并发 catalog 8/8、200 节点打开+保存、索引构建中打开、未编码中文 ID、打开 vs 删除竞态、Core down 拒绝（2.2s）、重启后立即打开（138ms） | 无 |
| 2026-08-13 | token 对抗 | 无/错误/伪造过期 token | PASS | 全部 401（VALIDATION），正常 token 200 | 无 |
| 2026-08-13 | SQLite 锁竞争 | 3 项目 × 保存/PUT/索引 并发 | PASS | 9 操作 42ms 无 BUSY；3 个 PUT 400 系测试脚本 snapshot 构造问题（VALIDATION，非锁） | 无 |
| 2026-08-13 | 文件缺失 | 项目根目录删除后打开 | PASS | graph 仍 200（Core 元数据独立于源文件，降级正确） | 无 |
| 2026-08-13 | Bridge 故障 | kill→重启→能力/任务对账 | PASS（1 发现项） | 拒绝→恢复 0.3.0 幂等保持；内存态任务 404 明确不崩溃 | 任务租约跨重启恢复机制待确认 |
| 2026-08-13 | 连接泄漏 | SSE 30 次连接/断开 | PASS | 30/30 成功，Established 2→2 无残留 | 无 |
| 2026-08-13 | GUI 全流程 | 点击+drop 全覆盖（R2 操作方式） | PASS 35/35 | 打开/选中/双击/小地图/dock 8 按钮往返/上下文面板/删除确认 + text/uri/Files/project-view/workflow drop（数据层验证） | dock 返回 bug 已修（b85a497） |

## GUI 对抗发现并修复

- **上下文/工作流视图无法返回主画布**（activateOverview/enterScope 未重置 activeSurface）→ 已修
- text/uri/Files/project-view/workflow-operator drop 全部真实落库；同名文件 drop 走去重引用（正确）
- 节点 DOM 数量波动 = 画布虚拟化渲染，非数据丢失（Core artifacts 数核对一致）

> 注：脚本首轮把预览端点写成 /previews（404）系脚本错误；前端实际用 /preview-records 且与 Core 一致，已修正后复测。

## L2 发现项（待处理）

- **presentation SSE 断线后前端不自动重连**：`streamPresentation` 的 catch 为空，
  Core 重启后画布视图同步需要手动刷新；active-context 已有 750ms fallback 轮询可自愈。
  排期：随 SSE 合并事件流一起做。
- **Edge 扩展控制下的 LCOS 页面白屏**：title 正常但 body 仅 112 字符（React 未渲染），
  内置浏览器正常；疑似 ChatGPT 扩展注入与 LCOS 页面冲突，真机 Edge 需人工确认。
- 大图 PUT 的 VALIDATION 报错含具体引用链（folder-artifact…violates…），对定位很有帮助，保留。

## 发现项（非阻塞）

- CLI 中文输出在非 UTF-8 控制台（PowerShell Start-Job 捕获）下乱码；直接终端待确认
- Bridge 任务创建字段较多且严格校验（422 防御良好，文档化即可）
- Ollama 服务已装但从未拉模型 → 语义搜索/向量检索实际不可用
