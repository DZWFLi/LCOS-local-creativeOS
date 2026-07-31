"""
AI Bridge — Result service
"""
from __future__ import annotations

from pathlib import Path

from app.models import upgrade_task
from app.repositories.messages import MessageRepository
from app.repositories.tasks import TaskRepository
from app.runtime.storage import RuntimeStorage
from app.schemas import new_task_created_message, new_task_result_message, new_task_review_result_message
from app.validators import normalize_assignee, v3_status
from app.services.artifacts import ArtifactService
from app.services.metrics import MetricService
from app.services.sessions import SessionService


class ResultService:
    def __init__(self, storage: RuntimeStorage, sessions: SessionService, artifacts: ArtifactService, repository: TaskRepository, message_repository: MessageRepository, metrics: MetricService | None = None):
        self.storage = storage
        self.sessions = sessions
        self.artifacts = artifacts
        self.repository = repository
        self.message_repository = message_repository
        self.metrics = metrics

    def validate_result(
        self,
        *,
        task: dict,
        assignee: str,
        status_normalized: str,
        milestone_report_path: str,
        structured_artifacts: list,
        normalized_changed_files: list,
        report_mode: str,
    ) -> None:
        if task.get("assignee") != assignee:
            raise ValueError("这个任务不是分配给你的")
        old_status = v3_status(task.get("status"))
        if old_status not in ("running", "assigned", "queued", "created") and task.get("status") not in ("in_progress",):
            raise ValueError(f"任务当前状态为 {old_status}，只能提交 running 状态的结果")
        if milestone_report_path and not Path(milestone_report_path).is_absolute():
            raise ValueError(f"milestone_report_path 必须是绝对路径: {milestone_report_path}")
        if report_mode == "silent" and not normalized_changed_files and not structured_artifacts:
            raise ValueError("silent 模式至少需要 changed_files 或 artifacts 之一")
        if status_normalized not in {"review", "failed", "timeout"}:
            raise ValueError(f"WorkBuddy 只能回传 review/failed/timeout，收到: {status_normalized}")

    def submit_result(
        self,
        *,
        task_id: str,
        assignee: str,
        result_summary: str,
        status_normalized: str,
        session_id: str,
        short_summary: str,
        normalized_changed_files: list,
        structured_artifacts: list,
        milestone_report_path: str,
        report_mode: str,
        is_v2_compat: bool,
    ) -> dict:
        assignee = normalize_assignee(assignee)
        data = self.repository.load_all()
        now = self.storage.now()
        for task in data.get("tasks", []):
            if task.get("task_id") != task_id:
                continue
            self.validate_result(
                task=task,
                assignee=assignee,
                status_normalized=status_normalized,
                milestone_report_path=milestone_report_path,
                structured_artifacts=structured_artifacts,
                normalized_changed_files=normalized_changed_files,
                report_mode=report_mode,
            )

            task["status"] = status_normalized
            task["result_summary"] = result_summary
            task["short_summary"] = short_summary or None
            task["updated_at"] = now
            if session_id:
                task["session_id"] = session_id
            task["artifacts"] = structured_artifacts
            task["artifact_ids"] = [a.get("artifact_id") for a in structured_artifacts if a.get("artifact_id")]
            task["changed_files"] = normalized_changed_files
            task["milestone_report_path"] = milestone_report_path or None

            if status_normalized == "review":
                task["reviewed_at"] = now
            elif status_normalized == "failed":
                task["error"] = result_summary
            elif status_normalized == "timeout":
                task["error"] = f"Timeout: {result_summary}"

            self.repository.save_all(data)
            self.sessions.touch_session(task.get("session_id") or session_id, now)

            if structured_artifacts:
                self.artifacts.create_artifacts(
                    structured_artifacts,
                    task_id=task_id,
                    project_id=task.get("project_id"),
                    session_id=task.get("session_id") or session_id,
                    created_by=assignee,
                    created_at=now,
                )

            messages = self.message_repository.load_messages()
            originator = task.get("created_by", "codex")
            messages.setdefault(originator, []).append(
                new_task_result_message(
                    task_id=task_id,
                    sender=assignee,
                    status=status_normalized,
                    result_summary=result_summary,
                    short_summary=task.get("short_summary"),
                    changed_files=task.get("changed_files", []),
                    artifact_ids=task["artifact_ids"],
                    artifacts=structured_artifacts,
                    milestone_report_path=task.get("milestone_report_path"),
                    timestamp=now,
                    is_v2_compat=is_v2_compat,
                )
            )
            self.message_repository.save_messages(messages)

            result = upgrade_task(task)
            if is_v2_compat:
                result["_notice"] = "此任务使用 V2 兼容 completed 提交，V3 建议使用 status=review"
            if self.metrics:
                self.metrics.touch_task(result)
            return result
        raise KeyError(task_id)

    def finalize_review(self, *, task_id: str, decision: str, review_comment: str) -> dict:
        data = self.repository.load_all()
        now = self.storage.now()
        for task in data.get("tasks", []):
            if task.get("task_id") != task_id:
                continue
            current = v3_status(task.get("status"))
            if current != "review":
                raise ValueError(f"任务当前状态为 {current}，只能验收 review 状态的任务")
            if decision == "completed":
                task["status"] = "completed"
                task["completed_at"] = now
            elif decision == "retrying":
                task["status"] = "queued"
                task["retry_count"] = task.get("retry_count", 0) + 1
                task["retry_reason"] = review_comment or "Codex 要求返工"
                task["reviewed_at"] = None
            elif decision == "cancelled":
                task["status"] = "cancelled"
            else:
                raise ValueError(f"decision 只能是 completed/retrying/cancelled，收到: {decision}")
            task["updated_at"] = now
            self.repository.save_all(data)
            self.sessions.touch_session(task.get("session_id"), now)

            messages = self.message_repository.load_messages()
            assignee = task.get("assignee", "workbuddy")
            messages.setdefault(assignee, []).append(
                new_task_review_result_message(
                    task_id=task_id,
                    decision=decision,
                    review_comment=review_comment,
                    timestamp=now,
                )
            )
            if decision == "retrying":
                messages.setdefault(assignee, []).append(
                    new_task_created_message(
                        task_id=task_id,
                        project_id=task.get("project_id"),
                        session_id=task.get("session_id"),
                        task_type=task.get("task_type"),
                        capability=task.get("capability"),
                        report_mode=task.get("report_mode"),
                        instruction=task.get("instruction"),
                        timestamp=now,
                    )
                )
            self.message_repository.save_messages(messages)
            result = upgrade_task(task)
            if self.metrics:
                self.metrics.touch_task(result)
            return result
        raise KeyError(task_id)
