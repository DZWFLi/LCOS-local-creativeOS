/**
 * 统一键位表（第一梯队 ⑤ 起步）：先把命令面板的键位收进来，
 * 后续全局键位（Ctrl+F / Ctrl+A / Ctrl+Z / …）逐步迁入同一张表，
 * 避免 keydown handler 里散落魔法字符串。
 * 只放常量；键位语义（移动/执行/关闭）的纯函数在 CommandPalette.tsx。
 */

/** 命令面板（⌘K / Ctrl+K 全局唤起）专用键位。 */
export const PALETTE_KEYS = {
  /** 唤起面板的主键（配合 meta/ctrl 修饰键；macOS ⌘K，其余 Ctrl+K）。 */
  open: 'k',
  /** 高亮上移（循环）。 */
  moveUp: 'ArrowUp',
  /** 高亮下移（循环）。 */
  moveDown: 'ArrowDown',
  /** 执行选中项并关闭。 */
  execute: 'Enter',
  /** 关闭面板。 */
  close: 'Escape',
} as const
