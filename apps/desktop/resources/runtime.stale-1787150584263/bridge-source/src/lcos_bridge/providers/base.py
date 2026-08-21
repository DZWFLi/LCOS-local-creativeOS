from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from ..canonical.models import (
    OutputIntent,
    ProviderCapabilities,
    ResultEnvelope,
    TaskEnvelope,
    parse_result_envelope,
)
from ..core.errors import BridgeError


class ProviderAdapter(Protocol):
    @property
    def capabilities(self) -> ProviderCapabilities: ...

    def materialize_task(self, envelope: TaskEnvelope) -> dict[str, object]: ...

    def normalize_result(self, raw: object) -> ResultEnvelope: ...


@dataclass(frozen=True)
class PullProviderAdapter:
    name: str
    task_types: tuple[str, ...] = ("creative_run", "markdown_script_revision")
    output_intents: tuple[OutputIntent, ...] = (
        OutputIntent.CREATE,
        OutputIntent.REVISE,
        OutputIntent.ANALYZE,
    )

    @property
    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            provider=self.name,
            executionMode="pull",
            taskTypes=self.task_types,
            outputIntents=self.output_intents,
            contractVersions=("bridge-task-v1",),
            sessionBinding=self.name == "codex",
            completionHook=True,
        )

    def materialize_task(self, envelope: TaskEnvelope) -> dict[str, object]:
        return envelope.model_dump(mode="json", by_alias=True)

    def normalize_result(self, raw: object) -> ResultEnvelope:
        if not isinstance(raw, (dict, str, bytes)):
            raise ValueError("Provider result must be a mapping or JSON payload")
        return parse_result_envelope(raw)


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, ProviderAdapter] = {}

    @classmethod
    def default(cls) -> "ProviderRegistry":
        registry = cls()
        registry.register(PullProviderAdapter("workbuddy"))
        registry.register(PullProviderAdapter("codex"))
        return registry

    def register(self, adapter: ProviderAdapter) -> None:
        name = adapter.capabilities.provider
        if name in self._providers:
            raise BridgeError(
                "PROVIDER_ALREADY_REGISTERED",
                f"Provider {name!r} is already registered.",
                retryable=False,
                http_status=409,
            )
        self._providers[name] = adapter

    def get(self, provider: str) -> ProviderAdapter:
        try:
            return self._providers[provider]
        except KeyError as error:
            raise BridgeError(
                "PROVIDER_UNSUPPORTED",
                f"Provider {provider!r} is not registered.",
                retryable=False,
                http_status=400,
            ) from error

    def capabilities(self) -> tuple[ProviderCapabilities, ...]:
        return tuple(adapter.capabilities for adapter in self._providers.values())
