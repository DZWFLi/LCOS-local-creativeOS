"""
AI Bridge MCP Server (V3)
==========================
WorkBuddy ↔ Codex 双向通信桥接器 — V3 第一阶段

核心升级：
- Session Layer（sessions.json 持久化）
- 完整 Task 生命周期（created → queued → assigned → running → review → completed）
- 结构化 Artifact（artifacts.json）
- 兼容旧版 pending/completed 状态和纯路径 artifacts

启动方式：
  venv/Scripts/python bridge_server.py
"""

import json
import sys
from pathlib import Path
from typing import Optional

from mcp.server.fastmcp import FastMCP

# ---- V4: 接入 app/ 模块 ----
_APP_DIR = Path(__file__).parent / "app"
if str(_APP_DIR.parent) not in sys.path:
    sys.path.insert(0, str(_APP_DIR.parent))

from app.validators import (
    v3_status as _v3_status,
    normalize_assignee as _normalize_assignee,
    validate_changed_files as _validate_changed_files,
    validate_report_mode as _validate_report_mode,
    _V3_STATES, _WB_CAN_SET, _CODEX_CAN_SET,
)
from app.legacy.compat import normalize_submit_status
from app.runtime.storage import get_default_storage as _get_default_storage
from app.repositories.capabilities import CapabilityRepository
from app.repositories.artifacts import ArtifactRepository
from app.repositories.messages import MessageRepository
from app.repositories.metrics import MetricRepository
from app.repositories.sessions import SessionRepository
from app.repositories.tasks import TaskRepository
from app.services.capabilities import CapabilityService
from app.services.artifacts import ArtifactService
from app.services.messages import MessageService
from app.services.metrics import MetricService
from app.services.results import ResultService
from app.services.sessions import SessionService
from app.services.tasks import TaskService
from app.errors import BridgeContractError

CAPABILITY_REGISTRY_FILE = Path(__file__).with_name("capability_registry.example.json")
_RUNTIME_STORAGE = _get_default_storage()

_REPORT_MODES = {"full", "short", "silent"}
_MESSAGE_REPO = MessageRepository(_RUNTIME_STORAGE)
_TASK_REPO = TaskRepository(_RUNTIME_STORAGE)
_ARTIFACT_REPO = ArtifactRepository(_RUNTIME_STORAGE)
_SESSION_REPO = SessionRepository(_RUNTIME_STORAGE)
_CAPABILITY_REPO = CapabilityRepository(_RUNTIME_STORAGE, CAPABILITY_REGISTRY_FILE)
_METRIC_REPO = MetricRepository(_RUNTIME_STORAGE)
_CAPABILITIES = CapabilityService(_RUNTIME_STORAGE, CAPABILITY_REGISTRY_FILE, _CAPABILITY_REPO)
_SESSIONS = SessionService(_RUNTIME_STORAGE, _SESSION_REPO)
_MESSAGES = MessageService(_RUNTIME_STORAGE, _MESSAGE_REPO)
_ARTIFACTS = ArtifactService(_RUNTIME_STORAGE, _ARTIFACT_REPO)
_METRICS = MetricService(_METRIC_REPO)
_TASKS = TaskService(_RUNTIME_STORAGE, _SESSIONS, _CAPABILITIES, _TASK_REPO, _MESSAGE_REPO, _METRICS)
_RESULTS = ResultService(_RUNTIME_STORAGE, _SESSIONS, _ARTIFACTS, _TASK_REPO, _MESSAGE_REPO, _METRICS)


# Compatibility hooks kept for watcher / local scripts.
def _now() -> str:
    return _RUNTIME_STORAGE.now()


def _get_messages():
    return _MESSAGE_REPO.load_messages()


def _save_messages(data: dict) -> None:
    _MESSAGE_REPO.save_messages(data)


def _get_conversations():
    return _MESSAGE_REPO.load_conversations()


def _save_conversations(data: dict) -> None:
    _MESSAGE_REPO.save_conversations(data)


def _get_tasks():
    return _TASK_REPO.load_all()


def _save_tasks(data: dict) -> None:
    _TASK_REPO.save_all(data)


def _get_sessions():
    return _SESSION_REPO.load_all()


def _save_sessions(data: dict) -> None:
    _SESSION_REPO.save_all(data)


def _get_artifacts():
    return _ARTIFACT_REPO.load_all()


def _save_artifacts(data: dict) -> None:
    _ARTIFACT_REPO.save_all(data)


