# LCOS Gate F Windows 实机验证清单
## 2026-08-05 最终收口候选

> 目标：验证真实 Windows、真实 Codex CLI、真实浏览器与真实项目闭环。
> 禁止：用脚本模拟 Agent、手工改数据库、用“进程存在”代替结果回收。

---

# 1. 环境确认

在 PowerShell 中保存完整输出：

```powershell
codex --version
codex --help
codex exec --help
codex resume --help
where.exe codex
node --version
npm --version
wsl --status
```

支持包记录的目标环境曾使用：

```text
Codex 0.147.0-alpha.1.2
%LOCALAPPDATA%\OpenAI\Codex\bin\<version>\codex.exe
```

若版本变化，以当前真实帮助信息为准，但仍必须使用显式 Session ID，不允许恢复“最近会话”猜测策略。

---

# 2. 源码与质量链

```powershell
npm ci
npm run audit:manifest:verify
npm run lint
npm run typecheck
npm run test
npm run test:architecture
npm run test:integration
npm run build
npm run check:gatef-closeout
npm run check:gatef-capabilities
```

Bridge：

```powershell
cd tools\light-bridge-kernel
python -m pytest -q
python -m compileall -q src\lcos_bridge
cd ..\..
```

必须记录：

```text
命令
退出码
测试数量
失败文件
开始与结束时间
```

---

# 3. 安装并验证 Codex Skill / MCP

```powershell
npm run lcos:install-skill
npm run lcos:install-mcp
codex mcp get local-creative-os --json
```

重启 Codex CLI / Desktop 会话后确认：

```text
能够列出 LCOS 项目、读取 ActiveContext、认领 Run、提交结果、请求用户输入。
```

不得接受：

```text
Agent 因 MCP 缺失偷偷使用旧 REST 地址，却仍报告 MCP 成功。
```

---

# 4. 启动

```powershell
npm run dev:open
npm run dev:status
```

本轮 Windows 产品化后置，因此仍可使用开发启动入口。验证重点是统一启停与真实功能，不把改名当软件化。

测试项目：

```text
docs\testing\fixtures\gatef-disposable-project
```

复制到临时目录后再使用，测试结束可直接删除。

---

# 5. 固定场景矩阵

## 场景 A：新 Session + analyze 零文件

```text
选中 brief.md 和两张参考图
输入：比较这些资料的共同方向，不要生成文件
发送给 Codex
```

通过条件：

```text
自动创建一次 Codex Session
自动 claim / start / submit
Run 完成后 UI 能看到分析正文
不创建文件或 Draft
Core 保存 projectId + codex Session Binding
```

## 场景 B：精确 Session 复用

连续发送 3 次 analyze / revise。

通过条件：

```text
三个 Run 使用同一个 externalSessionId
没有根据最新 JSONL 绑定其它对话
没有每次拉新窗口
没有重复 run.started / review_ready / completed
```

## 场景 C：自然语言 Context 操作

```text
把第二张也加进来
把 reference-2 移出参考
这次只看 brief 和第一张图
```

通过条件：

```text
Skill 使用 ActiveContext ordered selection
可逆、用户明确的操作直接执行
版本冲突时重读并自动修正一次
不创建无意义 Run
```

## 场景 D：Target / Context 自动识别

多选 brief、图片和一个可修改 Markdown，输入：

```text
参考这些帮我改一下，让开头更清楚
```

通过条件：

```text
Agent 识别一个 Target，其余作为 Context
用户不填写 Intent / Target ID / Revision ID
Core 只验证计划
结果返回 Draft，Current 未自动改变
```

## 场景 E：真实 waiting_input

让 Agent 遇到一个真实歧义，或通过测试 Skill 请求：

```text
A 版和 B 版都可以保留，你需要用户决定
```

通过条件：

```text
Run 进入 waiting_input，不进入 failed
UI 显示自由文本与可选项
等待不会自动取消
回答后同一个 Task 重新 queued
Runtime Host resume 同一个 Project Session
旧 waiting_input 结果不能重复打开问题
```

## 场景 F：自动修正一次

在 Agent Plan 中制造一个过期 Context Version。

通过条件：

```text
第一次校验失败
Skill 自动重读并修正一次
不先把 409 甩给用户
第二次仍失败才询问
没有无限循环
```

## 场景 G：Running 撤回与迟到结果

在较长任务运行时点击“撤回”。

通过条件：

```text
Runner 收到 graceful interrupt
必要时只终止本实例拥有的进程树
Run → cancelled
Session Binding 默认保留
迟到结果只归档，不产生可使用 Draft
```

## 场景 H：Agent Browser 1 秒同步

在 Agent 浏览器视图保持打开时：

```text
单选
Ctrl/Cmd 多选
改变 Context
切 Workspace
移动 View
```

通过条件：

```text
Agent 面板 1 秒内看到新 version
同版本不重复刷新
Core 重启后自动重连
Running Run 显示冻结上下文，不随选区漂移
```

## 场景 I：Obsidian 只读导入

准备一个临时 Vault，至少包含：

```text
.obsidian/
2 个 Markdown
1 个双链
1 个标签
```

通过条件：

```text
UI 明确说明只读
扫描不显示 .obsidian 内容
可选择性导入
导入后 Vault 文件 Hash 和修改时间不变
LCOS API / UI 不泄露 Vault 绝对路径
```

## 场景 J：连续 5 Run

同一项目依次执行：

```text
analyze
revise
create
waiting_input → answer
analyze
```

通过条件：

```text
无重复窗口
无重复事件
无无限日志
同一 Session 优先复用
每个 Run 都能在人话 Activity 中定位
```

---

# 6. 必留日志

```text
Local Core stdout / stderr
Light Bridge stdout / stderr
Watchdog / Runtime Host stdout / stderr
Codex CLI JSONL stdout / stderr
Run ID
Task ID
Project ID
external Session ID
各阶段时间
```

性能至少分解：

```text
Run 创建 → claim
claim → Codex 开始
开始 → submit
submit → UI 结果可见
```

---

# 7. Stop 条件

出现以下任何情况，不继续连续测试：

```text
绑定到错误 Codex 对话
MCP 未安装却继续自动执行
源文件被直接覆盖
Accept 之前 Current 改变
撤回后结果仍可 Accept
同一个错误无限拉新 Session
Obsidian Vault 被修改
```

---

# 8. 最终通过口径

```text
用户能自然找到入口并完整用完
Agent 能通过 Skill 自动执行并返回可恢复结果
刷新和重启后状态还在
出错可恢复，主界面错误是人话
同一 Project Session 不乱跳
```
