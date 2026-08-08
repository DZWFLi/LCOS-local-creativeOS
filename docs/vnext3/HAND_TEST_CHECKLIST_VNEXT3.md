# LCOS VNext.3 手测与实现回归清单

这份按本轮真实踩坑整理。静态检查全绿不代表交互能用，人类发明鼠标显然不是为了只看 TypeScript。

## A. 布局

1. 顶部操作图标实际间距 ≥ 6–8px；五个图标不能黏成一条。
2. 所有“图标 + 文字”按钮保持 `flex / inline-flex` 单行，文字不溢出按钮。
3. 下拉 / 更多菜单不 `flex-grow:1`，不挤碎同排按钮。
4. Left Rail、Minimap、Bottom Dock、浮层互相避让，小地图完整可见。

## B. 缩放与相机

5. 缩放到约 40%：Anchor / Edge Control / Selection Strip 仍保持可点击尺寸，确认反缩放生效。
6. 画布最底部交互区截止到 Bottom Dock 上方；Dock 下方没有“看得到但点不到”的 Canvas。
7. 恢复历史 Camera 后，内容必须落在顶部 / 左右安全区内，不被 Project Strip / Rail 遮住。

## C. Drop / Drag

8. 拖到左 / 下边缘：Drop 热区必须 ≥ Auto Pan 热区，Drop 不被 Auto Pan 抢走。
9. 进入 Drop 后再离开边缘：边缘激活态立刻熄灭；若 Destination Sheet 已开，Ghost 可继续拖向目标。
10. Ghost 在 Destination 上松手：直接投送，不要求“松手开面板 → 再点一次”。
11. Drop staging 时真实 Node 始终恢复 / 留在原位，只拖 Ghost。Canvas 中央松手应取消。

## D. 实现检查

12. 新写 CSS selector 后，逐条确认对应 DOM 真生成。重点：Workflow、Context Free、Run List、Conversation Change Rail。
13. 改 Surface / route / branch 后搜索旧 `return`、旧条件分支，确保没有提前短路新实现。
14. 源码改了页面却不变时，先检查 dev server 缓存、旧进程、旧 bundle，再继续改代码。

## E. 真实浏览器

15. 每轮至少亲手 / Playwright 指针完成：拖一次、缩一次、多选一次、Drop 一次；另外打开长对话 Hover + 点击一次 Change Rail。
16. 每条交互测试后 Reset / Reload，失败测试不得把节点留在画布外几千像素污染后续测试。

## F. 本轮产品语义回归

17. Bottom Capability 只显示：整理 / 上下文 / 工作流。Run / Deliver 不重新出现为主页面。
18. Workflow 允许自由摆放，不出现强制 Input / Skill / Agent / Output 泳道。
19. Workspace 编辑不要求选择 understand / explore / build / decide 等固定业务 Intent。
20. Context Graph 的 filter 只来自项目真实 Relation kind，不出现系统硬编码四分类。
21. 导入一条长对话：Change Rail 只导航该 Session；Hover 出一句话摘要；点击平滑定位并短暂高亮。
22. Project-level ContextSnapshot / Handoff 不自动混进某条对话的 Change Rail。
23. 右侧 Run Rail 能看到最近执行，Waiting / Review / Failed 能快速处理或打开详情。

总原则：**交互做出来先自己拖一遍、缩一遍、多选一遍，别只看代码和截图。**
