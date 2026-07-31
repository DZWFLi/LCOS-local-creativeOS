"""
AI Bridge — Runtime health service
"""
from __future__ import annotations

from pathlib import Path

from app.contracts import BRIDGE_CONTRACT_VERSION, BRIDGE_RESULT_CONTRACT_VERSION
from app.errors import BridgeContractError
from app.repositories.artifacts import ArtifactRepository
from app.repositories.messages import MessageRepository
from app.repositories.metrics import MetricRepository
from app.repositories.sessions import SessionRepository
from app.repositories.tasks import TaskRepository
from app.runtime.storage import RuntimeStorage


class HealthService:
    BRIDGE_VERSION = "0.2.0"
    def __init__(
        self,
        storage: RuntimeStorage,
        message_repo: MessageRepository,
        task_repo: TaskRepository,
        session_repo: SessionRepository,
        artifact_repo: ArtifactRepository,
        metric_repo: MetricRepository,
    ):
        self.storage = storage
        self.message_repo = message_repo
        self.task_repo = task_repo
        self.session_repo = session_repo
        self.artifact_repo = artifact_repo
        self.metric_repo = metric_repo

    def check(self) -> dict:
        try:
            counts = {
                "messagesTargets": len(self.message_repo.load_messages().keys()),
                "tasks": len(self.task_repo.load_all().get("tasks", [])),
                "sessions": len(self.session_repo.load_all().get("sessions", [])),
                "artifacts": len(self.artifact_repo.load_all().get("artifacts", [])),
                "metrics": len(self.metric_repo.load_all().get("metrics", [])),
            }
        except BridgeContractError as error:
            return {
                **error.to_dict(),
                "bridgeVersion": self.BRIDGE_VERSION,
                "contractVersion": BRIDGE_CONTRACT_VERSION,
            }
        return {
            "ok": True,
            "bridgeVersion": self.BRIDGE_VERSION,
            "contractVersion": BRIDGE_CONTRACT_VERSION,
            "resultContractVersion": BRIDGE_RESULT_CONTRACT_VERSION,
            "capabilities": {
                "idempotentCreate": True,
                "lookupByLcosRunId": True,
                "structuredResult": True,
                "cancel": True,
                "finalize": True,
                "eventsAfterSeq": False,
            },
            "runtimeReady": Path(self.storage.root).is_dir(),
            "counts": counts,
        }
