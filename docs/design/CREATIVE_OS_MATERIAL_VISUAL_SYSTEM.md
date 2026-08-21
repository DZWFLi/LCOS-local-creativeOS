# Local Creative OS 材质与视觉系统

> 状态：Figma Make 高保真阶段冻结输入
> 原则：软瓷白结构 + 精密塑胶质感 + 少量液态铬金属交互件 + 克制分类环境色

## 1. 视觉判断

层级主要由材质、凹凸、留白和光泽承担，颜色只表达语义。目标是“精密创作设备”，不是彩色 SaaS 卡片，也不是全屏金属皮肤。

- 外层：柔和的一体成型设备面板；
- 卡槽：内阴影和边缘高光形成触感；
- 普通控件：安静、低对比；
- 关键操作：流动铬金属；
- 圆角：大但克制，不能成为幼儿园式胖卡片；
- 分类：低饱和环境色与边缘光；
- 当前激活：局部铬轮廓、反光或小型控制把手。

禁止把全部节点、边栏或整圈边框做成液态金属。

## 2. 基础 Token

```css
--text-primary: #192837;
--text-secondary: rgba(25, 40, 55, 0.58);
--text-tertiary: rgba(25, 40, 55, 0.36);

--app-bg: #ECEDEA;
--canvas-bg: #F5F5F2;
--surface-primary: #F8F8F5;
--surface-raised: #FFFFFF;
--surface-recessed: #ECEDEA;

--border-soft: rgba(25, 40, 55, 0.08);
--border-active: rgba(115, 66, 226, 0.32);

--accent: #7342E2;
--accent-soft: #EEE9FC;
--accent-glow: rgba(115, 66, 226, 0.18);
```

紫色是系统强调色，不是所有 CTA 和所有 AI 对象的通用填充色。文字使用深蓝灰而非纯黑。

字体：标题采用紧凑现代 Display 气质；正文使用 Inter，中文使用系统无衬线或 Noto Sans CJK SC。工程阶段必须确认商业字体授权。

## 3. Artifact 节点外壳

所有 Artifact 节点共用基础结构：

```css
background:
  linear-gradient(
    145deg,
    rgba(255,255,255,0.98),
    rgba(244,245,242,0.96)
  );

border: 1px solid rgba(25,40,55,0.08);
border-radius: 20px 24px;

box-shadow:
  0 18px 40px rgba(25,40,55,0.07),
  0 3px 8px rgba(25,40,55,0.04),
  inset 0 1px 0 rgba(255,255,255,0.95);
```

结构：

```text
┌─────────────────────────┐
│ [来源图标]       [?][状态] │
│                         │
│      文件缩略图内凹槽      │
│                         │
├─────────────────────────┤
│ 文件名                   │
│ 来源 / 极短状态           │
└─────────────────────────┘
```

缩略图槽：

```css
background: rgba(235,236,233,0.68);
box-shadow:
  inset 0 2px 7px rgba(25,40,55,0.06),
  inset 0 -1px 0 rgba(255,255,255,0.8);
```

分类色只出现于来源图标、顶部 2px 环境色、选中边缘柔光、状态小标签和关系线外侧辉光。节点正面不常驻页数、条数、时间、路径、关系数等详细元数据。

## 4. 液态铬金属

只用于：

1. 新建 Workspace `+`；
2. Run / Send 主按钮；
3. 当前激活节点的小型角标或控制把手；
4. Dock 当前 Workspace 的小型激活控制；
5. Inspector 最主要确认操作。

```css
background:
  radial-gradient(
    circle at 72% 18%,
    rgba(255,255,255,1) 0%,
    rgba(255,255,255,0.88) 12%,
    transparent 28%
  ),
  linear-gradient(
    135deg,
    #FDFDFD 0%,
    #AEB4BB 18%,
    #FFFFFF 36%,
    #737A82 50%,
    #F7F8F8 68%,
    #9AA1A8 82%,
    #FFFFFF 100%
  );
```

