# Codex Start Here · Local Creative OS v0.6.0

本包是完整累计版，不要再分别套用 Phase 1、2、3 的旧代码。历史文档已移至 `docs/archive/`。

## 执行顺序

1. 阅读 `README.md`；
2. 阅读 `docs/release/V0.6.0_FRONTEND_BASELINE.md`；
3. 执行 `npm ci`；
4. 执行 `npm run check`；
5. 启动 `npm run dev -- --port 5193`，或使用一个空闲端口；
6. 严格按 `CODEX_RUN_V0.6.0_FULL_REGRESSION.md` 做正常交互回归；
7. 只生成测试报告和截图，不修改产品源码。

## 禁止事项

- 不得重新设计 UI；
- 不得添加第二个 Work Rail、聊天侧栏或独立 Command 大面板；
- 不得修改 Fixture 来绕过失败；
- 不得只用 `?state=` 截图替代正常交互；
- 不得因 Resize Handle 不存在判失败，v0.6 已冻结为紧凑 / 标准 / 展开三档密度；
- 不得把 Current Artifact 判定为必须进入 Pending Return Zone；该区域只容纳 Draft / Pending；
- 不得接入真实后端、文件写回或新依赖。

## 报告要求

报告必须区分：

- 正常交互 PASS；
- Fixture 仅证明目标状态可渲染；
- 未测试；
- 前端 Fixture 与真实后端边界。

遇到 P0 后停止当前链路，保留干净证据；可以从独立 Fixture URL 继续测试互不依赖的其他模块，但不能把 Fixture 结果算作失败链路通过。
