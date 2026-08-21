# LCOS 0.1 Desktop Alpha · 封装与明日 GUI 收口计划

日期：2026-08-18

## 1. 本轮目标

本轮不扩 LCOS 产品能力，先把已经跑通的 0.1 Web + Local Core + Light Bridge + Codex Runtime 收进一个真正可安装、可启动、可退出、可诊断的 Windows Desktop Host。

目标不是“网页套壳”，而是把开发态必须手工维护的运行时生命周期收走。

用户最终只应该经历：

```text
安装 LCOS
→ 双击 LCOS
→ Runtime 自动启动
→ 打开最近项目 / 创建项目
→ 需要 Agent 时首次连接 Codex
→ 正常工作
→ 关窗口后可留在托盘继续接收/执行
→ 托盘可完全退出 / 重启 Runtime / 打开日志
```

## 2. Desktop Alpha 架构

```text
LCOS.exe (Electron Main)
│
├─ BrowserWindow
│   └─ 现有 LCOS Web Renderer
│       └─ preload 暴露窄 DesktopPort
│
├─ Desktop Static Host (127.0.0.1:随机端口)
│   ├─ serve Vite production dist
│   └─ /api/local-core/v1 → Core 43121 + 注入 bearer token
│
├─ Runtime Supervisor
│   ├─ Light Bridge 43122（Windows 正式包为 PyInstaller onedir）
│   ├─ Local Core 43121（Electron utilityProcess）
│   └─ Codex Orchestrator（配置完成后启动）
│
├─ Native Desktop Services
│   ├─ Tray
│   ├─ Native directory picker
│   ├─ Show in Explorer
│   ├─ Runtime restart
│   └─ Logs
│
└─ User Data
    ├─ metadata.sqlite
    ├─ persistent local-core-token
    ├─ bridge runtime
    ├─ orchestrator state
    ├─ Codex integration copy
    └─ logs
```

### 核心边界

- Renderer 不获得 Node / filesystem / shell 的直接访问权。
- `contextIsolation=true`、`nodeIntegration=false`、`sandbox=true`。
- Renderer 只通过 `window.lcosDesktop` 的窄 API 调用原生能力。
- Core / Bridge 固定由 Runtime Supervisor 管理，不再靠用户手开三个 terminal。
- Desktop 遇到 43121 / 43122 已被占用时明确失败，不杀不认识的进程。

## 3. 本轮已经解决的大测问题

### 3.1 栈生命周期冲突

开发态：

```text
npm run dev:stack
```

Desktop：

```text
LCOS.exe → Runtime Supervisor
```

Deterministic Gate：

```text
必须先退出 Desktop / dev stack
→ gate 起自己的 Core/Vite/Test Runtime
```

`productization-s10-release-gate.mjs` 已改为在任何昂贵测试开始前检查：

- 43121 Core
- 43122 Bridge
- 5173 Vite

任一占用直接 FAIL FAST。

Playwright 已改：

```text
reuseExistingServer: false
```

同时 test output 改用 `%TEMP%/lcos-playwright-<pid>-<timestamp>`，避免复用仓库里上一轮 test-results。

### 3.2 C 盘临时目录问题

`s10-gate-run.mjs` 继续负责 gate 后清理 `%TEMP%/lcos-*`，并修正为真正统计清理字节，不再用估算值。

Desktop Runtime 自身增加磁盘空间预检：

- userData 所在磁盘剩余 < 512 MiB：启动直接给明确错误；
- 不让 SQLite 的 `disk is full` 再伪装成随机业务失败。

### 3.3 safe-delete

这属于 WorkBuddy 沙箱策略，不应该污染产品运行时。

处理原则：

- 正式 Desktop / Codex Windows 构建不走 WorkBuddy safe-delete shim；
- gate 的 `cmd rmdir` workaround 被限制在 gate wrapper 内；
- 不把“绕过删除策略”做成 LCOS 产品级 helper。

### 3.4 PowerShell 依赖

Desktop Alpha 已移除两个最碍事的用户级 PowerShell 依赖：

- PowerShell WinForms Tray → Electron Tray；
- PowerShell 文件夹选择器 → Electron native `dialog.showOpenDialog`。

旧开发脚本仍保留，不影响 Desktop 主链。

### 3.5 Bridge URL 漂移

Desktop Supervisor 显式注入：

```text
LCOS_CORE_URL=http://127.0.0.1:43121
LCOS_BRIDGE_URL=http://127.0.0.1:43122
LCOS_CORE_TOKEN_FILE=<userData authoritative token>
```

不允许 Desktop Runtime 依赖开发默认端口猜测。

### 3.6 Bridge Result 契约

新增：

`docs/protocols/communication-protocol.md`

正式写清：

```text
changedFiles[].path
```

而不是：

```text
changedFiles[].absolutePath
```

同时明确 `outputId / required` 等 ExpectedOutput 字段不能塞进 ChangedFileV1。

### 3.7 executor resume MCP 暴露问题

0.1 当前结论：

- MCP 是首选；
- 已存在的 Codex Session 可能冻结旧 tool surface；
- 续接会话若 `lcos-executor` unsupported，可走严格同契约的 Local Core executor REST fallback；
- 必须记录 warning/evidence，不能无声降级。

这一兼容规则已写入 communication protocol。

