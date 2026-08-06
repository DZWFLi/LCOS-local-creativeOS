export function humanizeRuntimeMessage(message?: string | null): string {
  if (!message) return ''
  const value = String(message)
  if (/authorization|token|401/i.test(value)) return '本地项目服务需要重新连接，请重启 LCOS 后再试。'
  if (/offline|unavailable|ECONNREFUSED|fetch failed|Local Core|Bridge disconnected/i.test(value)) return '本地 Agent 服务暂时不可用，你的内容已保留，可以稍后重新连接。'
  if (/timeout|timed out/i.test(value)) return '本地 Agent 响应较慢，本次操作没有完成，可以重新尝试。'
  if (/stale|version|conflict|409/i.test(value)) return '内容已在其他位置发生变化，请刷新后再试。'
  if (/cancel/i.test(value)) return '任务已撤回或正在撤回，迟到结果不会替换当前版本。'
  return value
}
