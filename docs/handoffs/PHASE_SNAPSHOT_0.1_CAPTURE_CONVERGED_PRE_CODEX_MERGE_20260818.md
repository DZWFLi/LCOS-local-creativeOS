# LCOS Phase Snapshot · 0.1 Capture Converged / Pre-Codex Merge
日期：2026-08-18

## 当前阶段一句话

**S10 产品化主链已进入收口；Desktop 正式打包暂停；PASS7 把 PASS6 Desktop Alpha 与系统级 Capture Space / Capture Float 合成下一份唯一工作树基线。**

## 当前唯一交接基线

```text
PASS7 = S10 后全栈
      + 产品化 PASS5
      + Desktop Alpha PASS6
      + Capture Convergence PASS7
```

给 Codex 时：

> **只给 PASS7，不再单独给 PASS6。**

否则等于让 Codex 对同一批 Desktop 文件先合一次，再和 Capture Window 合第二次，徒增冲突。

## 0.1 已冻结主链

```text
Capture Float / Browser Capture
          ↓
     Capture Space
          ↓
  Project Main Canvas
          ↓
       Context
          ↓
      Workflow
          ↓
 Agent / Proposal / Revision
          ↓
 Continuity / Reopen
```

### Capture Space 冻结定义

- 独立于所有 Project。
- 是“项目之前”的常驻轻量 Canvas。
- Capture 内容仍是 staging/cache，不要求先迁成正式项目文件。
- AI 只在该空间做理解、项目匹配提示、分组和摆放。
- 用户通过 Semantic Drop 把材料放进已有项目。
- 投送项目不删除源 Capture cache。

### Capture Float 冻结定义

- OS 级常驻输入入口。
- 默认目标永远是 Capture Space。
- 只承担 Drop/Capture/最近加入/打开 Capture Space。
- 不承担 Context、Workflow、项目管理。

### Browser Capture 冻结定义

- canonical 0.1 extension = `extension/`。
- 默认 staging/Capture Space。
- 旧 43123 wake/PowerShell assistant 已退役。

## 明确不进 0.1

- 上下文驱动真实本地项目文件移动/重命名。
- Windows Stable File ID / FileOperationJournal / dependency relink。
- Capture 自动无确认归项目。
- Capture 多 Project 复用语义。
- Desktop Squirrel 正式 installer / 签名 / 自动更新。
- 新一轮全局视觉语言重构。

## Desktop 状态

PASS6 的 Desktop Runtime Supervisor 源码保留在 PASS7 中，Capture Float 也已并入 Electron Host 源码。

但当前阶段只要求：

> 合工作树、恢复依赖、验证源码和 Web/Capture 主链。

暂时不要求：

```text
desktop:bridge:build
desktop:package
desktop:make:win
```

## Codex 下一次动作

Codex 只做一次统一合并：

```text
当前真实 S10 worktree
        +
PASS7 单一增量
        ↓
一个 clean HEAD
```

合并中不得重新设计 Capture，不得恢复 StagingDialog 主路径，不得恢复 extension auto 默认，不得单独再套 PASS6。

## 合并后的下一阶段

完成真实 build/QA 后，再继续 0.1 最后一轮：

1. Capture Space / Float 真机手感修正；
2. Context GUI 收口；
3. Workflow GUI 收口；
4. Canvas → Context → Workflow Golden Flow；
5. 最后再恢复 Desktop installer 正式化。
