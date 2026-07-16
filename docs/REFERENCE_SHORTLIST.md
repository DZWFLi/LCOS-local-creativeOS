# AdFrame 视觉与交互参考短名单

> 调研日期：2026-07-16
> 目标：为一页式 AIGC 图片/视频人机协同测评台筛选高相关参考

## 筛选逻辑

仅收录与 AdFrame 四区结构（左侧素材/版本 → 中间媒体查看 → 右侧评测 → 底部 Context/Export 抽屉）有明确映射关系的产品。每项参考标注可借鉴点、不可照搬点、对应 AdFrame 区域。优先级：P0=核心区直接参考，P1=局部可借鉴，P2=灵感旁证。

---

## 1. Frame.io V4 — 视频协作审阅平台

- **URL**：https://frame.io/v4
- **相关度**：P0 — 最直接的视频审阅工作台参考
- **可借鉴点**：
  - **Panel-based layout**：多面板可拖拽排列，与 AdFrame 四区可调结构高度对应。左面板浏览素材，中面板播放媒体，右面板查看评论/元数据。
  - **Anchored comments**：点击帧级精准标注反馈，对应 AdFrame 右侧"时间点问题标记"交互。
  - **Fields panel**：右侧面板显示文件元数据（状态、编码、关键词），对应 AdFrame 右侧评测维度信息展示。
  - **WYSIWYG share editor**：统一预览和发送分享，对应 AdFrame 底部 Export 抽屉的"预览→发送"流程。
  - **Version comparison**：版本对比切换，对应 AdFrame 左侧版本历史管理。
  - **Fluid UI 原则**：<100ms 响应、60fps 动画，直接适用于 AdFrame 媒体播放区交互标准。
  - **暗色界面**：Frame.io V4 使用深色主题，UI 退让、媒体成为视觉焦点——这正是 AdFrame 的设计气质参考。
- **不可照搬**：
  - Frame.io 是完整 SaaS，有多项目、文件夹层级、团队权限等 AdFrame 不需要的功能。
  - 时间轴编辑器深度集成 Adobe 生态，AdFrame 不需要模拟。
  - 评论系统是 Frame.io 的核心功能，AdFrame 的评测是结构化打分而非自由评论。
- **对应 AdFrame 区域**：左侧（素材导航/版本）、中间（媒体播放器）、右侧（评测元数据面板）、底部（分享/导出）

---

## 2. Dropbox Replay — 富媒体审阅与反馈工具

- **URL**：https://www.dropbox.com/replay
- **相关度**：P0 — 轻量级视频审阅流程参考
- **可借鉴点**：
  - **Frame-accurate feedback**：精确帧级评论，标注位置直接绑定时间点。对应 AdFrame 右侧"时间点问题"的标记方式。
  - **Time-coded to-do lists**：时间点绑定待办项，对应 AdFrame 右侧评测维度与时间点的关联结构。
  - **Side-by-side version comparison**：版本并排对比，对应 AdFrame 左侧版本切换和中间 A/B 对比视图。
  - **Live review sessions**：实时审阅会话，为 AdFrame 未来 demo 演示提供"模拟实时协作"的交互参考。
  - **Custom branding**：可定制品牌外观（颜色、logo、banner），为 AdFrame 演示态的视觉打磨提供实践参考。
  - **评论区的展开/收起交互**：右侧评论列表可拖拽调整宽度或展开到全屏——直接对应 AdFrame 右侧评测区的宽度可调设计。
- **不可照搬**：
  - 依赖 Dropbox 存储体系，AdFrame 是纯前端 demo，不需要云存储后端。
  - 审阅流程围绕文件分享链接展开，AdFrame 的预设案例是本地 mock 数据，不需要分享链路。
  - 缺少结构化打分维度（Replay 是自由评论模式），AdFrame 需要 6 维固定评分。
- **对应 AdFrame 区域**：左侧（版本管理）、中间（媒体播放与帧级标注）、右侧（反馈面板）、底部（导出）

---

## 3. Runway — AI 创作与视频编辑工作台

