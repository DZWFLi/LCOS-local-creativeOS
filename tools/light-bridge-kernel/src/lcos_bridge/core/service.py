from __future__ import annotations

from .. import __version__
from ..canonical.models import (
    BridgeCapabilities,
    BridgeTask,
    ResultEnvelope,
    TaskEnvelopeV1,
)
from ..providers.base import ProviderRegistry
from .errors import BridgeError
from .store import SQLiteTaskStore


class BridgeService:
    def __init__(self, store: SQLiteTaskStore, providers: ProviderRegistry | None = None) -> None:
        self.store = store
        self.providers = providers or ProviderRegistry.default()

    def capabilities(self) -> BridgeCapabilities:
        return BridgeCapabilities(
            bridgeVersion=__version__,
            primaryContractVersion="bridge-task-v1",
            supportedTaskContracts=("bridge-task-v1",),
            legacyCompletionContracts=("bridge-task-v0",),
            providers=self.providers.capabilities(),
        )

    def create_task(self, envelope: TaskEnvelopeV1) -> tuple[BridgeTask, bool]:
        adapter = self.providers.get(envelope.provider)
        capabilities = adapter.capabilities
        if envelope.contract_version not in capabilities.contract_versions:
            raise BridgeError(
                "CONTRACT_UNSUPPORTED",
                f"Provider {envelope.provider!r} does not accept {envelope.contract_version!r}.",
                retryable=False,
                http_status=400,
            )
        if envelope.task_type not in capabilities.task_types:
            raise BridgeError(
                "TASK_TYPE_UNSUPPORTED",
                f"Provider {envelope.provider!r} does not support {envelope.task_type!r}.",
                retryable=False,
                http_status=400,
            )
        if envelope.output_intent not in capabilities.output_intents:
            raise BridgeError(
                "OUTPUT_INTENT_UNSUPPORTED",
                f"Provider {envelope.provider!r} does not support {envelope.output_intent!r}.",
                retryable=False,
                http_status=400,
            )
        return self.store.create_task(envelope)

    def get_by_run_id(self, lcos_run_id: str) -> BridgeTask | None:
        return self.store.get_by_run_id(lcos_run_id)

    def get_task(self, task_id: str) -> BridgeTask | None:
        return self.store.get(task_id)

    def claim_next(self, provider: str, worker_id: str, lease_seconds: int = 120) -> BridgeTask | None:
        self.providers.get(provider)
        return self.store.claim_next(provider, worker_id, lease_seconds)

    def claim_task_by_id(self, task_id: str, provider: str, worker_id: str, lease_seconds: int = 120) -> BridgeTask:
        self.providers.get(provider)
        return self.store.claim_task_by_id(task_id, provider, worker_id, lease_seconds)

    def direct_task(self, task_id: str, session_id: str) -> BridgeTask:
        return self.store.direct_task(task_id, session_id)

    def heartbeat(self, task_id: str, worker_id: str, lease_seconds: int = 120) -> BridgeTask:
        return self.store.heartbeat(task_id, worker_id, lease_seconds)

    def start(self, task_id: str, worker_id: str | None = None) -> BridgeTask:
        return self.store.mark_running(task_id, worker_id)

    def submit_result(self, result: ResultEnvelope) -> BridgeTask:
        return self.store.submit_result(result)

    def cancel(self, task_id: str) -> BridgeTask:
        return self.store.cancel(task_id)

    def finalize(self, task_id: str, decision: str) -> BridgeTask:
        if decision not in {"completed", "retrying", "cancelled", "rejected"}:
            raise BridgeError(
                "INVALID_FINALIZE_DECISION",
                f"Unsupported final decision {decision!r}.",
                retryable=False,
                http_status=400,
            )
        return self.store.finalize(task_id, decision)
