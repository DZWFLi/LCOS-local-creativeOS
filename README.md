# AdFrame Script — 商业视频脚本 AI 协同评审台

**一个前端作品集 Demo，定位"本地创意操作系统评审模块"。不依赖后端、数据库或真实 AI API。**

---

## 定位

AdFrame 是一页式商业视频脚本评审工作台。它把 Brief、人工创意判断和 AI Skill 分析统一到脚本版本中，定位商业视频脚本的问题，生成可执行的修改决策和下一轮创作上下文，最终通过 Markdown/JSON/Codex Handoff 传递给下游制作。

这不是 SaaS 产品、不是通用视频批注工具、不是 AI 内容生成器。它是一个**前端 Demo，证明评审闭环可以发生在一个可理解、可交互、可导出上下文的界面里**。

---

## 为什么从脚本切入

最早的 AdFrame 概念是"AIGC 视频成品评测台"——人看 AI 生成的广告视频，逐条打分。但调研后发现两个问题：

1. **视频成品的修改成本太高**。商业逻辑问题（人物动机缺失、产品植入生硬）在成品阶段已无法低成本修正。
2. **广告行业真实工作流里，Brief、脚本、分镜和客户反馈的交汇点才是判断发生的地方**。

转向脚本评审后，输入变成结构化文本 + 明确 Brief，AI 判断更稳定，修改成本更低，输出可直接拆成 Shot List 和 Prompt Pack。

---

## 当前功能（V0.2.5）

| 功能 | 说明 |
|------|------|
| **脚本版本管理** | V1 → V2 → V3 三版本链，每版含 5 个剧本段落（HOOK / HEAT SETUP / PRODUCT SETUP / COOLING PAYOFF / END CARD），版本间 sourceVersionId + decisionId 追溯 |
| **Creative Review 评审卡** | Issue / Business Impact / Evidence / Suggestion 四字段，Open → Accepted → Resolved 状态流转，Keep / Modify / Remove 决策动作 |
| **Mock AI Skill 分析** | 模拟 Brief Alignment、Character Motivation、Product Communication 三项 Skill 分析草稿，AI Original 与 Human Revision 并存 |
| **决策汇总** | 自动从评审卡同步 Keep / Modify / Remove 清单 + Next Version Goal |
| **版本对比** | Source / Current 版本并排对比，显示同一段落的 beat action |
| **localStorage 持久化** | Schema 版本化的单 key 存储信封，legacy 数据自动迁移，刷新后状态不丢失 |
| **导出** | Markdown（含 Brief、评审、决策、Next Goal）、JSON（结构化 Handoff payload）、Codex Handoff（一键复制） |
| **Demo 重置** | 确认对话框 → 恢复 Script V2 / PRODUCT SETUP / Human Review 初始状态 |

---

## 3 分钟演示路径

```bash
npm install && npm run dev
```

然后按以下顺序演示：

1. **左栏切版本**：点击 Script V1 → V2 → V3，右侧评审卡和 AI 草稿跟随切换
2. **展开创意方向**：点击顶部 Brief Bar 展开 Creative Direction + Locked Elements
3. **人工评审**：Human Review tab → 查看 V2 的两条评审卡 → 点击 status 按钮流转状态 → 更改 Decision Action
4. **AI 分析**：切到 AI 分析 tab → 查看 Mock Skill Finding → 编辑 Human Revision → Accept / Revise / Reject
5. **版本对比**：点击 Source / Current Compare 按钮 → 查看 V1 与当前版本同一段落差异
6. **决策页**：切到 Decision tab → 查看自动汇总的 Keep/Modify/Remove → 编辑 Next Version Goal
7. **导出**：展开底部 Context / Export 抽屉 → 下载 Markdown → 下载 JSON → 复制 Codex Handoff
8. **重置**：点击顶部"恢复演示数据" → 确认 → 回到 V2 / PRODUCT SETUP

---

## 技术边界

| 包含 | 不包含 |
|------|--------|
| React 19 + TypeScript + Vite | 后端 / 数据库 / 认证 |
| 纯前端，localStorage 持久化 | 真实 AI API / 模型调用 |
| lucide-react 图标（唯一 UI 依赖） | 组件框架（MUI/Ant Design/Tailwind） |
| 一个预设案例：PortaSplit / The Thinker | 第二案例（Match Night KOL/KOC） |
| 5 个剧本段落的 V1/V2/V3 版本 | 多用户协作 / 权限 |
| 1024px 响应式 | 移动端 |

---

## 运行

```bash
git clone <repo-url>
cd 演示demo
npm install
npm run dev        # 开发服务器，默认 localhost:5173
npm run build      # 生产构建
npm run lint       # Oxlint 检查
```

---

## 项目结构

```
src/
├── App.tsx                          # 主组件，状态管理 + 四区布局
├── components/
│   ├── ScriptRail.tsx               # 左栏：版本列表 + 段落导航
│   ├── ScriptCanvas.tsx             # 中栏：Brief Bar + 段落编辑 + 版本对比
│   ├── EvaluationPanel.tsx          # 右栏：人工评审 / AI 分析 / Decision 三 Tab
│   └── ExportDrawer.tsx             # 底栏：Markdown / JSON / Codex Handoff 导出
├── data/
│   └── scriptProject.ts             # PortaSplit 预设数据（Brief、版本、评审、AI 草稿）
├── types/
│   └── evaluation.ts                # 全部 TypeScript 类型定义
├── services/
│   └── reviewExports.ts             # 导出逻辑（手写 Markdown + Handoff JSON）
├── infrastructure/
│   └── demoStorage.ts              # localStorage 封装（schema 版本化 + 迁移）
├── demo/
│   └── seed.ts                     # Demo 初始状态 + schema 版本常量
├── index.css                       # CSS 变量（暗色 Token）
└── App.css                         # 全部布局与组件样式
```

---

## 已验证项

| 检查 | 状态 | 详情 |
|------|------|------|
| TypeScript Build | ✅ | `tsc -b && vite build` 通过 |
| Lint (Oxlint) | ✅ | 0 errors, 0 warnings |
| 1366×768 视觉 | ✅ | 三栏完整，无溢出 |
| 1024×768 响应式 | ✅ | 左栏收缩至 168px，无横向溢出 |
| localStorage 持久化 | ✅ | 刷新保留状态，损坏自动回退 seed |
| 版本隔离 | ✅ | 切版本时评审/AI/Decision 正确联动 |
| 案例依据可追溯 | ✅ | 项目逻辑与修改依据来自真实迭代；Mock AI、时间和界面状态为演示用结构化数据 |

---

## 路线图

| 阶段 | 内容 |
|------|------|
| Day 1 | 静态工作台骨架（三栏布局、视觉 Token、展示级交互） |
| Day 2 | 人工评审 + Mock AI + 决策 + localStorage + 导出闭环 |
| Day 2.5 | 存储/导出/种子架构抽离、Demo 重置、构建修复 |
| Day 3 | 案例文档 + 项目 README（当前） |
| 未来 | Match Night KOL/KOC 第二案例；AdFrame Visual（分镜评审）；AdFrame Motion（视频成品评审） |
