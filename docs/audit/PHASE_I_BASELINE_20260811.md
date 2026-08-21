# Phase I 资源基线｜第一轮真实测量

> 日期：2026-08-11（晚）
> 脚本：`scripts/phase-i-baseline.mjs`（可重复执行：`node scripts/phase-i-baseline.mjs [projectId]`）
> 环境：Windows（本机），LCOS dev 栈（Core 43121 / Bridge 43122 / Web 5173），Golden 项目 `project-lcos-golden-gate-2026-08-17314dfd`

## 1. 常驻进程内存（Working Set）

| 进程 | 内存 |
|---|---|
| Core（local-core dist） | 104 MB |
| Bridge（light-bridge） | 38 MB |
| Web（vite dev） | 188 MB |

> 说明：dev 模式（vite 未压缩产物），正式打包后 Web 侧应显著下降；真实并行基线（LCOS + ChatGPT Desktop + WorkBuddy + 浏览器）留 Phase I 真机 Gate。

## 2. Golden 项目 graph

- 大小：187,584 B（145+ 视图、关系、备注、快照全量）
- 拉取耗时：约 46 ms（本地 127.0.0.1）

## 3. 浏览器加载（headless Chromium，1440×900）

- domcontentloaded：~629 ms
- canvas 就绪：~816 ms
- 渲染节点数：146（145 种子视图 + 1 条 URL 导入验收节点）

## 4. 预览生成（text revision → thumbnail）

- 生成到 ready：~263 ms

## 5. 检索

- artifact search（“项目资料”）：~2.7 ms，命中 50 条

## 结论与下一步

- 当前基线满足“先测量再治理”的第一步；ResourceGovernor / Ollama 策略 / Canvas 缩略图层级等 Phase I 施工项未开始（见 OPEN_DEBTS）。
- Ollama embedding benchmark 因本机未安装 Ollama 保持 BLOCKED（用户自装后跑 `npm run smoke:conversation-semantic`）。
