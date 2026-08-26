# -*- coding: utf-8 -*-
"""lcos-browser-bridge MCP server 冒烟/回归测试。

spawn `python mcp_server.py` 子进程，通过 stdio 走一遍 MCP JSON-RPC 握手：

  1. initialize               -> 校验 serverInfo / protocolVersion
  2. notifications/initialized（通知，无响应）
  3. tools/list               -> 校验包含 browser_exec / browser_doctor
  4. tools/call browser_doctor -> 真实跑一次诊断，打印返回文本
  5. （可选，--exec 开关）tools/call browser_exec：真实执行一段代码。
     默认关闭——浏览器连接是用户手动确认的 gate，未确认前只会得到
     daemon FAIL，不算桥本身的问题。

用法：
  python _smoke_mcp.py [--exec]

本脚本自身不是 MCP server，可以随便 print 报告给人看。
任一断言失败时退出码为 1，全部通过为 0。
"""

import json
import os
import queue
import subprocess
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SERVER = os.path.join(HERE, "mcp_server.py")

STEP_TIMEOUT = 180  # 单步等待响应的超时（秒）；doctor 探测 daemon/浏览器/网络，放宽
PRINT_TEXT_LIMIT = 2000  # 打印 tool 返回文本的上限

# 收集 server stdout 上无法解析为 JSON 的行——stdio MCP 的 stdout 必须是
# 纯协议通道，出现任何非 JSON 行都算污染（协议崩坏的前兆）。
_bad_stdout_lines = []


def _spawn_server():
    return subprocess.Popen(
        [sys.executable, SERVER],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=HERE,
    )


def _start_pumps(proc):
    """后台线程持续泵 stdout/stderr，防止 server 写满管道缓冲区而卡死。"""
    lines = queue.Queue()
    stderr_buf = []

    def pump_stdout():
        try:
            for raw in proc.stdout:
                lines.put(("out", raw))
        finally:
            lines.put(("eof", None))

    def pump_stderr():
        for raw in proc.stderr:
            stderr_buf.append(raw.decode("utf-8", errors="replace"))

    threading.Thread(target=pump_stdout, daemon=True).start()
    threading.Thread(target=pump_stderr, daemon=True).start()
    return lines, stderr_buf


def _send(proc, obj):
    """向 server stdin 写一行 JSON-RPC 消息（newline-delimited JSON）。"""
    proc.stdin.write((json.dumps(obj) + "\n").encode("utf-8"))
    proc.stdin.flush()


def _recv(lines, want_id, timeout=STEP_TIMEOUT):
    """等到匹配 id 的 JSON-RPC 响应；顺带忽略通知等其他消息。"""
    deadline = time.monotonic() + timeout
    while True:
        left = deadline - time.monotonic()
        if left <= 0:
            raise TimeoutError(f"等待 id={want_id} 的响应超时（{timeout}s）")
        try:
            kind, raw = lines.get(timeout=left)
        except queue.Empty:
            continue
        if kind == "eof":
            raise EOFError("server 提前关闭了 stdout")
        line = raw.decode("utf-8", errors="replace").strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            _bad_stdout_lines.append(line)
            continue
        if msg.get("id") == want_id:
            return msg


def _tool_text(resp):
    """从 tools/call 响应里抽出 text 内容；带 JSON-RPC error 时一并标注。"""
    parts = []
    result = resp.get("result") or {}
    for item in result.get("content") or []:
        if item.get("type") == "text":
            parts.append(item.get("text", ""))
    if resp.get("error"):
        parts.append("JSON-RPC error: " + json.dumps(resp["error"], ensure_ascii=False))
    return "\n".join(parts)


def _print_text(prefix, text):
    show = text[:PRINT_TEXT_LIMIT]
    if len(text) > PRINT_TEXT_LIMIT:
        show += f"\n...(共 {len(text)} 字符，仅显示前 {PRINT_TEXT_LIMIT})"
    print(prefix)
    print(show)


def main():
    ok = True
    proc = _spawn_server()
    lines, stderr_buf = _start_pumps(proc)
    try:
        # 1) initialize 握手
        _send(proc, {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "smoke", "version": "0"},
            },
        })
        resp = _recv(lines, 1)
        result = resp.get("result") or {}
        print("[1] initialize ->", json.dumps({
            "protocolVersion": result.get("protocolVersion"),
            "serverInfo": result.get("serverInfo"),
        }, ensure_ascii=False))
        if not (result.get("serverInfo") or {}).get("name"):
            ok = False
            print("    !! 断言失败：initialize 结果里没有 serverInfo.name")

        # 2) initialized 通知（无响应）
        _send(proc, {"jsonrpc": "2.0", "method": "notifications/initialized"})

        # 3) tools/list
        _send(proc, {"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        resp = _recv(lines, 2)
        tools = (resp.get("result") or {}).get("tools") or []
        names = [t.get("name") for t in tools]
        print("[2] tools/list ->", names)
        for expect in ("browser_exec", "browser_doctor"):
            if expect not in names:
                ok = False
                print(f"    !! 断言失败：tools/list 缺少 {expect}")

        # 4) 真实调用一次 browser_doctor
        _send(proc, {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "browser_doctor", "arguments": {}},
        })
        resp = _recv(lines, 3)
        doctor_text = _tool_text(resp)
        if not doctor_text.strip():
            ok = False
            print("    !! 断言失败：browser_doctor 返回为空")
        _print_text("[3] tools/call browser_doctor ->", doctor_text)

        # 5) 可选：真实调用一次 browser_exec（浏览器连接是用户 gate，默认关）
        if "--exec" in sys.argv:
            _send(proc, {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "tools/call",
                "params": {
                    "name": "browser_exec",
                    "arguments": {"code": 'print("hello from browser_exec")\nprint(page_info())'},
                },
            })
            resp = _recv(lines, 4)
            _print_text("[4] tools/call browser_exec ->", _tool_text(resp))
    except (TimeoutError, EOFError) as exc:
        ok = False
        print("!! 冒烟失败：", exc)
    finally:
        try:
            proc.stdin.close()
        except Exception:
            pass
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=10)

    if _bad_stdout_lines:
        ok = False
        print("!! server stdout 出现非 JSON 行（协议通道被污染）：")
        for line in _bad_stdout_lines[:5]:
            print("   ", line[:200])

    stderr_text = "".join(stderr_buf).strip()
    if stderr_text:
        print("--- server stderr（尾部 800 字符，仅供排障参考）---")
        print(stderr_text[-800:])

    print("SMOKE:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