- **URL**：https://runwayml.com
- **相关度**：P0 — AI 生成与人工编辑在同一界面的协同模式
- **可借鉴点**：
  - **Dashboard with tools sidebar**：左侧工具箱（Text/Image to Video、绿幕、运动跟踪等），对应对 AdFrame 左侧可切换的"AI Skill 面板"概念。
  - **Assets panel**：左侧底部资产库，展示已生成/上传的文件，对应 AdFrame 左侧素材列表。
  - **Video timeline with editing controls**：底部时间轴编辑器，对应 AdFrame 底部 Context 抽屉中的时间轴上下文（当素材是视频时）。
  - **AI generation + human editing 共存**：这是 Runway 最核心的设计理念——AI 生成结果与人工编辑在同一工作区内流转。对应 AdFrame 的"人工+AI 协同评测"核心概念。
  - **工具标签收藏**：常用工具可置顶，对应 AdFrame AI Skill 面板的常用/优先 Skill。
- **不可照搬**：
  - Runway 是功能极重的 AI 创作平台（30+ 工具），AdFrame 只是评测台，不涉及生成。
  - 视频时间轴复杂度远超 AdFrame 需求（AdFrame 的视频评测只需要关键帧标记）。
  - 界面交互学习曲线陡峭——Runway Academy 有大量教程，说明其界面本身不直观。
- **对应 AdFrame 区域**：左侧（工具/Skill 面板、资产库）、中间（媒体预览）、底部（时间轴上下文）

---

## 4. Linear — 产品开发系统（UI 设计系统参考）

- **URL**：https://linear.app
- **相关度**：P1 — 暗色工具型界面的设计系统标杆
- **可借鉴点**：
  - **"不争夺不该有的注意力"原则**：主内容区保持视觉焦点，侧边栏和导航低沉退让——直接指导 AdFrame 的视觉层级（媒体 > 评测 > 导航）。
  - **结构应被感知而非被看到**：减少分隔线、使用间距和层次代替显式边框——指导 AdFrame 四区之间的视觉分隔方式。
  - **LCH 色彩空间**：基于感知均匀的颜色系统（比 HSL 更精确的亮度一致性），指导 AdFrame 暗色主题的 CSS 变量体系。
  - **三值主题生成**：基色 + 强调色 + 对比度 → 自动生成完整主题。AdFrame 可借鉴此思路建立 CSS 变量链。
  - **新版 UI 的 dimmed sidebar**：导航侧边栏亮度降低，内容区获得视觉主导权——直接对应 AdFrame 左侧面板的视觉权重。
  - **紧凑的 tab 与 header**：标签和头部经过多轮迭代实现高密度且不拥挤——指导 AdFrame 顶部/区域标题的设计。
  - **键盘驱动 + 命令面板**：`Cmd+K` 全局搜索和命令，对应 AdFrame 可能需要的能力快捷切换。
- **不可照搬**：
  - Linear 是 issue tracker + 项目管理，信息密度和交互模式与 AIGC 评测台完全不同。
  - Linear 的列表视图和看板视图在 AdFrame 中没有对应功能。
  - Linear 是 SaaS 产品，其设计系统包含大量 AdFrame 不需要的组件（表格、弹窗、表单等）。
- **对应 AdFrame 区域**：全部（设计系统层级参考，而非功能参考）

---

## 5. Label Studio — 开源数据标注平台

- **URL**：https://labelstud.io
- **相关度**：P1 — 结构化评估界面与任务流转模式
- **可借鉴点**：
  - **三栏式标注界面**：左侧任务列表 → 中间数据查看/标注区 → 右侧标签/属性面板。与 AdFrame 四区结构高度相似。
  - **XML-based 界面配置**：标注界面通过 XML 配置生成，实现了结构化的灵活性。对应 AdFrame 如果未来需要可配置评测维度的设计思路。
  - **LLM 评估模板**：Response Moderation、Response Grading、Side-by-Side Comparison——这三种 GenAI 评估模板的设计思路直接启发 AdFrame 的评测维度 UI 表达。
  - **任务锁定机制**：同一任务同时只能一人标注——对应 AdFrame demo 中"人工评测区"的单人操作保护。
  - **标注历史与回退**：支持撤销/重做，对应 AdFrame 评测修改的交互可逆性。
- **不可照搬**：
  - Label Studio 的核心是标注工具（框选、多边形、关键点等），AdFrame 是评分工具。
  - 标注流程依赖 ML 后端进行预标注和 Active Learning，AdFrame 不需要。
  - 界面极度功能化、缺乏视觉打磨，不符合 AdFrame 的 portfolio demo 定位。
