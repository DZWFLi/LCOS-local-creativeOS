/**
 * ChatGPT Web Chat provider adapter（用户主动触发才运行，G8/G10）。
 * 只读取当前可见对话的引用：标题、URL、页面上可见的文件/下载链接。
 * 任何解析失败都抛错 → 调用方回退普通 Page Capture（G9）。
 */
export function matches(url) {
  try {
    const host = new URL(url).hostname;
    return host === "chatgpt.com" || host.endsWith(".chatgpt.com") || host === "chat.openai.com";
  } catch {
    return false;
  }
}

export async function collectVisibleConversationRefs() {
  const url = window.location.href;
  const title = document.title || "ChatGPT 对话";
  const sourceRefs = [];
  const seen = new Set();

  // 页面内可见的文件/下载链接（只取用户当前对话里出现的）
  for (const anchor of document.querySelectorAll('a[href]')) {
    const href = anchor.href;
    const text = (anchor.textContent ?? "").trim();
    if (!href || seen.has(href)) continue;
    const looksLikeFile = /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv|zip|png|jpe?g|webp)(\?|#|$)/i.test(href);
    if (!looksLikeFile && !text) continue;
    seen.add(href);
    sourceRefs.push({
      sourceType: "url",
      sourceRef: href,
      label: text || href.split("/").pop(),
      observedAt: new Date().toISOString(),
    });
  }

  const conversationId = new URL(url).searchParams.get("t") ?? undefined;
  return {
    provider: "chatgpt",
    conversationUrl: url,
    conversationId,
    title,
    visibleRange: "current-tab",
    sourceRefs,
  };
}
