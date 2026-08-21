# 给 Codex：LCOS PASS8 Standalone Baseline 接管单

这次不要 merge / apply 历史 patch。

## 输入

直接解压：

`LCOS_FULLSTACK_DESKTOP_CAPTURE_BASELINE_PASS8_20260818.zip`

把解压目录作为新的 LCOS 工作目录/工作树起点。

## 第一步

```bash
npm run baseline:bootstrap
```

第一次不要 `npm ci`。PASS8 源码快照内的 `package-lock.json` 来自加入 Desktop workspace 前；bootstrap 会执行一次 `npm install`，刷新 lockfile 并跑 Desktop ready doctor。

## 第二步

```bash
npm run typecheck
npm run test
npm run build
npm run check:0.1:deterministic
```

只修这些 Gate 暴露的真实 blocker，不重新设计产品。

## 第三步：Windows Desktop dev QA

```bash
npm run desktop:doctor -- --ready
npm run desktop:start
```

检查：

1. Main Window 启动并自动托管 Core / Bridge。
2. Tray 工作。
3. Capture Float 独立、always-on-top、可移动并记住位置。
4. Explorer 文件 / 文本 / URL Drop → Capture Space。
5. Capture Space reload 后 presentation 不丢。
6. AI 整理只改 Capture Space，不自动归项目。
7. Semantic Drop → Existing Project 成功，目标项目旧节点不移动。
8. 关闭/重启后 Runtime 与 Capture 正常。

## 当前不要做

- 不要再应用 PASS5 / PASS6 / PASS7 patch。
- 不要恢复旧 PowerShell Capture Assistant / 43123 wake / StagingDialog 主路径。
- 不要做真实项目文件自动 move/rename。
- 不要先做全局 UI 重构。
- 暂时不要因为 installer 报错改产品架构。

## Windows installer

等以上 Gate 通过并且用户要求正式 make 后再跑：

```bash
npm run desktop:doctor -- --release
npm run desktop:make:win
```

然后回传：新 `package-lock.json`、唯一 Git HEAD、Gate 结果、Desktop/Capture 真机截图、以及如果执行 make 则回传 `LCOS-Setup.exe`。
