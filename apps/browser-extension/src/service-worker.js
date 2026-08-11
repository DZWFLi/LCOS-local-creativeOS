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
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-current-page") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  await captureFromTab(tab, "web_page", { type: "url", url: tab.url }, { title: tab.title });
});