- **对应 AdFrame 区域**：左侧（素材/任务列表）、中间（媒体查看）、右侧（评测维度面板）

---

## 6. CVAT — 计算机视觉标注工具

- **URL**：https://cvat.ai
- **相关度**：P1 — 视觉数据工作台的布局与工作区管理
- **可借鉴点**：
  - **固定 Header + 顶面板 + 工作区 + 控件侧边栏 + 对象侧边栏**：清晰的五层框架，各层职责明确。对应 AdFrame 的 Header + 四区布局。
  - **Controls sidebar**：左侧导航、缩放、形状、编辑工具的面板化组织——对应 AdFrame 左侧"素材/工具"面板的信息架构。
  - **Objects sidebar**：右侧显示标签过滤器、对象列表和外观设置——对应 AdFrame 右侧评测面板的筛选和维度组织。
  - **图层与 Z 轴管理**：工作区支持图层叠加和独立控制——对 AdFrame 的对比视图（原图/生成图叠层）有启发。
  - **键盘宏指令自定义**：高级用户可以自定义快捷键组合——为 AdFrame 提供键盘操作的扩展点。
- **不可照搬**：
  - CVAT 是标注工具，核心功能是绘制和编辑标注形状，AdFrame 不需要。
  - 目标用户是专业标注团队，界面功能密度极高，视觉复杂度远超 AdFrame 的 portfolio demo 定位。
  - 视频标注的时间轴操作模式与 AdFrame 的"关键帧评测"模式不同。
- **对应 AdFrame 区域**：左侧（控件/工具面板）、中间（工作区）、右侧（属性/标签面板）

---

## 7. FiftyOne — 视觉 AI 数据探索与模型评估工具

- **URL**：https://voxel51.com
- **相关度**：P1 — Panel/Spaces 可组合面板架构 + 数据探索 UI
- **可借鉴点**：
  - **Spaces 可组合面板框架**：类似 VSCode 的面板系统——Samples Panel（媒体网格）、Histograms Panel（分布仪表盘）、Embeddings Panel（可视化画布）、Map Panel（地理数据）。面板可水平/垂直拆分、拖拽重排——这直接启发 AdFrame 的四区可调布局架构设计。
  - **Python Panels + 自定义 Dashboard**：通过简单 Python 接口构建自定义面板——对应 AdFrame 的 AI Skill 评测面板概念（模拟 AI 打分可通过模块化面板实现）。
  - **Saved Views**：保存当前的数据筛选和视图状态——对应 AdFrame 的评测状态持久化（localStorage）。
  - **媒体网格 + 单样本模态**：从缩略图网格进入单样本详情——对应 AdFrame 从素材列表选择进入媒体查看区的交互。
  - **插件框架**：可扩展的插件系统——为 AdFrame 未来扩展 AI Skill 评测类型提供架构参考。
- **不可照搬**：
  - FiftyOne 是 Python 后端 + 前端 App，架构模式不适用于 AdFrame 的纯前端 React 方案。
  - 面向数据科学家，界面功能密度和数据规模远超 AdFrame 需求。
  - 核心功能是数据集探索和模型评估，不是 AIGC 内容评测。
- **对应 AdFrame 区域**：全部（面板架构参考）、右侧（分布/统计仪表盘参考）

---

## 8. W&B Weave Evaluations — LLM 评估框架

- **URL**：https://docs.wandb.ai/weave/guides/core-types/evaluations
- **相关度**：P1 — 结构化评测维度和评分体系的 UI 表达
- **可借鉴点**：
  - **Evaluation = Dataset + Scorers 模型**：评估 = 测试集 + 多个评分函数。对应 AdFrame 的"固定案例 + 6 维评测维度 + 人工/AI 两种评分来源"核心模型。
  - **Side-by-side evaluation comparison**：并排对比不同评测运行结果——对应 AdFrame 中间区的 A/B 对比视图（人工 vs AI 评分）。
  - **Leaderboard 视图**：聚合多轮评测结果到排行榜——对应 AdFrame 的综合评测结论面板（跨案例对比）。
  - **Trace 溯源**：每次评测可追踪到具体的 LLM 调用链——对应 AdFrame 的"评测来源标识"（人工 / AI Skill X / 综合）。
  - **Saved views + imperative evaluations**：支持声明式和命令式两种评估方式——为 AdFrame 的评测触发方式提供参考。
