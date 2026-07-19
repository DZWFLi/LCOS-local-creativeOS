# Current Repository Baseline

> 审计日期：2026-07-19  
> 审计目录：`E:\Codex 项目\OS开发`  
> 审计性质：只读基线审计；除本报告及本轮另外两份规定报告外，未修改、移动或解压任何文件。

## 1. 结论

当前目录不是 Local Creative OS 的可开发代码仓库，而是一份**开发文档包**：没有 `.git`、`package.json`、lockfile、TypeScript/Vite 配置、`src` 或测试。根目录 ZIP 仅包含四份入口文档，不是源码归档。经用户提供历史 Codex 任务后，已定位旧 AdFrame Prototype 的真实仓库 `E:\Codex 项目\演示demo` 与完整归档 `E:\Codex 项目\项目归档\AdFrame_Script_Review_Day3_2026-07-19.zip`；本报告后文“补充一手审计”覆盖此前仅基于新目录得出的临时缺失判断。

因此当前基线状态为：

- 产品与架构决策：已形成较完整冻结文档；
- 新目录 Git 基线：阻塞；当前目录不是 Git 仓库；
- 旧 Prototype：仓库已定位、工作区干净，lint/build 当前通过；
- 质量门：独立 typecheck、unit test、smoke scripts 缺失；
- 正式编码适配性：**不适合直接开始产品编码**；须先批准仓库承载与保护/迁移策略。

## 2. 已读取的控制文档

按用户指定顺序读取：

1. `CODEX_START_HERE.md`
2. `README.md`
3. `AGENTS.md`
4. `docs/DEVELOPMENT_REQUIREMENTS.md`

随后按入口要求读取/检查：

- 最新 PRD：`OS项目文档/Local_Creative_OS_PRD_V1.2_UI冻结决策回写版.docx`
- 最新 UI Spec：`OS项目文档/Local_Creative_OS_UI_Visual_Interaction_Spec_v0.2_冻结决策稿.docx`
- 当前 Handoff：`OS项目文档/01_Current_Core/CODEX_Local_Project_Reorganization_Handoff.md`
- 当前 ADR：`OS项目文档/01_Current_Core/Local_Creative_OS_GUI_Project_Coordination_ADR.md`
- 文档索引及当前/历史文档清单

## 3. Git 基线

| 检查 | 真实结果 | 判定 |
|---|---|---|
| `git status` | `fatal: not a git repository` | 失败/阻塞 |
| `git branch` | `fatal: not a git repository` | 失败/阻塞 |
| `git log --oneline -10` | `fatal: not a git repository` | 失败/阻塞 |
| `git diff --check` | 非仓库，输出 `--no-index` 帮助 | 失败/阻塞 |

无法确认当前分支、提交历史、工作区是否干净、未跟踪文件归属、稳定 tag 或可回滚点。根据 `AGENTS.md` 停止条件，不能在此状态下执行迁移或开发。

## 4. 当前目录树

```text
E:\Codex 项目\OS开发
├── AGENTS.md
├── CODEX_START_HERE.md
├── README.md
├── Local_Creative_OS_Codex_Development_Package_20260719_073944.zip
├── docs/
│   └── DEVELOPMENT_REQUIREMENTS.md
└── OS项目文档/
    ├── README_INDEX.md
    ├── Local_Creative_OS_PRD_V1.2_UI冻结决策回写版.docx
    ├── Local_Creative_OS_UI_Visual_Interaction_Spec_v0.2_冻结决策稿.docx
    ├── 01_Current_Core/ (8 份 Markdown)
    ├── 02_Historical_AdFrame/ (5 份 Markdown)
    └── docx记录/ (2 份旧版 DOCX)
```

本轮完成后新增且仅新增三份规定报告：

```text
docs/audit/CURRENT_REPOSITORY_BASELINE.md
docs/architecture/CURRENT_TO_TARGET_ARCHITECTURE.md
docs/handoffs/SPRINT_0_PROPOSAL.md
```

## 5. 包管理、配置、源码与测试

