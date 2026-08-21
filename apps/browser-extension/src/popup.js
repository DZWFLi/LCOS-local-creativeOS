import { captureRequest, getExtensionToken, sendCapture, setExtensionToken } from "./capture-client.js";

const status = document.getElementById("status");

function show(message, ok = true) {
  status.textContent = message;
  status.className = `status ${ok ? "ok" : "err"}`;
}

document.getElementById("token").value = await getExtensionToken();

document.getElementById("save").addEventListener("click", async () => {
  const token = document.getElementById("token").value.trim();
  if (!token) { show("请输入配对码", false); return; }
  await setExtensionToken(token);
  show("配对码已保存");
});

document.getElementById("capture").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) { show("当前没有可保存的页面", false); return; }
  try {
    const receipt = await sendCapture(captureRequest({
      kind: "web_page",
      tab,
      payload: { type: "url", url: tab.url },
      hints: { title: tab.title },
    }));
    show(receipt.status === "staged" ? "已收下，稍后整理（未归项目）" : "已收进项目");
  } catch (error) {
    show(error.message, false);
  }
});
