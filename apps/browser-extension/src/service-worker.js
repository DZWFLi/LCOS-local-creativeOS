/**
 * LCOS Capture service worker（MV3）：
 * 右键菜单（网页/图片/链接/选中文字）+ 快捷键（Alt+Shift+S 收当前页）。
 * 第一版不申请 <all_urls>、不做 webRequest 全局监听。
 */
import { captureRequest, sendCapture } from "./capture-client.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "lcos-page",
    title: "保存当前页面到 LCOS",
    contexts: ["page"],
  });
  chrome.contextMenus.create({
    id: "lcos-image",
    title: "保存图片到 LCOS",
    contexts: ["image"],
  });
  chrome.contextMenus.create({
    id: "lcos-link",
    title: "保存链接到 LCOS",
    contexts: ["link"],
  });
chrome.contextMenus.create({
    id: "lcos-selection",
    title: "保存选中文字到 LCOS",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "lcos-conversation",
    title: "收集当前 Web Chat 对话引用到 LCOS",
    contexts: ["page"],
  });
});

async function notify(message, error = false) {
  await chrome.notifications?.create?.({
    type: "basic",
    title: error ? "LCOS Capture 失败" : "LCOS Capture",
    message,
  });
}

async function captureFromTab(tab, kind, payload, hints = {}) {
  try {
    const receipt = await sendCapture(captureRequest({ kind, tab, payload, hints }));
    const label = receipt.status === "staged"
      ? "已收下，稍后整理（未归项目）"
      : receipt.status === "reused"
        ? "已存在，未重复导入"
        : "已收进项目";
    await notify(`${label}${receipt.projectId ? "" : ""}`);
  } catch (error) {
    await notify(error.message, true);
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "lcos-page") {
    await captureFromTab(tab, "web_page", { type: "url", url: info.pageUrl });
  } else if (info.menuItemId === "lcos-image") {
    await captureFromTab(tab, "web_image", { type: "url", url: info.srcUrl });
  } else if (info.menuItemId === "lcos-link") {
    await captureFromTab(tab, "web_link", { type: "url", url: info.linkUrl });
  } else if (info.menuItemId === "lcos-selection") {
    await captureFromTab(tab, "web_selection", { type: "text", text: info.selectionText });
  } else if (info.menuItemId === "lcos-conversation") {
    try {
      const { matches, collectVisibleConversationRefs } = await import("./providers/chatgpt.js");
      if (!matches(info.pageUrl)) throw new Error("当前页面不是支持的 Web Chat 提供方，已回退普通页面捕获");
      const [{ result: snapshot }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 在页面上下文执行 adapter 的收集逻辑
          const url = window.location.href;
          const sourceRefs = [];
          for (const anchor of document.querySelectorAll("a[href]")) {
            const href = anchor.href;
            const text = (anchor.textContent ?? "").trim();
            if (!href) continue;
            const looksLikeFile = /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv|zip|png|jpe?g|webp)(\?|#|$)/i.test(href);
            if (!looksLikeFile && !text) continue;
            sourceRefs.push({ sourceType: "url", sourceRef: href, label: text || href.split("/").pop(), observedAt: new Date().toISOString() });
          }
          return {
            provider: "chatgpt",
            conversationUrl: url,
            conversationId: new URL(url).searchParams.get("t") ?? undefined,
            title: document.title || "ChatGPT 对话",
            visibleRange: "current-tab",
            sourceRefs,
          };
        },
      });
      const payload = {
        schemaVersion: 0,
        operationId: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: "conversation_snapshot",
        source: { app: "lcos-browser-extension", url: snapshot.conversationUrl, title: snapshot.title, capturedAt: new Date().toISOString(), ...(tab.id !== undefined ? { browserProfileId: "default", browserTabId: tab.id } : {}) },
        payload: { type: "text", text: JSON.stringify(snapshot, null, 2) },
        hints: { title: `对话引用：${snapshot.title}` },
      };
      const receipt = await sendCapture(payload);
      await notify(receipt.status === "staged" ? "对话引用已收下，稍后整理" : "对话引用已收进项目");
    } catch (error) {
      // G9: provider 解析失败 → 回退普通页面捕获，不拖垮扩展
      await captureFromTab(tab, "web_page", { type: "url", url: info.pageUrl }, { title: tab.title });
    }
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-current-page") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  await captureFromTab(tab, "web_page", { type: "url", url: tab.url }, { title: tab.title });
});
