# Glyph Micro Body v1

## 目标

修正旧 Glyph “中核像橄榄核、开壳过细”的识别问题，建立 LCOS Spatial Signal Language 的 Micro 尺度本体。

## 冻结结构

```text
22px presence
├─ 11px 圆角方形中核
├─ 两条竖向“眼睛”
└─ 上 / 右 / 下 / 左四段粗短悬浮开壳
```

Glyph 继续只是 living punctuation，不承担 Fence / Region / Edge / Surface，不拦截 pointer 和 drop。

## 语义姿态

- `stable`：低能量完整姿态。
- `focus`：中核微放大，开壳增强。
- `working`：蓝色能量，四段开壳顺序向外传递。
- `waiting`：右侧留口，表达等待外部输入。
- `blocked`：上下壳形成张力交叉，侧壳降低。
- `protected`：壳体收紧增强，表达冻结 / 保护。
- `candidate`：上、右开放，表达候选 / 未定。

## 边界

- 这是跨 Surface 共用的信号原子，不是把 Main / Context / Workflow 变成同一张画布。
- 三个 Surface 的差异由对象关系、Region、Path、Matrix 节奏表达。
- Reduced Motion 关闭持续动画，姿态与对比仍然可读。

## 验证

- Web typecheck：PASS。
- Foundation behavior：11/11 PASS。
- Spatial static gate：22/22 PASS。
- 真实浏览器核准：待本提交后用官方启动器拉起。

## 回滚

单独 revert 本批 commit；无 Schema / Project Truth 变更。
