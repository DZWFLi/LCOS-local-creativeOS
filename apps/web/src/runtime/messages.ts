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

/** RECEIVER-5（43O）：识别 provider 错误是否为「会话已失效」（Session with given id not found 一族）。
 *  匹配口径照 browser-harness daemon 的 stale 判定（"Session with given id not found"），
 *  外加本地 Core 的中英文表述。只做前端提示层判定，不触碰 lease/watchdog（那是 ProviderSessionBinding 的地盘）。 */
export function isReceiverSessionError(message?: string | null): boolean {
  if (!message) return false
  return /session with given id not found|session not found|session expired|conversation (?:not found|does not exist)|会话不存在|会话已失效|对话已失效/i.test(String(message))
}
