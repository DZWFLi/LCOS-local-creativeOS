# LCOS B6 连续性 E2E 矩阵

明日/真实环境重点测试：

| 场景 | 期望 |
|---|---|
| 当前目录命中项目 | Resolve 返回唯一项目 |
| 已绑定 Session，无目录证据 | Session Binding 可恢复项目 |
| 进入已有 Workspace | Resume 恢复 Workspace + WorkState |
| 换 Provider | Attach Bundle 结构不改变，只改变 provider/harness 消费方 |
| DeepSeek/Codex 连续切换 | 不要求重新组织项目上下文 |
| Agent 返回总结 | SessionSummary + Handoff 同时存在 |
| Agent 返回 Artifact 引用 | Session sourceRefs 被更新 |
| Local Core 重启 | R17 realtime snapshot/replay 恢复；Continuity cursor 更新 |
| 仅打开项目工具 | 不应暗中触发 Utility API |
| 显式检查连续性 | 可以触发 B4 Intent/Attention/Context Composer |
