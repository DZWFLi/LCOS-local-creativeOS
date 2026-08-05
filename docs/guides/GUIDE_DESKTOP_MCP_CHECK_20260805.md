# 桌面对话检测 LCOS MCP 工具（保姆级教程）

> 目的：确认 Codex 桌面 App 的普通对话里，`local-creative-os` / `lcos-executor`
> 的 MCP 工具到底能不能加载出来。这决定 A1 问题到底出在“exec 单独不加载”
> 还是“所有会话都不加载”。

## 第 0 步：先确认前提（已完成）

```text
1. 栈在跑：Core 43121 / Bridge 43122 / Web 5173
2. bootstrap 已跑过：local-creative-os 默认启用、lcos-executor 默认关闭、
   ai_bridge 已移除
```

如果栈没跑，先开一次 LCOS（npm run dev:open），再继续。

## 第 1 步：完全重启 Codex 桌面

```text
1. 关掉 Codex 桌面窗口；
2. 右下角托盘也右键退出（如果托盘有 Codex 图标）；
3. 重新打开 Codex 桌面。
```

这一步很重要：MCP 配置只在启动时加载，不重启等于白测。

## 第 2 步：新开一个普通对话

```text
1. 点“新建对话”（不要用 resume 旧会话，用全新的）；
2. 工作目录随便选，建议选 LCOS 项目根目录方便后续验证。
```

## 第 3 步：发送这段检测指令

```text
列出你当前可用的全部 MCP 服务器和工具名称。
如果有 local-creative-os 或 lcos-executor 的工具（例如 list_lcos_projects、
get_lcos_project、claim_lcos_run、submit_lcos_result），请明确列出来。
只列清单，不要执行任何工具。
```

## 第 4 步：看结果，二选一

### 情况 A：看到了 LCOS 工具 ✅

```text
回复里出现 local-creative-os / lcos-executor 的工具名
→ 桌面会话能加载 MCP
→ 结论：问题限定在 codex exec 模式单独不加载（给开发的信息就非常精确）
```

进阶确认（可选）：让它在同一对话里执行一次只读工具：

```text
请调用 list_lcos_projects，把返回的项目列表贴给我。只读，不要做别的。
```

如果返回里能看到 `disposable-mvp-sample` 和你建过的项目，说明整条 MCP→Core 链路
在桌面会话里是通的。

### 情况 B：说“没有 MCP 工具” ❌

```text
回复里明确说没有任何 MCP 服务器/工具
→ 桌面会话也没加载
→ 结论：不是 exec 的问题，是配置/客户端整体问题
```

把它的原话复制给我，我继续定位（重点查 config.toml 的
`mcp_servers.local-creative-os` 是否被这个版本识别，以及是否需要新版配置格式）。

## 注意事项

```text
1. 一个会话只能有一个主人：别同时用 CLI 和桌面开同一个会话，两边读写会打架；
2. 测完如果还想让看门狗自动接单，别把绑定的执行会话占用着；
3. 这个检测不影响 A1 结论：codex exec 模式已确证不加载（本机实测），
   桌面能不能加载是补充信息。
```