def _get_capability_registry() -> dict:
    return _CAPABILITIES.get_registry()

def _resolve_report_mode(value: str, capability: str) -> str:
    if value:
        return _validate_report_mode(value.strip().lower())
    return _CAPABILITIES.default_report_mode(capability)


# ============================================================
# MCP Server
# ============================================================

mcp = FastMCP("AI Bridge")


# ============================================================
# 消息工具（不变，函数已从 app.storage 导入）
# ============================================================


@mcp.tool(
    name="send_message",
    description="向目标 AI（codex 或 workbuddy）发送一条消息，返回 conversation_id",
)
def send_message(
    target: str,
    message: str,
    sender: str = "workbuddy",
) -> str:
    target = target.lower().strip()
    try:
        conv_id = _MESSAGES.send_message(target=target, message=message, sender=sender)
        return f"✅ 消息已发送，对话ID: {conv_id}"
    except ValueError as e:
        return f"❌ {e}"


@mcp.tool(
    name="respond",
    description="回复指定 conversation_id 的对话，结果会送回发起方",
)
def respond(conversation_id: str, response: str, sender: str = "workbuddy") -> str:
    try:
        _MESSAGES.respond(conversation_id=conversation_id, response=response, sender=sender)
        return f"✅ 已回复对话 {conversation_id}"
    except ValueError as e:
        return f"❌ {e}"
    except KeyError:
        return f"❌ 未找到对话: {conversation_id}"


@mcp.tool(
    name="get_messages",
    description="查看发给自己的待处理消息列表（获取后不清除，避免丢失）",
)
def get_messages(target: str) -> str:
    try:
        pending = _MESSAGES.get_messages(target=target)
    except ValueError as e:
        return f"❌ {e}"
    if not pending:
        return "📭 暂无新消息"
    result = []
    for m in pending:
        if m["type"] == "new":
            result.append(f"📩 [新对话 {m['conversation_id']}] 来自 {m['from']}: {m['message']}")
        elif m["type"] == "reply":
            result.append(f"💬 [回复 {m['conversation_id']}] 来自 {m['from']}: {m['message']}")
    return "\n---\n".join(result)


@mcp.tool(
    name="ack_messages",
    description="确认已读并清除指定对话的消息通知",
)
def ack_messages(target: str, conversation_id: Optional[str] = None) -> str:
    try:
        cleared = _MESSAGES.ack_messages(target=target, conversation_id=conversation_id)
    except ValueError as e:
        return f"❌ {e}"
    if conversation_id:
        return f"✅ 已清除 {cleared} 条对话 {conversation_id} 的通知"
    return f"✅ 已清除全部 {cleared} 条未读消息"


@mcp.tool(
    name="get_conversation",
    description="查看指定对话的完整历史",
)
def get_conversation(conversation_id: str) -> str:
    conversation = _MESSAGES.get_conversation(conversation_id)
    if not conversation:
        return f"❌ 未找到对话: {conversation_id}"
    return json.dumps(conversation, ensure_ascii=False, indent=2)


@mcp.tool(
    name="list_conversations",
    description="列出所有活跃对话",
)
def list_conversations(target: Optional[str] = None, status: str = "open") -> str:
    conversations = _MESSAGES.list_conversations(target=target, status=status)
    result = []
    for cid, c in conversations:
        result.append(f"  [{cid}] {c['title']} ({c['from']}→{c['to']}, {c['updated_at']})")
    if not result:
        return "📭 暂无活跃对话"
    return "活跃对话：\n" + "\n".join(result)


@mcp.tool(
    name="close_conversation",
    description="关闭指定对话（标记为已完成）",
)
def close_conversation(conversation_id: str) -> str:
    if not _MESSAGES.close_conversation(conversation_id):
        return f"❌ 未找到对话: {conversation_id}"
    return f"✅ 对话 {conversation_id} 已关闭"


# ============================================================
# Session Layer
# ============================================================


@mcp.tool(
    name="create_session",
    description="创建一个执行 Session，用于绑定 Project 与长期 Conversation",
)
def create_session(
    project_id: str,
    agent: str = "workbuddy",
    inbox_dir: str = "",
) -> str:
    session = _SESSIONS.create_session(project_id=project_id, agent=agent, inbox_dir=inbox_dir)
    return json.dumps(session, ensure_ascii=False, indent=2)


@mcp.tool(
    name="get_session",
    description="查看指定 Session 详情",
)
def get_session(session_id: str) -> str:
    session = _SESSIONS.get_session(session_id)
    if not session:
        return f"❌ 未找到 Session: {session_id}"
    return json.dumps(session, ensure_ascii=False, indent=2)


