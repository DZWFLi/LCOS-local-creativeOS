"""
AI Bridge — Task service
"""
from __future__ import annotations

import json
import threading
import uuid

from app.contracts import validate_task_envelope_v0
from app.errors import BridgeContractError
from app.models import upgrade_task
from app.repositories.messages import MessageRepository
from app.repositories.tasks import TaskRepository
from app.runtime.storage import RuntimeStorage
from app.schemas import new_task, new_task_assigned_message, new_task_created_message
from app.validators import normalize_assignee, v3_status, validate_json_payload_types
from app.services.capabilities import CapabilityService
from app.services.metrics import MetricService
from app.services.sessions import SessionService


class TaskService:
    def __init__(self, storage: RuntimeStorage, sessions: SessionService, capabilities: CapabilityService, repository: TaskRepository, message_repository: MessageRepository, metrics: MetricService | None = None):
        self.storage = storage
        self.sessions = sessions
        self.capabilities = capabilities
        self.repository = repository
        self.message_repository = message_repository
        self.metrics = metrics
        self._create_lock = threading.RLock()

    def resolve_report_mode(self, report_mode: str, capability: str, validate_report_mode) -> str:
        if report_mode:
            return validate_report_mode(report_mode.strip().lower())
        return self.capabilities.default_report_mode(capability)

    def create_task(
        self,
        *,
        instruction: str,
        assignee: str,
        task_type: str,
        project_id: str,
        expected_outputs: str,
        input_files: str,
        session_id: str,
        capability: str,
        acceptance_criteria: str,
        context: str,
        priority: str,
        timeout_seconds: int,
        report_mode: str,
        validate_report_mode,
        contract_version: str = "",
        lcos_run_id: str = "",
        idempotency_key: str = "",
        request_fingerprint: str = "",
        runtime_input_pack_path: str = "",
    ) -> dict:
        assignee = normalize_assignee(assignee)
        expected_outputs_list = json.loads(expected_outputs) if expected_outputs else []
        input_files_list = json.loads(input_files) if input_files else []
        acceptance_list = json.loads(acceptance_criteria) if acceptance_criteria else []
        context_dict = json.loads(context) if context else {}
        ok, error = validate_json_payload_types(expected_outputs_list, input_files_list, acceptance_list, context_dict)
        if not ok:
            raise ValueError(error)

        envelope = None
        if lcos_run_id or contract_version or idempotency_key or request_fingerprint or runtime_input_pack_path:
            envelope = validate_task_envelope_v0({
                "contractVersion": contract_version,
                "lcosRunId": lcos_run_id,
                "idempotencyKey": idempotency_key,
                "requestFingerprint": request_fingerprint,
                "provider": assignee,
                "taskType": task_type,
                "runtimeInputPackPath": runtime_input_pack_path,
                "expectedOutputs": expected_outputs_list,
                "timeoutSeconds": timeout_seconds,
                "reportMode": report_mode,
            })

        with self._create_lock:
            task_id = f"task_{uuid.uuid4().hex[:8]}"
            now = self.storage.now()
            resolved_session = (
                session_id.strip()
                if envelope
                else self.sessions.resolve_session(project_id, assignee, session_id)
            )
            resolved_capability = capability or task_type
            resolved_report_mode = self.resolve_report_mode(
                report_mode,
                resolved_capability,
                validate_report_mode,
            )
            if envelope:
                instruction = "Execute the immutable RuntimeInputPackV0."
                context_dict = {}
                acceptance_list = []
                input_files_list = [envelope["runtimeInputPackPath"]]
                expected_outputs_list = envelope["expectedOutputs"]
                resolved_capability = envelope["taskType"]
                resolved_report_mode = envelope["reportMode"]
                priority = "normal"
            task = new_task(
                task_id=task_id,
                project_id=project_id,
                session_id=resolved_session,
                assignee=assignee,
                task_type=task_type,
                capability=resolved_capability,
                report_mode=resolved_report_mode,
                instruction=instruction,
                context=context_dict,
                acceptance_criteria=acceptance_list,
                input_files=input_files_list,
                expected_outputs=expected_outputs_list,
                priority=priority if priority in ("low", "normal", "high", "urgent") else "normal",
                timeout_seconds=timeout_seconds if timeout_seconds > 0 else None,
                now=now,
                **({
                    "contract_version": envelope["contractVersion"],
                    "lcos_run_id": envelope["lcosRunId"],
                    "idempotency_key": envelope["idempotencyKey"],
                    "request_fingerprint": envelope["requestFingerprint"],
                    "runtime_input_pack_path": envelope["runtimeInputPackPath"],
                } if envelope else {}),
            )
            if envelope:
                persisted, replayed = self.repository.create_idempotent(task)
                result = dict(persisted)
                result["replayed"] = replayed
                if replayed:
                    return result
            else:
                with self.repository.mutation():
                    data = self.repository.load_all()
                    data.setdefault("tasks", []).append(task)
                    self.repository.save_all(data)

            self.sessions.touch_session(resolved_session, now)
            messages = self.message_repository.load_messages()
            messages.setdefault(assignee, []).append(
                new_task_created_message(
                    task_id=task_id,
                    project_id=project_id,
                    session_id=resolved_session,
                    task_type=task_type,
                    capability=resolved_capability,
                    report_mode=resolved_report_mode,
                    instruction=instruction,
                    timestamp=now,
                )
            )
            self.message_repository.save_messages(messages)
            if self.metrics:
                self.metrics.touch_task(task)
            result = dict(task)
            if envelope:
                result["replayed"] = False
            return result

    def get_task(self, task_id: str) -> dict | None:
        return self.repository.find_by_id(task_id)

    def get_task_status(self, task_id: str) -> dict | None:
        task = self.get_task(task_id)
        return upgrade_task(task) if task else None

    def get_task_by_lcos_run_id(self, lcos_run_id: str) -> dict | None:
        if not lcos_run_id.strip():
            raise BridgeContractError(
                "INVALID_TASK_ENVELOPE",
                "lcos_run_id must be a non-empty string.",
            )
        task = self.repository.find_by_lcos_run_id(lcos_run_id.strip())
        if task is None:
            return None
        return {
            "taskId": task["task_id"],
            "lcosRunId": task["lcos_run_id"],
            "status": v3_status(task.get("status")),
            "requestFingerprint": task["request_fingerprint"],
            "contractVersion": task["contract_version"],
            "createdAt": task["created_at"],
            "updatedAt": task["updated_at"],
        }

    def get_pending_tasks(self, assignee: str) -> list[dict]:
        assignee = normalize_assignee(assignee)
        pending_states = {"created", "queued", "assigned"}
        return [
            upgrade_task(task)
            for task in self.repository.load_all().get("tasks", [])
            if task.get("assignee") == assignee
            and v3_status(task.get("status")) in pending_states
            and not task.get("cancel_requested_at")
            and not task.get("superseded_by_task_id")
        ]

    def get_tasks_by_status(self, assignee: str, status: str) -> list[dict]:
        assignee = normalize_assignee(assignee)
        return [
            upgrade_task(task)
            for task in self.repository.load_all().get("tasks", [])
            if task.get("assignee") == assignee and v3_status(task.get("status")) == status
        ]

    def claim_task(self, task_id: str, assignee: str) -> dict:
        assignee = normalize_assignee(assignee)
        with self.repository.mutation():
            data = self.repository.load_all()
            now = self.storage.now()
            for task in data.get("tasks", []):
                if task.get("task_id") != task_id:
                    continue
                if task.get("assignee") != assignee:
                    raise ValueError("这个任务不是分配给你的")
                current = v3_status(task.get("status"))
                if current not in {"created", "queued"}:
                    raise ValueError(f"任务当前状态为 {current}，只能认领 created/queued 状态的任务")
                task["status"] = "assigned"
                task["assigned_at"] = now
                task["updated_at"] = now
                self.repository.save_all(data)
                self.sessions.touch_session(task.get("session_id"), now)
                messages = self.message_repository.load_messages()
                messages.setdefault("codex", []).append(
                    new_task_assigned_message(task_id=task_id, sender=assignee, timestamp=now)
                )
                self.message_repository.save_messages(messages)
                return upgrade_task(task)
        raise KeyError(task_id)

    def start_task(self, task_id: str, assignee: str) -> dict:
        assignee = normalize_assignee(assignee)
        with self.repository.mutation():
            data = self.repository.load_all()
            now = self.storage.now()
            for task in data.get("tasks", []):
                if task.get("task_id") != task_id:
                    continue
                if task.get("assignee") != assignee:
                    raise ValueError("这个任务不是分配给你的")
                current = v3_status(task.get("status"))
                if current != "assigned":
                    raise ValueError(f"任务当前状态为 {current}，只能从 assigned 开始执行")
                task["status"] = "running"
                task["started_at"] = now
                task["updated_at"] = now
                self.repository.save_all(data)
                self.sessions.touch_session(task.get("session_id"), now)
                return upgrade_task(task)
        raise KeyError(task_id)

    def _remove_task_created_messages(self, task_id: str) -> None:
        messages = self.message_repository.load_messages()
        for target, queue in messages.items():
            if isinstance(queue, list):
                messages[target] = [
                    message
                    for message in queue
                    if not (message.get("type") == "task_created" and message.get("task_id") == task_id)
                ]
        self.message_repository.save_messages(messages)

    def cancel_task(self, *, task_id: str, reason: str) -> dict:
        """Cancel a task that has not begun, or request cancellation cooperatively."""
        with self.repository.mutation():
            data = self.repository.load_all()
            now = self.storage.now()
            for task in data.get("tasks", []):
                if task.get("task_id") != task_id:
                    continue
                current = v3_status(task.get("status"))
                if current in {"completed", "failed", "timeout", "cancelled"}:
                    raise ValueError(f"任务当前状态为 {current}，不能取消")

                task["cancel_reason"] = reason
                task["updated_at"] = now
                if current in {"created", "queued"}:
                    task["status"] = "cancelled"
                    task["cancelled_at"] = now
                    self._remove_task_created_messages(task_id)
                else:
                    # A running executor must observe this and stop cooperatively.
                    task["cancel_requested_at"] = now
                self.repository.save_all(data)
                if self.metrics:
                    self.metrics.touch_task(task)
                return upgrade_task(task)
        raise KeyError(task_id)

    def supersede_task(self, *, old_task_id: str, new_task_id: str, reason: str) -> dict:
        """Link a replacement task and prevent the old one from being picked up."""
        if old_task_id == new_task_id:
            raise ValueError("新旧任务不能相同")
        with self.repository.mutation():
            data = self.repository.load_all()
            old_task = next((task for task in data.get("tasks", []) if task.get("task_id") == old_task_id), None)
            new_task = next((task for task in data.get("tasks", []) if task.get("task_id") == new_task_id), None)
            if not old_task or not new_task:
                raise KeyError(old_task_id if not old_task else new_task_id)

            now = self.storage.now()
            current = v3_status(old_task.get("status"))
            if current in {"completed", "failed", "timeout", "cancelled"}:
                raise ValueError(f"旧任务当前状态为 {current}，不能取代")
            old_task["superseded_by_task_id"] = new_task_id
            old_task["superseded_at"] = now
            old_task["cancel_reason"] = reason
            old_task["updated_at"] = now
            new_task["supersedes_task_id"] = old_task_id
            new_task["updated_at"] = now
            if current in {"created", "queued"}:
                old_task["status"] = "cancelled"
                old_task["cancelled_at"] = now
                self._remove_task_created_messages(old_task_id)
            else:
                old_task["cancel_requested_at"] = now
            self.repository.save_all(data)
            if self.metrics:
                self.metrics.touch_task(old_task)
                self.metrics.touch_task(new_task)
            return {"old_task": upgrade_task(old_task), "new_task": upgrade_task(new_task)}