- **不可照搬**：
  - W&B 是 ML 实验跟踪平台，评测是其子功能，整体产品形态与 AdFrame 完全不同。
  - 依赖 Python SDK 进行评测定义和运行，不适用于纯前端 demo。
  - 评测对象是 LLM 输出（文本为主），AdFrame 评测的是 AIGC 视觉资产。
- **对应 AdFrame 区域**：右侧（评测维度面板）、中间（对比视图）、底部（综合结论/导出）

---

## 9. Notion — 侧边栏 + 内容区 + 属性面板布局（补充参考）

- **URL**：https://notion.so
- **相关度**：P2 — 三栏信息架构的通用参考
- **可借鉴点**：
  - **左侧目录 + 中间内容 + 右侧属性面板**：经典三栏布局，对应 AdFrame 的基础信息架构。
  - **右侧属性面板的可折叠设计**：按需显示/隐藏——对应 AdFrame 右侧评测维度面板的折叠/展开。
  - **Database view 的筛选和排序**：列表视图的列头筛选——对应 AdFrame 左侧素材列表的筛选交互。
- **不可照搬**：
  - Notion 是文档/知识库平台，不是测评工具。
  - 页面内编辑为核心交互，AdFrame 是查看+评测，不需要富文本编辑。
  - 视觉风格偏亮色文档感，不符合 AdFrame 暗色审片工作台气质。
- **对应 AdFrame 区域**：左侧（目录/导航）、中间（内容区）、右侧（属性面板）

---

## 10. DaVinci Resolve — 专业调色/剪辑工作台（暗色工作台气质参考）

- **URL**：https://www.blackmagicdesign.com/products/davinciresolve
- **相关度**：P2 — 暗色专业工作台的视觉气质参考
- **可借鉴点**：
  - **暗色工作台气质**：全暗色界面 + 高对比度内容区。UI 绝对退让，内容（视频画面）成为唯一的视觉焦点。这是 AdFrame "暗色编辑部/审片工作台"气质的最直接视觉参考。
  - **面板化的功能分区**：调色轮、节点编辑器、时间轴都是独立可调整的面板——对应 AdFrame 四区布局的设计语言。
  - **工作区切换（Cut/Edit/Color/Fairlight/Deliver）**：按工作流阶段切换整体界面布局——对应 AdFrame "评测模式"与"导出模式"的切换概念。
  - **最小化的 chrome**：工具栏、菜单尽量收窄，给内容最大面积——指导 AdFrame 的 Header 和区域边界设计。
- **不可照搬**：
  - DaVinci Resolve 是桌面原生应用，界面密度和功能复杂度远超 Web 前端 demo。
  - 核心是实时视频处理管线，AdFrame 不需要任何视频处理能力。
  - 学习曲线极高，其交互哲学不适用于 portfolio demo 场景（需要一目了然）。
- **对应 AdFrame 区域**：全部（视觉气质参考，而非功能参考）

---

## 总结：参考价值排序

| 优先级 | 参考 | 核心贡献 |
|--------|------|---------|
| P0 | Frame.io V4 | 视频审阅工作台布局（panel-based）、帧级标注交互、暗色 UI 气质 |
| P0 | Dropbox Replay | 轻量审阅流程、版本对比、评论区展开/收起交互 |
| P0 | Runway | AI+人工协同工作台的 UI 模式、左侧工具面板+资产库 |
| P1 | Linear | 暗色工具型产品的设计系统（LCH 色彩、视觉层级、dimmed sidebar） |
| P1 | Label Studio | 三栏标注界面、任务锁定、LLM 评估模板设计 |
| P1 | CVAT | 视觉数据工作台布局（Header+面板+工作区+控件栏+属性栏） |
| P1 | FiftyOne | 可组合面板架构（Spaces）、自定义 Dashboard |
| P1 | W&B Evaluations | 结构化评测体系（Dataset+Scorers）、并排对比、溯源 |
| P2 | Notion | 三栏信息架构通用模式 |
| P2 | DaVinci Resolve | 暗色专业工作台视觉气质 |