@mcp.tool(
    name="list_sessions",
    description="列出所有 Session，可按 project_id 和 status 筛选",
)
def list_sessions(project_id: Optional[str] = None, status: str = "active") -> str:
    result = _SESSIONS.list_sessions(project_id=project_id, status=status)
    if not result:
        return "📭 暂无匹配 Session"
    return json.dumps(result, ensure_ascii=False, indent=2)


@mcp.tool(
    name="update_session_heartbeat",
    description="更新 Session 的心跳时间",
)
def update_session_heartbeat(session_id: str) -> str:
    if _SESSIONS.update_heartbeat(session_id):
        return f"✅ Session {session_id} 心跳已更新"
    return f"❌ 未找到 Session: {session_id}"


# ============================================================
# Artifact Layer
# ============================================================


@mcp.tool(
    name="get_capability_registry",
    description="读取当前 Agent Capability Registry",
)
def get_capability_registry() -> str:
    return json.dumps(_get_capability_registry(), ensure_ascii=False, indent=2)


@mcp.tool(
    name="get_artifacts_by_task",
    description="按 task_id 获取关联的结构化产物列表",
)
def get_artifacts_by_task(task_id: str) -> str:
    matched = _ARTIFACTS.list_artifacts(task_id)
    if not matched:
        return "📭 该任务暂无产物"
    return json.dumps(matched, ensure_ascii=False, indent=2)


# ============================================================
# Task Layer（V3）
# ============================================================


@mcp.tool(
    name="create_task",
    description="创建任务（V3）。支持 session_id / capability / context / acceptance_criteria 等新字段，兼容旧参数。",
)
def create_task(
    instruction: str,
    assignee: str = "workbuddy",
    task_type: str = "general",
    project_id: str = "default",
    expected_outputs: str = "[]",
    input_files: str = "[]",
    # V3 新增参数（可选）
    session_id: str = "",
    capability: str = "",
    acceptance_criteria: str = "[]",
    context: str = "{}",
    priority: str = "normal",
    timeout_seconds: int = 0,
    report_mode: str = "",
    contract_version: str = "",
    lcos_run_id: str = "",
    idempotency_key: str = "",
    request_fingerprint: str = "",
    runtime_input_pack_path: str = "",
) -> str:
    try:
        task = _TASKS.create_task(
            instruction=instruction,
            assignee=assignee,
            task_type=task_type,
            project_id=project_id,
            expected_outputs=expected_outputs,
            input_files=input_files,
            session_id=session_id,
            capability=capability,
            acceptance_criteria=acceptance_criteria,
            context=context,
            priority=priority,
            timeout_seconds=timeout_seconds,
            report_mode=report_mode,
            validate_report_mode=_validate_report_mode,
            contract_version=contract_version,
            lcos_run_id=lcos_run_id,
            idempotency_key=idempotency_key,
            request_fingerprint=request_fingerprint,
            runtime_input_pack_path=runtime_input_pack_path,
        )
    except json.JSONDecodeError:
        return "❌ JSON 参数格式错误"
    except ValueError as e:
        return f"❌ {e}"
    except BridgeContractError as error:
        return json.dumps(error.to_dict(), ensure_ascii=False, indent=2)
    resolved_report_mode = task.get("report_mode")
    if resolved_report_mode not in _REPORT_MODES:
        return f"❌ report_mode 无效: {resolved_report_mode}"

    if lcos_run_id:
        replayed = bool(task.pop("replayed", False))
        return json.dumps(
            {"ok": True, "task": task, "replayed": replayed},
            ensure_ascii=False,
            indent=2,
        )
    return json.dumps(task, ensure_ascii=False, indent=2)


@mcp.tool(
    name="get_task_by_lcos_run_id",
    description="按 Canonical LCOS Run ID 恢复查询唯一的 Bridge Task，不创建新任务。",
)
def get_task_by_lcos_run_id(lcos_run_id: str) -> str:
    try:
        task = _TASKS.get_task_by_lcos_run_id(lcos_run_id)
        if task is None:
            raise BridgeContractError(
                "TASK_NOT_FOUND",
                "No Bridge Task is bound to the LCOS Run.",
                http_status=404,
            )
        return json.dumps({"ok": True, "task": task}, ensure_ascii=False, indent=2)
    except BridgeContractError as error:
        return json.dumps(error.to_dict(), ensure_ascii=False, indent=2)