| 项目 | 结果 |
|---|---|
| 所有 `package.json` | 新目录 0 个；旧仓库 1 个 |
| lockfile | 新目录 0 个；旧仓库 `package-lock.json` |
| TypeScript 配置 | 新目录 0 个；旧仓库 3 个 |
| Vite 配置 | 新目录 0 个；旧仓库 `vite.config.ts` |
| `src` | 新目录不存在；旧仓库存在 |
| tests | 两处均无自动化测试文件 |
| scripts | 旧仓库有 `dev/build/lint/preview` |
| `.env*` / `.env.example` | 0 个 |
| CI 配置 | 0 个 |
| `.gitignore` | 不存在 |
| 数据库/schema/migration 实现 | 不存在 |

## 6. 可运行命令与质量门

`CODEX_START_HERE.md` 明确要求只运行仓库中已存在的命令。由于根 `package.json` 不存在，下列脚本均不存在，故没有伪造或临时创建命令：

| 命令 | 结果 |
|---|---|
| `npm run lint` | 旧仓库通过，0 errors/0 warnings |
| `npm run typecheck` | 未运行：独立脚本不存在；`tsc -b` 包含在 build |
| `npm run test` | 未运行：脚本不存在 |
| `npm run build` | 旧仓库通过；Vite 8.1.5，1782 modules，约 610ms |
| `npm run smoke` | 未运行：脚本不存在 |

Prototype 的 lint/build 基线可复验，但目标要求的五段质量链尚未建立。

## 7. 旧 Review Prototype 状态

### 历史证据

历史 Handoff/报告描述旧 AdFrame Prototype 曾包含：Script V1/V2/V3、Segment、Brief Snapshot、Human Review、Mock AI Draft、Decision、Compare、Demo Reset、Markdown/JSON/Codex Handoff、localStorage，以及 `ReviewRepository`、`ReviewEvaluator`、`ExecutionRuntime` 等边界。

### 当前事实

- 源码、seed、样式、QA 截图、构建配置与 Git 历史仍存在；
- localStorage schema/migration、导出 Builder、Mock UI 标识与 Reset seed 已实现；
- lint/build 当前通过；
- 本轮未重新进行浏览器手工点击，Reset/刷新/下载/剪贴板沿用历史证据，当前未复验。

判定：**Prototype 可保护、部分边界可复用；真实 Runtime、Local Core 与 Canvas 未接通。**

## 8. 可复用、Demo 专属与高耦合点

以下分类已结合真实代码核验；具体迁移仍需单独批准。

### 候选可复用能力

- Review / Decision / Locked Elements 的领域语义；
- Source/Current Compare；
- Repository / Evaluator / Runtime Adapter 边界思想；
- Demo Reset 和 `schemaVersion` 迁移意识；
- Markdown/JSON/Handoff 输出合同。

### Demo 专属候选

- 固定三栏 Review Workspace；
- PortaSplit 预置 Script 流程与 seed；
- Mock AI 固定结果；
- CopyOnly Codex Handoff；
- localStorage 作为项目状态源的实现。

### 已知高耦合风险

- 组件直接操作 localStorage；
- Mock 结果写入 UI 逻辑；
- Handoff 以字符串拼接实现；
- Demo seed、Review UI 与领域状态可能共址；
- 旧三栏 Shell 与 Review feature 可能未分离。

这些风险来自历史文档，必须在真实代码仓库中重新定位后才能给出文件级结论。

## 9. 专项关键词审计

| 专项 | 当前实现证据 | 判定 |
|---|---|---|
| localStorage | `demoStorage.ts` 单 key + legacy migration | Demo 可用；不得承载 Project Graph/Run |
| schemaVersion | Demo envelope 已实现 | 不是 Local Core migration |
| ReviewRepository | 未发现正式接口 | 历史计划未落成 |
| ReviewEvaluator | 未发现正式接口 | 历史计划未落成 |
| ExecutionRuntime | 未发现正式接口 | Handoff 只是复制/下载 |
| Bridge / Codex | 历史协作存在；产品未接入 | 真实产品闭环未验证 |
| Mock / CopyOnly | Mock UI 标识明确 | 禁止冒充真实能力 |
| changed_files / artifacts | 产品代码无结构化回收 | 目标合同待 Spike |

## 10. 敏感信息与绝对路径

### 敏感信息

对可检索文本执行了常见 Key/Token/Secret/Password/Cookie/OAuth 模式搜索。命中均为规则或风险说明，未发现疑似真实凭证值。DOCX 未做二进制正则断言，但读取内容未观察到凭证。