银白为主，局部深灰镜面反射，边缘只有极轻蓝、紫、暖橙虹彩。Hover 移动金属反射，不让整颗按钮发光；Press 轻微下沉并减弱阴影。禁止水波、霓虹脉冲和整圈金属节点边框。

## 5. 节点分类色

| 类型 | 主色 | 浅底 | 辉光 | 用途 |
| --- | --- | --- | --- | --- |
| Source / Original | `#698FC8` | `#EDF3FA` | `rgba(105,143,200,.18)` | 本地文件、飞书、网页、外部文档 |
| AI Generated / Derived | `#7342E2` | `#F0EBFC` | `rgba(115,66,226,.20)` | AI 新文件、修改版本、待确认 Artifact |
| Context / Reference | `#4F9B96` | `#EAF4F2` | `rgba(79,155,150,.17)` | 材料集合、Context Snapshot |
| Process / Run | `#77818B` | `#EEF0F1` | `rgba(119,129,139,.12)` | Run、Conversation、过程节点 |
| Decision / Locked | `#B7833E` | `#FAF1E5` | `rgba(183,131,62,.17)` | 人工判断、约束、Checkpoint |
| Waiting Input | `#C76D58` | `#F9ECE8` | 克制 | 只用于需要用户处理 |

平台差异使用图标，不为每个平台发明新颜色。Context 不使用 AI 紫色；Process 永远比文件节点低调；Decision 不使用警告黄。

## 6. Workspace 环境色

Workspace 色与节点分类是两个维度。Workspace 色只用于 Dock 激活、节点簇极浅环境光、银色关系线外辉光、小地图区域标记和标题小点。

| Workspace | 色值 |
| --- | --- |
| Understand | `#7194C8` |
| Explore | `#8B72D9` |
| Build | `#67A894` |
| Decide | `#B78A52` |
| Blank | `#8A9198` |

关系线主体保持银色，仅外侧辉光继承 Workspace 色。

## 7. Workspace Dock

Dock 是独立悬浮精密控制器，不是贴边导航栏。

- 收起宽 56px，展开约 216px；
- 距离左侧 16px，距离项目栏 16px；
- 圆角 24px；
- 瓷白半透明、浅银边、柔和漂浮阴影；
- 默认按钮无明显边框，Hover 才出现浅内凹；
- Active 使用局部铬滑块或小型外轮廓，不整项铺紫；
- 底部 `+` 使用液态铬。

`Source / Target / Review / Return` 作为可点击分类层收纳在左侧控制系统中，不作为 Canvas 固定列或区域标题。

## 8. Inspector

- 宽 400px；
- 四周外边距 12–16px，不贴边；
- 圆角 28px；
- 柔瓷白外壳和柔阴影；
- 内部模块使用浅内凹槽；
- 顶部 Relations / Preview / Context / Activity 使用内凹 Segmented Control，不使用传统下划线 Tab；
- 主要确认操作可使用液态铬，其余按钮保持柔白塑胶；
- Inspector 默认关闭，以单实例 Overlay 打开。

## 9. Mini-map

Mini-map 必须兼顾统一材质和真实导航价值：

- 整体瓷白圆角面板；
- 地图区域为浅内凹槽；
- 只显示节点簇、当前视口框、选中节点和待处理提示；
- 视口框可直接拖动并同步主 Canvas 相机；
- 点击区域可平滑定位；主 Canvas 变化反向同步；
- 缩放控制为 `− / 百分比 / +` 三段 Stepper；
- `+` 使用小型铬金属，`−` 为普通柔白，中间显示缩放百分比；
- 不显示文件名，不成为静态装饰缩略图。

## 10. 视觉验收底线

- 默认态第一眼看到文件内容、空间关系和当前目标，而不是控件；
- 材质比颜色承担更多层级；
- 同屏液态铬交互件数量克制；
- 任何整块彩色节点、全金属边栏、厚重阴影和高饱和虹彩均不通过；
- 圆角有精密塑胶感，不臃肿；
- 节点、Dock、Inspector、Mini-map 属于同一工业设计家族；
- 1366×768 下仍保留足够 Canvas，边栏覆盖而不挤压。