@mcp.tool(
    name="get_pending_tasks",
    description="查看指定 assignee 的待处理任务（V3：assigned/queued/created 状态均视为待处理）",
)
def get_pending_tasks(assignee: str) -> str:
    try:
        tasks = _TASKS.get_pending_tasks(assignee)
    except ValueError as e:
        return f"❌ {e}"
    if not tasks:
        return "📭 暂无待处理任务"
    return json.dumps(tasks, ensure_ascii=False, indent=2)


@mcp.tool(
    name="get_tasks_by_status",
    description="按状态查询任务。status 可以是 V3 状态值（created/queued/assigned/running/review/completed/failed/timeout/retrying/cancelled）",
)
def get_tasks_by_status(assignee: str, status: str) -> str:
    status = status.lower().strip()
    if status not in _V3_STATES:
        return f"❌ 无效状态: {status}，有效值: {', '.join(sorted(_V3_STATES))}"
    try:
        tasks = _TASKS.get_tasks_by_status(assignee, status)
    except ValueError as e:
        return f"❌ {e}"
    if not tasks:
        return f"📭 暂无 {status} 状态的任务"
    return json.dumps(tasks, ensure_ascii=False, indent=2)


@mcp.tool(
    name="claim_task",
    description="认领待处理任务。V3：将状态从 created/queued 推进到 assigned。兼容旧版 pending。",
)
def claim_task(task_id: str, assignee: str) -> str:
    try:
        return json.dumps(_TASKS.claim_task(task_id, assignee), ensure_ascii=False, indent=2)
    except ValueError as e:
        return f"❌ {e}"
    except KeyError:
        return f"❌ 未找到任务: {task_id}"


@mcp.tool(
    name="start_task",
    description="标记任务开始执行。将 assigned → running。",
)
def start_task(task_id: str, assignee: str) -> str:
    try:
        return json.dumps(_TASKS.start_task(task_id, assignee), ensure_ascii=False, indent=2)
    except ValueError as e:
        return f"❌ {e}"
    except KeyError:
        return f"❌ 未找到任务: {task_id}"


@mcp.tool(
    name="cancel_task",
    description="取消任务。created/queued 任务会立即取消；assigned/running 任务会记录协作式取消请求。",
)
def cancel_task(task_id: str, reason: str = "") -> str:
    try:
        return json.dumps(
            _TASKS.cancel_task(task_id=task_id, reason=reason.strip() or "未说明原因"),
            ensure_ascii=False,
            indent=2,
        )
    except ValueError as e:
        return f"❌ {e}"
    except KeyError:
        return f"❌ 未找到任务: {task_id}"


@mcp.tool(
    name="supersede_task",
    description="用新任务取代旧任务。未开始旧任务会取消；已执行旧任务只记录协作式取消请求与关联。",
)
def supersede_task(old_task_id: str, new_task_id: str, reason: str = "") -> str:
    try:
        return json.dumps(
            _TASKS.supersede_task(
                old_task_id=old_task_id,
                new_task_id=new_task_id,
                reason=reason.strip() or "被后续任务取代",
            ),
            ensure_ascii=False,
            indent=2,
        )
    except ValueError as e:
        return f"❌ {e}"
    except KeyError as e:
        return f"❌ 未找到任务: {e.args[0]}"


