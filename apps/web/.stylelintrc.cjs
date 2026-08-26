/* ============================================================================
 * LCOS z-index 契约 stylelint 配置（源文件，随发布同步至 apps/web 根）
 * ----------------------------------------------------------------------------
 * 背景：LCOS 0.1 收口将 268 处散值 z-index 收敛为 7 层 token（共 52 个），
 * 定义见 src/foundation.css「z-index 7 层契约」（约 111-173 行）：
 *   主层 7 个：canvas-base(1) / canvas-content(2) / surface-comp(3) /
 *             overlay-ui(40) / shell-chrome(60) / dialog(100) / modal(200)
 *   桶内保序子层 45 个：content-*（9）/ surface-comp-selected（1）/
 *             overlay-ui-*（5）/ dialog-*（17）/ modal-*（13）
 *
 * 本配置锁死契约：z-index 声明只允许以下形式——
 *   1. var(--lcos-z-*)  —— 必须走 token（7 层主层 + 桶内保序子层）
 *   2. auto / inherit   —— 交由普通文档流 / 父级继承
 *   3. -1               —— legacy-bg 特例（porcelain 遗留背景层，
 *                          foundation.css 注释「按契约保留 -1」，
 *                          全仓唯一允许的裸数字值）
 * 其余任何裸数字（0、正数、-2 及以下）一律报错，防止散值回流。
 *
 * 实现说明：allowed-list 负责白名单放行；disallowed-list 用负向断言
 * (?!-1$) 排除 -1 特例后拦截全部裸数字，两条规则组合执行。
 * ========================================================================== */
module.exports = {
  rules: {
    /* z-index 值白名单：token 前缀 / auto / inherit / -1（legacy-bg 特例） */
    'declaration-property-value-allowed-list': {
      'z-index': ['auto', 'inherit', '-1', '/^var\\(--lcos-z-/'],
    },
    /* z-index 禁止裸数字：负向断言放行唯一的 legacy-bg 特例 -1 */
    'declaration-property-value-disallowed-list': {
      'z-index': ['/^(?!-1$)-?\\d+$/'],
    },
  },
};
