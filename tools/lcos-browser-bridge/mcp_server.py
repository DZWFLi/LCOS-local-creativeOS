# -*- coding: utf-8 -*-
"""LCOS browser-harness MCP 桥 server（stdio transport）。

把 browser-harness CLI（CDP 浏览器控制 harness）的能力包装成 MCP tools，
供 provider agent（Codex CLI 等）通过 stdio MCP 调用。

提供的 tools：
  - browser_exec(code) ：把 code 从 stdin 喂给 `browser-harness` 子进程执行，
    等价于 shell 里的 `browser-harness <<'PY' ... PY`。helpers 预导入、exec 前
    ensure_daemon() 等都由上游 run.py 的既定流程完成。选择 subprocess 方案而
    不是在本进程 exec：用户代码死循环/崩溃只会死掉一次性子进程，MCP server
    本体不受影响，超时也可以直接 kill。
  - browser_doctor()   ：跑 `browser-harness --doctor`，返回诊断文本（排障用）。

关键约束：stdio MCP 的 stdout 是 JSON-RPC 协议通道（每行一条 JSON），
本进程绝不能往 stdout 打印任何东西；所有日志写入同目录 mcp_server.log。

启动：python tools/lcos-browser-bridge/mcp_server.py
"""

import logging
import os
import shutil
import subprocess
import sys

from mcp.server.mcpserver import MCPServer

# ---------------------------------------------------------------------------
# 常量与日志
# ---------------------------------------------------------------------------

_HERE = os.path.dirname(os.path.abspath(__file__))
_LOG_PATH = os.path.join(_HERE, "mcp_server.log")

EXEC_TIMEOUT_SECONDS = 60      # browser_exec 用户代码超时（防死循环）
DOCTOR_TIMEOUT_SECONDS = 120   # doctor 含 daemon/端口/网络探测，放宽一些
MAX_RESULT_CHARS = 50_000      # 单次返回给 agent 的文本上限，防止刷爆协议通道

# 日志只写文件，且要在 MCPServer 初始化前配好 root logger：
# 进程内任何日志都落文件而不是 stdout（stdout 被污染 = MCP 协议崩）。
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.FileHandler(_LOG_PATH, encoding="utf-8")],
)
logger = logging.getLogger("lcos-browser-bridge")

mcp = MCPServer(name="lcos-browser-bridge")


# ---------------------------------------------------------------------------
# browser-harness CLI 子进程封装
# ---------------------------------------------------------------------------

_HARNESS_CMD_CACHE = None


def _harness_command():
    """定位 browser-harness CLI 的命令行（list 形式，不含参数）。

    解析顺序（命中即止，结果缓存）：
      1. 当前解释器同级的 Scripts/browser-harness.exe —— pip 安装 CLI 的
         标准位置，不依赖 PATH（provider agent 拉起本 server 时 PATH 未必齐）；
      2. PATH 上的 browser-harness（shutil.which 会处理 Windows PATHEXT）；
      3. 兜底：用当前解释器直接调 browser_harness.run:main 入口。
    """
    global _HARNESS_CMD_CACHE
    if _HARNESS_CMD_CACHE is None:
        candidates = []
        exe = os.path.join(os.path.dirname(sys.executable), "Scripts", "browser-harness.exe")
        if os.path.isfile(exe):
            candidates.append([exe])
        found = shutil.which("browser-harness")
        if found:
            candidates.append([found])
        candidates.append([sys.executable, "-c", "from browser_harness.run import main; main()"])
        _HARNESS_CMD_CACHE = candidates[0]
        logger.info("browser-harness CLI 解析为 %r（候选依次: %r）", _HARNESS_CMD_CACHE, candidates)
    return _HARNESS_CMD_CACHE


def _clip(text, limit=MAX_RESULT_CHARS):
    """超长文本首尾各留一半，中间打截断标记。"""
    if len(text) <= limit:
        return text
    keep = limit // 2
    return (
        text[:keep]
        + f"\n...[输出过长：共 {len(text)} 字符，中间截断，保留首尾各 {keep} 字符]...\n"
        + text[-keep:]
    )