风险仍然存在：当前没有 `.gitignore` 与 `.env.example`，且不是 Git 仓库，无法验证历史提交是否曾包含秘密。

### 绝对路径

文档中存在历史/示例绝对路径：

- `E:\Codex 项目\演示demo`（旧 Handoff 与历史报告中的原仓库位置）
- `E:\CreativeOS\projects\portasplit`（ADR 示例）
- `C:\Users\1\.redskill`（历史研究环境记录）

这些路径不应直接进入未来运行时代码或测试断言。尤其 `E:\Codex 项目\演示demo` 与当前审计目录不一致，是定位真实仓库的首要线索。

## 11. 依赖与配置风险

1. **仓库身份缺失（最高）**：无 `.git`，无法保护 Prototype 或保证回滚。
2. **代码包缺失（最高）**：无工程文件，任何“迁移”都会变成从文档重建，违反保护旧 Prototype 的要求。
3. **基线不可复验（高）**：lint/typecheck/test/build/smoke 全部无入口。
4. **文档路径漂移（高）**：当前目录与 Handoff 指定的 `E:\Codex 项目\演示demo` 不一致。
5. **历史事实与当前事实混淆（高）**：历史报告不能替代当前代码与测试证据。
6. **配置安全门缺失（高）**：无 `.gitignore`、`.env.example`、CI 和密钥审计历史。
7. **冻结文档与开发包重复（中）**：ZIP 只重复四份入口文档；应保留但不能视为源码备份。

## 12. 启动编码前的必要动作

按优先级：

1. 用户确认真实代码仓库位置，优先核查历史路径 `E:\Codex 项目\演示demo` 或提供完整 Git clone/归档；
2. 在真实仓库重新执行全部 Git、依赖、配置、源码、敏感信息与测试基线审计；
3. 确认旧 Review Prototype 可运行并建立用户批准的冻结点；
4. 只有在基线可回滚后，才批准 Sprint 0 的骨架与 Spike 实施。

## 13. 回滚说明

本轮没有代码、配置、依赖或文件迁移。若不保留本轮成果，仅需删除三份新报告；原始文档与 ZIP 未被修改或解压。

## 14. 补充一手审计（覆盖前文临时判断）

用户提供历史任务 `019f69d0-f0f0-7612-98f1-8c6bb245a323` 后，完成了旧仓库只读核验：

| 项目 | 真实结果 |
|---|---|
| 仓库 | `E:\Codex 项目\演示demo` |
| Git | 干净；分支 `refactor/reusable-review-core`；HEAD `2a526f8` |
| 归档 | 4.01 MB、431 条目；历史记录 SHA256 `3027E903C0A97B4812C8E3EDD2D790BB7626A40E122798E4EA4A89D10CB0E17B` |
| 工程 | React 19、TypeScript 6、Vite 8、npm lockfile |
| `npm run lint` | 通过，0 errors/0 warnings |
| `npm run build` | 通过；`tsc -b && vite build`，1782 modules，约 610ms |
| `typecheck/test/smoke` | 无独立 scripts；未运行、不得标记通过 |

代码事实：

- `src/infrastructure/demoStorage.ts`：单 key envelope、`schemaVersion`、legacy migration、损坏回退与 Reset；
- `src/services/reviewExports.ts`：Markdown/JSON/Handoff builder 已从 UI 抽离；
- `src/demo/seed.ts`：确定性 Demo seed；
- `src/types/evaluation.ts`：Review/Decision/版本等类型集中；
- `src/components/*`：三栏 Review UI，可作为未来 feature 抽取候选；
- `src/App.tsx`：仍承担主要业务状态编排，是最高代码耦合点；
- `ReviewRepository`、`ReviewEvaluator`、`ExecutionRuntime`：历史计划提及，但当前源码未发现正式接口；
- Codex Handoff：复制/下载出口，不是真实 Runtime；
- Mock AI：界面明确标记 `Mock Skill Analysis`；
- changed files / artifacts：产品内没有结构化回收闭环。

因此，旧 Prototype 不是“缺失”，而是**位于相邻冻结仓库、可复验且可保护**；新 Local Creative OS 的仓库承载方式仍待用户决定。本轮未重新进行浏览器手工点击，Reset/刷新/下载/剪贴板沿用历史证据，诚实标记为“当前未复验”。
