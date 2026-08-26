/** RECEIVER-2 相对时间：结构照抄 grok-bot sidebar 的四档（刚刚 / 分钟 / 小时 / 天）。
 *  纯函数（now 由调用方传入，可测）；中文档位文案与 LCOS UI 一致。 */
export function relativeTime(updatedAt: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000))
  if (seconds < 60) return '刚刚'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours} 小时前` : `${Math.round(hours / 24)} 天前`
}