def _run_harness(args, stdin_text, timeout, label):
    """spawn browser-harness 子进程并收集结果（stdout/stderr/退出码/是否超时）。

    - stdin_text 按 UTF-8 写入子进程；上游 run.py 会把子进程 stdout/stderr
      重配成 UTF-8，这里再设 PYTHONIOENCODING/PYTHONUTF8 双保险，避免 GBK
      Windows 下中文输出乱码；
    - 超时只 kill 直接子进程；daemon 是独立常驻进程，不受影响；
    - 启动失败不抛异常，转成 stderr 文本返回给 agent（可再跑 browser_doctor 排障）。
    """
    cmd = _harness_command() + list(args)
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    payload = (stdin_text or "").encode("utf-8")
    logger.info("[%s] spawn %r (timeout=%ss, stdin=%dB)", label, cmd, timeout, len(payload))
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )
    except OSError as exc:
        logger.exception("[%s] 启动 browser-harness 失败", label)
        return {
            "exit_code": None,
            "stdout": "",
            "stderr": f"启动 browser-harness 失败：{exc!r}",
            "timed_out": False,
        }
    timed_out = False
    try:
        out_b, err_b = proc.communicate(input=payload, timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        logger.warning("[%s] 超时（%ss），kill 子进程 pid=%s", label, timeout, proc.pid)
        proc.kill()
        try:
            out_b, err_b = proc.communicate(timeout=15)
        except Exception:
            out_b, err_b = b"", b""
    stdout_text = out_b.decode("utf-8", errors="replace")
    stderr_text = err_b.decode("utf-8", errors="replace")
    logger.info(
        "[%s] 完成 exit=%s timed_out=%s stdout=%dB stderr=%dB",
        label, proc.returncode, timed_out, len(stdout_text), len(stderr_text),
    )
    return {
        "exit_code": proc.returncode,
        "stdout": stdout_text,
        "stderr": stderr_text,
        "timed_out": timed_out,
    }


def _format_result(res, label):
    """把子进程结果格式化为返回给 agent 的文本。"""
    lines = []
    if res["timed_out"]:
        lines.append(
            f"[lcos-browser-bridge] {label} 超过时限被强制结束"
            f"（只 kill 执行子进程，daemon 不受影响；请缩小任务后重试）。"
        )
    lines.append(f"exit_code: {res['exit_code']}")
    lines.append("--- stdout ---")
    lines.append(_clip(res["stdout"]).rstrip() or "(空)")
    lines.append("--- stderr ---")
    lines.append(_clip(res["stderr"]).rstrip() or "(空)")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# MCP tools
# ---------------------------------------------------------------------------


@mcp.tool()
def browser_exec(code: str) -> str:
    """在 browser-harness 的 helpers 环境中执行 Python 代码，控制真实浏览器（CDP）。

    等价于命令行 `browser-harness <<'PY' ... PY`：
    - helpers 已预导入：new_tab / page_info / ensure_real_tab / cdp() /
      goto / click / type_text 等（完整清单与用法见 browser-harness 的 SKILL.md）；
    - daemon 按需自动拉起（admin.ensure_daemon），浏览器连接沿用上游约定；
    - 用 print() 把结果打到 stdout，本 tool 返回 stdout / stderr / 退出码；
    - 超时 60 秒；代码崩溃只影响一次性子进程，MCP server 不受影响。

    Args:
        code: 要执行的 Python 源码，可多行。
    """
    res = _run_harness([], code, EXEC_TIMEOUT_SECONDS, label="browser_exec")
    return _format_result(res, "browser_exec")


@mcp.tool()
def browser_doctor() -> str:
    """运行 `browser-harness --doctor`，返回安装 / daemon / 浏览器连接的诊断文本。

    供 agent 排障：CLI 可用性、版本、daemon 存活、CDP 端口连通等。
    注意：daemon / browser FAIL 不一定是 MCP 桥的问题——浏览器连接由用户
    手动确认（gate），不在本 tool 的修复范围内。
    """
    res = _run_harness(["--doctor"], None, DOCTOR_TIMEOUT_SECONDS, label="browser_doctor")
    return _format_result(res, "browser_doctor")


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------


def main():
    logger.info(
        "=== lcos-browser-bridge MCP server 启动 (pid=%s, python=%s) ===",
        os.getpid(),
        sys.executable,
    )
    try:
        mcp.run()  # 默认 stdio transport：stdin/stdout 上逐行 JSON-RPC
    except Exception:
        logger.exception("MCP server 异常退出")
        raise


if __name__ == "__main__":
    main()
