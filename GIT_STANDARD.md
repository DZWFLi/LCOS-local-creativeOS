# Local Creative OS — Git 版本管理规范

> 版本：v1.0  
> 适用范围：本仓库所有开发任务  
> 最后更新：2026-07-24

## 一、分支管理策略

采用简化版 Git Flow，三层分支体系：

```
main ─────────●──────────●──────────●──── (生产基线，只接受 merge)
              ↑          ↑          ↑
develop ────●─●─●────●─●─●────●─●─●─── (开发主线，日常集成)
            ↑   ↑    ↑   ↑    ↑   ↑
feature/* ──┘   │    │   │    │   │      (功能分支，从 develop 切出)
fix/*     ──────┘    │   │    │   │      (修复分支，从 develop 切出)
release/* ───────────┘   │    │   │      (发布分支，从 develop 切出)
hotfix/*  ───────────────┘    │   │      (紧急修复，从 main 切出)
rollback/*────────────────────┘   │      (回退分支，从 main 切出)
```

### 分支命名规则

| 分支类型 | 命名格式 | 示例 | 说明 |
|---------|---------|------|------|
| 功能分支 | `feature/<模块>-<简述>` | `feature/local-core-schema`、`feature/web-canvas-lod` | 新功能开发 |
| 修复分支 | `fix/<问题简述>` | `fix/sqlite-migration-chain` | 非紧急 bug 修复 |
| 发布分支 | `release/v<版本号>` | `release/v0.3.0` | 版本发布准备 |
| 紧急修复 | `hotfix/<问题简述>` | `hotfix/critical-data-loss` | 线上紧急修复 |
| 回退分支 | `rollback/v<版本号>` | `rollback/v0.2.0` | 版本回退 |

### 分支生命周期

| 分支类型 | 切出源 | 合入目标 | 合入后 |
|---------|--------|---------|--------|
| feature | develop | develop（MR） | 删除 |
| fix | develop | develop（MR） | 删除 |
| release | develop | main + develop | 打 tag → 删除 |
| hotfix | main | main + develop | 打 tag → 删除 |
| rollback | 目标 tag | main | 打新 tag |

### 当前分支映射

| 分支 | 用途 | 状态 |
|------|------|------|
| `main` | 生产基线（旧 AdFrame 历史） | 冻结，仅接受 merge |
| `develop` | 当前开发主线（Phase 2 代码） | **活跃** |
| `codex/backend-phase-0` | 后端 Phase 0-2 历史记录 | 已归档，不再提交 |
| `refactor/reusable-review-core` | 旧 AdFrame 重构分支 | 已归档 |

## 二、Git Commit 规范

采用 Conventional Commits 规范。

### 提交格式

```
<type>(<scope>): <subject>

[body]

[footer]
```

### Type 类型

| Type | 说明 | 本项目示例 |
|------|------|-----------|
| `feat` | 新功能 | `feat(local-core): 添加 Note CRUD 端点` |
| `fix` | Bug 修复 | `fix(db): 修复 migration v1→v2 未触发` |
| `docs` | 文档变更 | `docs(handoff): 生成 Phase 2 交接文档` |
| `style` | 代码格式 | `style(local-core): 统一缩进` |
| `refactor` | 重构 | `refactor(repo): 拆分为独立 Repository 文件` |
| `perf` | 性能优化 | `perf(canvas): 减少节点重渲染` |
| `test` | 测试相关 | `test(repo): 补充 Checkpoint CRUD 测试` |
| `chore` | 构建/工具/依赖 | `chore(deps): 升级 vitest` |
| `ci` | CI/CD | `ci: 添加 lint 流水线` |
| `revert` | 回退 | `revert: 回退 feat(local-core): 添加 Note CRUD` |

### Scope 范围（本项目）

| Scope | 对应目录 |
|-------|---------|
| `local-core` | `apps/local-core/` |
| `web` | `apps/web/` |
| `domain` | `packages/domain/` |
| `contracts` | `packages/contracts/` |
| `ui` | `packages/ui/` |
| `db` | SQLite schema / migration |
| `docs` | 项目文档 |
| `repo` | 仓库结构 / Git 配置 |

### 规则

- header 不超过 72 字符
- subject 使用中文祈使句（动词开头，不加句号）
- 一个 commit 只做一件事
- 禁止提交：`console.log`、`debugger`、注释掉的代码
- 禁止无意义提交：`fix bug`、`update`、`改了一下`

## 三、版本号与 Tag 规范

语义化版本：`v<MAJOR>.<MINOR>.<PATCH>`

| 版本位 | 触发条件 |
|--------|---------|
| MAJOR | 不兼容的 API 变更、架构级重构 |
| MINOR | 向后兼容的新功能 |
| PATCH | 向后兼容的 Bug 修复 |

### 当前版本线

| 版本 | 说明 |
|------|------|
| `v0.1.0` | AdFrame 原型阶段 |
| `v0.2.0` | Phase 2 Lite（SQLite 元数据持久化） |
| `v0.3.0` | Phase 2 完整（Notes/Revisions/Checkpoints） |

## 四、工作区与 Worktree 规则

### 禁止事项

- ❌ 禁止在主仓库同级目录创建 Git worktree（会造成 `OS开发-backend-phase-0` 等散落文件夹）
- ❌ 禁止 `git push --force` 到 main 或 develop
- ❌ 禁止绕过 MR 直接合入 main
- ❌ 禁止删除已推送的 tag

### Worktree 使用规范

如需并行开发多条分支，使用 worktree 放在 `.worktrees/` 子目录下：

```bash
# 正确：worktree 放在项目内部
mkdir -p .worktrees
git worktree add .worktrees/feature-xxx feature/xxx

# 使用完毕后及时清理
git worktree remove .worktrees/feature-xxx
```

## 五、保护分支设置

| 分支 | 保护规则 |
|------|---------|
| `main` | 禁止直接 push；必须 MR；禁止 force push |
| `develop` | 禁止直接 push；建议 MR；禁止 force push |
| `release/*` | 禁止 force push |
| `hotfix/*` | 允许直接 push，合入 main 仍需 MR |

## 六、日常开发流程

```bash
# 1. 开始新功能
git checkout develop
git pull origin develop
git checkout -b feature/模块名-功能简述

# 2. 开发中提交
git add <files>
git commit -m "feat(模块): 功能描述"

# 3. 推送并提 MR
git push origin feature/模块名-功能简述

# 4. 合入后清理
git checkout develop
git pull origin develop
git branch -d feature/模块名-功能简述
```

## 七、检查清单

每次开始编码前：

- [ ] 已从 develop 拉取最新代码
- [ ] 分支命名符合 `<type>/<desc>` 规范
- [ ] 清楚本次开发的目标和验收标准
- [ ] 涉及数据库变更的，迁移脚本已准备
- [ ] 不会触碰红区（Scope/Watcher/Preview/Bridge/真实文件写入）

## 八、回退流程

```
发现需回退
  ├── 小范围 → fix 分支常规修复
  ├── 紧急但可快速修 → hotfix 分支
  └── 需整体回退 → rollback 分支
        ├── 确认目标 tag
        ├── git checkout -b rollback/vX.Y.Z vX.Y.Z
        ├── 验证 → MR → 合入 main
        └── 打新 tag → 通知相关方
```