@mcp.tool(
    name="submit_result",
    description="提交任务结果。V3：默认进入 review 状态，支持结构化 artifacts，兼容旧版路径数组。status 可选 review/failed/timeout。",
)
def submit_result(
    task_id: str,
    assignee: str,
    result_summary: str,
    artifacts: str = "[]",
    status: str = "review",
    session_id: str = "",
    short_summary: str = "",
    changed_files: str = "[]",
    milestone_report_path: str = "",
) -> str:
    try:
        assignee = _normalize_assignee(assignee)
    except ValueError as e:
        return f"❌ {e}"

    # 解析 artifacts
    try:
        raw_artifacts = json.loads(artifacts) if artifacts else []
        raw_changed_files = json.loads(changed_files) if changed_files else []
        if not isinstance(raw_artifacts, list):
            return "❌ artifacts 必须是 JSON 数组"
    except json.JSONDecodeError:
        return "❌ artifacts / changed_files 必须是合法 JSON 数组字符串"

    status_normalized, is_v2_compat = normalize_submit_status(status)

    if status_normalized not in _WB_CAN_SET:
        return f"❌ WorkBuddy 只能回传 review/failed/timeout，收到: {status_normalized}"
    structured, artifact_error = _ARTIFACTS.validate_artifacts(raw_artifacts)
    if artifact_error:
        return f"❌ {artifact_error}"
    normalized_changed_files, changed_error = _validate_changed_files(raw_changed_files)
    if changed_error:
        return f"❌ {changed_error}"
    task = _TASKS.get_task(task_id)
    if not task:
        return f"❌ 未找到任务: {task_id}"
    report_mode = _resolve_report_mode(task.get("report_mode", ""), task.get("capability"))
    try:
        result = _RESULTS.submit_result(
            task_id=task_id,
            assignee=assignee,
            result_summary=result_summary,
            status_normalized=status_normalized,
            session_id=session_id,
            short_summary=short_summary,
            normalized_changed_files=normalized_changed_files,
            structured_artifacts=structured,
            milestone_report_path=milestone_report_path,
            report_mode=report_mode,
            is_v2_compat=is_v2_compat,
        )
        return json.dumps(result, ensure_ascii=False, indent=2)
    except ValueError as e:
        return f"❌ {e}"
    except KeyError:
        return f"❌ 未找到任务: {task_id}"


@mcp.tool(
    name="finalize_task_review",
    description="【Codex 专用】验收任务：将 review 状态推进到 completed 或 retrying",
)
def finalize_task_review(
    task_id: str,
    reviewer: str = "codex",
    decision: str = "completed",
    review_comment: str = "",
) -> str:
    reviewer = reviewer.lower().strip()
    if reviewer != "codex":
        return "❌ 仅 Codex 可执行最终验收"
    decision = decision.lower().strip()
    try:
        return json.dumps(
            _RESULTS.finalize_review(task_id=task_id, decision=decision, review_comment=review_comment),
            ensure_ascii=False,
            indent=2,
        )
    except ValueError as e:
        return f"❌ {e}"
    except KeyError:
        return f"❌ 未找到任务: {task_id}"


@mcp.tool(
    name="get_task_status",
    description="查看任务状态详情（V3 升级版，自动兼容旧任务字段）",
)
def get_task_status(task_id: str) -> str:
    task = _TASKS.get_task_status(task_id)
    if task:
        return json.dumps(task, ensure_ascii=False, indent=2)
    return f"❌ 未找到任务: {task_id}"


@mcp.tool(
    name="health_check",
    description="查看当前 AI Bridge runtime 健康状态",
)
def health_check() -> str:
    from app.services.health import HealthService

    service = HealthService(
        _RUNTIME_STORAGE,
        _MESSAGE_REPO,
        _TASK_REPO,
        _SESSION_REPO,
        _ARTIFACT_REPO,
        _METRIC_REPO,
    )
    return json.dumps(service.check(), ensure_ascii=False, indent=2)


# ============================================================
# 启动
# ============================================================

if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="AI Bridge MCP Server (V3)")
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        choices=["127.0.0.1"],
        help="监听地址（提纯基线仅允许 loopback）",
    )
    parser.add_argument("--port", type=int, default=8920, help="监听端口")
    args = parser.parse_args()

    app = mcp.streamable_http_app()

    print(f"🤖 AI Bridge MCP Server V3 启动中...")
    print("   存储目录: configured (path redacted)")
    print()
    print(f"🌐 HTTP 端点: http://{args.host}:{args.port}/mcp")
    print()
    print("═══════════════════════════════════════════")
    print("  ▸ V3 新增工具:")
    print("     create_session(project_id, agent?, inbox_dir?)")
    print("     get_session(session_id)")
    print("     list_sessions(project_id?, status?)")
    print("     update_session_heartbeat(session_id)")
    print("     get_artifacts_by_task(task_id)")
    print("     get_tasks_by_status(assignee, status)")
    print("     start_task(task_id, assignee)")
    print("     finalize_task_review(task_id, reviewer, decision, review_comment?)")
    print()
    print("  ▸ V3 升级工具:")
    print("     create_task(..., session_id?, capability?, acceptance_criteria?, context?, priority?)")
    print("     claim_task(task_id, assignee)  → assigned")
    print("     submit_result(..., status=review/failed/timeout, session_id?)")
    print()
    print("  ▸ 状态流: created → queued → assigned → running → review → completed")
    print("  ▸ 异常态: failed / timeout / retrying / cancelled")
    print("═══════════════════════════════════════════")
    print()

    uvicorn.run(app, host=args.host, port=args.port)
