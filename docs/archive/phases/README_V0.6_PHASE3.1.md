# Local Creative OS v0.6 Phase 3.1

Phase 3 浏览器验收热修版。基于完整 Phase 3 累计包，只修复阻断正式 v0.6 收口的导航、快捷键、关系证据与项目标签关闭问题。

## 修复范围

- Child Canvas 的“返回上级”和父级面包屑恢复真实点击能力；
- Scope 导航时保存当前 Scope / Workspace Camera，并优先恢复目标 Scope 的 Workspace；
- `C` 使用多次渲染同步重试，稳定聚焦 Work Rail Composer；
- `Ctrl/Cmd + Enter` 在 Composer 失焦或 BODY 焦点时也统一打开居中确认，不直接创建 Run；
- 新建 Child Scope 使用单次确定性 Graph Transaction，复制所选对象之间的全部内部关系；
- Canvas 暴露 `data-node-count`、`data-edge-count` 和关系 data 属性，便于真实链路验收；
- Project Tab 增加独立、可访问、可测试的关闭按钮；全部关闭后回到 Project Drive。

## 仍不代表

本包仍为前端 Fixture，不代表 Local Core、Bridge、Codex Runtime、真实文件回写与持久化已经接通。
