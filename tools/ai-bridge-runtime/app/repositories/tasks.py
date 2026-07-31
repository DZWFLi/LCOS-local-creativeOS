from __future__ import annotations

from contextlib import contextmanager

from app.errors import BridgeContractError
from app.runtime.storage import RuntimeStorage


class TaskRepository:
    def __init__(self, storage: RuntimeStorage):
        self.storage = storage

    def load_all(self) -> dict:
        return self.storage.get_tasks()

    def save_all(self, data: dict) -> None:
        self.storage.save_tasks(data)

    @contextmanager
    def mutation(self):
        with self.storage.mutation(self.storage.tasks_file):
            yield

    def find_by_id(self, task_id: str) -> dict | None:
        for task in self.load_all().get("tasks", []):
            if task.get("task_id") == task_id:
                return task
        return None

    def find_by_lcos_run_id(self, lcos_run_id: str) -> dict | None:
        matches = [
            task
            for task in self.load_all().get("tasks", [])
            if task.get("lcos_run_id") == lcos_run_id
        ]
        if len(matches) > 1:
            raise BridgeContractError(
                "RUNTIME_STORAGE_CORRUPT",
                "Multiple Bridge Tasks are bound to the same LCOS Run.",
                http_status=500,
            )
        return matches[0] if matches else None

    def create_idempotent(self, task: dict) -> tuple[dict, bool]:
        lcos_run_id = task["lcos_run_id"]

        def update(data: dict) -> tuple[dict, tuple[dict, bool]]:
            tasks = data.setdefault("tasks", [])
            matches = [
                existing
                for existing in tasks
                if existing.get("lcos_run_id") == lcos_run_id
            ]
            if len(matches) > 1:
                raise BridgeContractError(
                    "RUNTIME_STORAGE_CORRUPT",
                    "Multiple Bridge Tasks are bound to the same LCOS Run.",
                    http_status=500,
                )
            if matches:
                existing = matches[0]
                same_identity = (
                    existing.get("idempotency_key") == task["idempotency_key"]
                    and existing.get("request_fingerprint") == task["request_fingerprint"]
                    and existing.get("contract_version") == task["contract_version"]
                )
                if not same_identity:
                    raise BridgeContractError(
                        "IDEMPOTENCY_CONFLICT",
                        "lcos_run_id is already bound to a different request.",
                        http_status=409,
                    )
                return data, (existing, True)
            tasks.append(task)
            return data, (task, False)

        return self.storage.update_json(
            self.storage.tasks_file,
            {"tasks": []},
            update,
        )
