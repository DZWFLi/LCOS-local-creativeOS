"""
AI Bridge — Runtime Storage abstraction
"""
from __future__ import annotations

import json
import os
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from app.errors import BridgeContractError

_RUNTIME_LOCKS_GUARD = threading.Lock()
_RUNTIME_LOCKS: dict[Path, threading.RLock] = {}


class RuntimeStorage:
    def __init__(self, root: Path | None = None):
        if root is None:
            raise ValueError("RuntimeStorage root must be provided explicitly")
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

        self.messages_file = self.root / "messages.json"
        self.conversations_file = self.root / "conversations.json"
        self.tasks_file = self.root / "tasks.json"
        self.sessions_file = self.root / "sessions.json"
        self.artifacts_file = self.root / "artifacts.json"
        self.metrics_file = self.root / "metrics.json"
        self.migration_history_file = self.root / "migration_history.json"

    def now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def load_json(self, path: Path, default=None):
        if not path.exists():
            return default or {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return default or {}

    def load_json_strict(self, path: Path, default=None):
        if not path.exists():
            return default or {}
        try:
            with open(path, "r", encoding="utf-8") as file:
                return json.load(file)
        except (json.JSONDecodeError, OSError) as error:
            raise BridgeContractError(
                "RUNTIME_STORAGE_CORRUPT",
                f"Runtime storage cannot read {path.name}.",
                retryable=False,
                http_status=500,
            ) from error

    def save_json(self, path: Path, data) -> None:
        tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
        try:
            with open(tmp, "w", encoding="utf-8") as file:
                json.dump(data, file, ensure_ascii=False, indent=2)
                file.flush()
                os.fsync(file.fileno())
            for attempt in range(4):
                try:
                    tmp.replace(path)
                    break
                except PermissionError:
                    if attempt == 3:
                        raise
                    time.sleep(0.01 * (attempt + 1))
        except OSError as error:
            try:
                tmp.unlink(missing_ok=True)
            except OSError:
                pass
            raise BridgeContractError(
                "RUNTIME_STORAGE_CORRUPT",
                f"Runtime storage cannot write {path.name}.",
                retryable=False,
                http_status=500,
            ) from error

    def update_json(self, path: Path, default, update):
        with self.mutation(path):
            current = self.load_json_strict(path, default)
            updated, result = update(current)
            self.save_json(path, updated)
            return result

    @contextmanager
    def mutation(self, path: Path):
        resolved = path.resolve()
        with _RUNTIME_LOCKS_GUARD:
            lock = _RUNTIME_LOCKS.setdefault(resolved, threading.RLock())
        with lock:
            yield

    def get_messages(self):
        return self.load_json(self.messages_file, {"codex": [], "workbuddy": []})

    def save_messages(self, data):
        self.save_json(self.messages_file, data)

    def get_conversations(self):
        return self.load_json(self.conversations_file, {})

    def save_conversations(self, data):
        self.save_json(self.conversations_file, data)

    def get_tasks(self):
        return self.load_json_strict(self.tasks_file, {"tasks": []})

    def save_tasks(self, data):
        incoming_tasks = data.get("tasks", [])

        def merge(current: dict):
            current_tasks = current.setdefault("tasks", [])
            by_id = {
                task.get("task_id"): index
                for index, task in enumerate(current_tasks)
                if task.get("task_id")
            }
            for task in incoming_tasks:
                task_id = task.get("task_id")
                if task_id in by_id:
                    current_tasks[by_id[task_id]] = task
                else:
                    by_id[task_id] = len(current_tasks)
                    current_tasks.append(task)
            return current, None

        self.update_json(self.tasks_file, {"tasks": []}, merge)

    def get_sessions(self):
        return self.load_json(self.sessions_file, {"sessions": []})

    def save_sessions(self, data):
        self.save_json(self.sessions_file, data)

    def get_artifacts(self):
        return self.load_json(self.artifacts_file, {"artifacts": []})

    def save_artifacts(self, data):
        self.save_json(self.artifacts_file, data)

    def get_metrics(self):
        return self.load_json(self.metrics_file, {"metrics": []})

    def save_metrics(self, data):
        self.save_json(self.metrics_file, data)

    def get_migration_history(self):
        return self.load_json(self.migration_history_file, {"migrations": []})

    def save_migration_history(self, data):
        self.save_json(self.migration_history_file, data)


_DEFAULT_STORAGE: RuntimeStorage | None = None


def get_default_storage() -> RuntimeStorage:
    global _DEFAULT_STORAGE
    if _DEFAULT_STORAGE is None:
        configured_root = os.environ.get("AI_BRIDGE_RUNTIME_ROOT", "").strip()
        if not configured_root:
            raise BridgeContractError(
                "RUNTIME_ROOT_UNSET",
                "AI_BRIDGE_RUNTIME_ROOT must point to an explicit disposable runtime directory.",
                http_status=500,
            )
        _DEFAULT_STORAGE = RuntimeStorage(Path(configured_root))
    return _DEFAULT_STORAGE