正式消灭该 fallback，放到 0.1 后续 Codex provider integration hardening，不阻塞 Desktop Alpha。

## 4. Codex 首次连接

Desktop 首次启动时，如果尚未配置 LCOS Codex Integration，会出现一次原生小提示：

```text
让 LCOS 接管本地 Agent 执行？

[连接 Codex] [稍后]
```

用户确认后：

1. 复制当前版本的 `lcos-agent` MCP runtime 到 userData 稳定目录；
2. 复制 LCOS managed Skills 到稳定目录；
3. 备份 Codex config；
4. 安装/修复 `local-creative-os` 与 `lcos-executor` MCP；
5. 安装 managed Skills；
6. 写入 integration marker；
7. 启动 Codex Orchestrator。

为什么复制到 userData：Squirrel 更新后 `app-0.x.x` 目录会变化，Codex 配置不能指向一个将来会被更新器删掉的版本目录。

MCP Windows launcher：

- 优先系统 `node.exe`；
- 没有 Node 时，动态寻找当前安装的 `LCOS.exe`，通过 `ELECTRON_RUN_AS_NODE=1` 作为 Node runtime 执行 MCP server。

因此正式安装不把“系统必须先安装 Node.js”作为用户前置条件。

## 5. Windows 打包形态

当前采用：

- Electron 43.2.0
- Electron Forge 7.11.2
- Squirrel.Windows Installer
- Windows ZIP 便携构建产物

产物目标：

```text
LCOS-Setup.exe
LCOS-0.1.0-full.nupkg
RELEASES
LCOS-win32-x64.zip
```

当前 0.1 Alpha 暂不阻塞：

- 自动更新服务；
- Windows 正式代码签名；
- macOS；
- OCR Python runtime 完全内置。

其中代码签名在对外分发前必须补；OCR 在无 Python 环境下视为可降级的可选能力，不影响 Canvas / Context / Workflow / Run 主链。

## 6. 当前源码 Gate

在本环境已经完成：

```text
Desktop Main / Preload / Runtime Supervisor / Static Host
node --check PASS

Desktop build scripts
node --check PASS

Codex MCP / Skill installer changes
node --check PASS

S10 gate / cleanup changes
node --check PASS

Light Bridge desktop entry
python py_compile PASS

Web changed TS files
TypeScript transpile syntax PASS

JSON / Forge config parse
PASS
```

当前环境无法完成：

1. `npm install` / lockfile refresh：registry install 在当前 sandbox 超时；
2. Squirrel.Windows Make：当前环境不是 Windows，且没有 Mono/Wine；
3. Windows Light Bridge PyInstaller build；
4. Windows 真机 Electron Render / Tray / Codex Integration QA。

这些是环境 Gate，不是需要 Codex 重新设计的产品缺口。

## 7. 明天 GUI 0.1 收口，只做三条用户链

Desktop 能跑后，GUI 不再全局“美化”。只收 Context / Workflow / 跨空间连续性。

### A. Context：用户是在“理解这件事”

目标用户感受：

```text
把材料投进 Context
→ 立即看到哪些是来源、哪些互相支持、哪些形成判断
→ Hover 一块材料，相关证据/判断响应
→ 选中判断，可以顺着来源回看
→ 需要执行时直接推进到 Workflow
```

不再做：

- 紫色泡泡图；
- Context 专属“另一张材料卡”；
- 大量永久控制面板。

同一个 Project Entity 继续保持同一张脸；Context 的性格长在：

- cluster / relation；
- evidence ↔ judgement；
- Context core；
- local Agent proposal；
- relation signal。

### B. Workflow：用户是在“推进下一步”

目标用户感受：

```text
把材料投到某一步
→ 输入位置明确打开
→ 当前步骤、上一步结果、下一步动作一眼看清
→ Hover 某一步，上下游响应
→ 运行时 signal 沿 Edge / DotGlyph 前进
→ 结果回来后直接 Review / Feedback / Revision
```

Workflow 的性格长在：

- directional spine / edge；
- input/output placement；
- next-action affordance；
- current / waiting / running / completed signal。

不是再给节点换一套外观。

### C. Canvas → Context → Workflow 连续性

0.1 最终要验收的是一个对象：

```text
主画布上的文件
→ Semantic Drop 到 Context
→ 仍然一眼认出同一对象
→ Context 中形成用途说明
→ 推进到 Workflow
→ 仍是同一个对象，只改变局部角色
→ F / 在哪 可以在三处来回定位
```

16×16 Dynamic Signal 负责告诉用户：

```text
可拿起
→ 正在拿起
→ 目标可接收
→ 放入成功
→ 当前活跃 / 运行
```

而不是重新承担“PDF / MD 文件格式 Logo”的工作。

## 8. 0.1 Desktop Candidate Gate

明天只有同时满足下面这些才允许叫 0.1 Desktop Candidate：

```text
S10 real harness evidence PASS
+
Windows Desktop installer 可安装
+
Desktop Runtime 自动拉起 Core / Bridge
+
Codex 首次连接可完成
+
真实 Run 可从 Desktop 闭环
+
Canvas / Context / Workflow 关键用户链通过
+
Semantic Drop 主链通过
+
close → tray → reopen → full quit 正常
+
重启后 Project / Context / Workflow / Session 连续性正常
```

不因为“Setup.exe 能双击”就宣布桌面版完成。
