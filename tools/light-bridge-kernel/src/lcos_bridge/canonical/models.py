from __future__ import annotations

import json
import ntpath
import posixpath
import re
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .ids import payload_fingerprint


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def looks_absolute(path: str) -> bool:
    return bool(
        path.startswith("/")
        or path.startswith("\\\\")
        or re.match(r"^[A-Za-z]:[\\/]", path)
    )


def path_key(path: str) -> str:
    return path.replace("\\", "/").rstrip("/").casefold()


def path_is_within(path: str, root: str) -> bool:
    """Lexically check containment for Windows or POSIX absolute paths.

    Local Core remains the final realpath / junction authority. The Bridge uses
    this check to keep providers inside the declared staging root before a
    result reaches Local Core.
    """

    if not looks_absolute(path) or not looks_absolute(root):
        return False
    windows_style = bool(
        re.match(r"^[A-Za-z]:[\\/]", path)
        or path.startswith("\\\\")
        or re.match(r"^[A-Za-z]:[\\/]", root)
        or root.startswith("\\\\")
    )
    module = ntpath if windows_style else posixpath
    normalized_path = module.normcase(module.normpath(path))
    normalized_root = module.normcase(module.normpath(root))
    try:
        return module.commonpath([normalized_path, normalized_root]) == normalized_root
    except ValueError:
        return False


class OutputIntent(StrEnum):
    CREATE = "create"
    REVISE = "revise"
    ANALYZE = "analyze"


class ChangedFileAction(StrEnum):
    CREATED = "created"
    MODIFIED = "modified"


class ProviderStatus(StrEnum):
    CREATED = "created"
    QUEUED = "queued"
    CLAIMED = "claimed"
    RUNNING = "running"
    REVIEW = "review"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


# ---------------------------------------------------------------------------
# Legacy V0 contract. Existing V0 tasks remain readable and completable after
# upgrading the Bridge database, but new V0 task creation is intentionally not
# exposed by BridgeService.
# ---------------------------------------------------------------------------


class ExpectedOutputV0(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    absolute_path: str = Field(alias="absolutePath")
    mode: Literal["create_new_file"] = Field(default="create_new_file")

    @field_validator("absolute_path")
    @classmethod
    def validate_absolute_path(cls, value: str) -> str:
        if not looks_absolute(value):
            raise ValueError("expected output path must be absolute")
        return value


class ChangedFileV0(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    path: str
    action: Literal["created"] = "created"

    @field_validator("path")
    @classmethod
    def validate_absolute_path(cls, value: str) -> str:
        if not looks_absolute(value):
            raise ValueError("changed file path must be absolute")
        return value


class TaskEnvelopeV0(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    contract_version: Literal["bridge-task-v0"] = Field(
        default="bridge-task-v0", alias="contractVersion"
    )
    lcos_run_id: str = Field(alias="lcosRunId", min_length=1)
    idempotency_key: str = Field(alias="idempotencyKey", min_length=1)
    request_fingerprint: str = Field(alias="requestFingerprint", min_length=1)
    provider: str = Field(min_length=1, pattern=r"^[a-z][a-z0-9_-]{1,31}$")
    task_type: str = Field(alias="taskType", min_length=1)
    runtime_input_pack_path: str = Field(alias="runtimeInputPackPath", min_length=1)
    expected_outputs: tuple[ExpectedOutputV0, ...] = Field(alias="expectedOutputs", min_length=1)
    timeout_seconds: int = Field(default=900, alias="timeoutSeconds", ge=1, le=86400)
    report_mode: Literal["silent", "short", "full"] = Field(
        default="short", alias="reportMode"
    )
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("runtime_input_pack_path")
    @classmethod
    def validate_runtime_pack_path(cls, value: str) -> str:
        if not looks_absolute(value):
            raise ValueError("runtimeInputPackPath must be absolute")
        return value

    @model_validator(mode="after")
    def validate_outputs_unique(self) -> "TaskEnvelopeV0":
        keys = [path_key(item.absolute_path) for item in self.expected_outputs]
        if len(keys) != len(set(keys)):
            raise ValueError("expectedOutputs contains duplicate paths")
        return self

    @property
    def output_intent(self) -> OutputIntent:
        return OutputIntent.REVISE

    def payload_for_fingerprint(self) -> dict[str, Any]:
        value = self.model_dump(mode="json", by_alias=True)
        value.pop("requestFingerprint", None)
        return value

    def computed_payload_fingerprint(self) -> str:
        return payload_fingerprint(self.payload_for_fingerprint())


class ResultEnvelopeV0(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    contract_version: Literal["bridge-result-v0"] = Field(
        default="bridge-result-v0", alias="contractVersion"
    )
    task_id: str = Field(alias="taskId", min_length=1)
    lcos_run_id: str = Field(alias="lcosRunId", min_length=1)
    provider_status: Literal["review", "failed", "cancelled", "timeout"] = Field(
        alias="providerStatus"
    )
    short_summary: str | None = Field(default=None, alias="shortSummary")
    result_summary: str | None = Field(default=None, alias="resultSummary")
    changed_files: tuple[ChangedFileV0, ...] = Field(default_factory=tuple, alias="changedFiles")
    error: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Output-intent V1 contract.
# ---------------------------------------------------------------------------


class OutputPolicyV1(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    allow_zero_files: bool = Field(default=False, alias="allowZeroFiles")
    allow_additional_files: bool = Field(default=False, alias="allowAdditionalFiles")
    max_files: int = Field(default=5, alias="maxFiles", ge=1, le=5)


class ExpectedOutputV1(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    output_id: str = Field(alias="outputId", min_length=1)
    role: str = Field(min_length=1)
    action: ChangedFileAction
    absolute_path: str | None = Field(default=None, alias="absolutePath")
    media_type: str | None = Field(default=None, alias="mediaType")
    suggested_name: str | None = Field(default=None, alias="suggestedName")
    required: bool = True

    @field_validator("absolute_path")
    @classmethod
    def validate_optional_absolute_path(cls, value: str | None) -> str | None:
        if value is not None and not looks_absolute(value):
            raise ValueError("expected output absolutePath must be absolute")
        return value


class ChangedFileV1(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    path: str
    action: ChangedFileAction
    role: str | None = None
    media_type: str | None = Field(default=None, alias="mediaType")

    @field_validator("path")
    @classmethod
    def validate_absolute_path(cls, value: str) -> str:
        if not looks_absolute(value):
            raise ValueError("changed file path must be absolute")
        return value


class TaskEnvelopeV1(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    contract_version: Literal["bridge-task-v1"] = Field(
        default="bridge-task-v1", alias="contractVersion"
    )
    lcos_run_id: str = Field(alias="lcosRunId", min_length=1)
    idempotency_key: str = Field(alias="idempotencyKey", min_length=1)
    request_fingerprint: str = Field(alias="requestFingerprint", min_length=1)

    manifest_id: str = Field(alias="manifestId", min_length=1)
    manifest_hash: str = Field(alias="manifestHash", min_length=1)
    output_intent: OutputIntent = Field(alias="outputIntent")
    instructions: str = Field(min_length=1)

    provider: str = Field(min_length=1, pattern=r"^[a-z][a-z0-9_-]{1,31}$")
    task_type: str = Field(default="creative_run", alias="taskType", min_length=1)
    runtime_input_pack_path: str = Field(alias="runtimeInputPackPath", min_length=1)
    output_root: str = Field(alias="outputRoot", min_length=1)
    expected_outputs: tuple[ExpectedOutputV1, ...] = Field(
        default_factory=tuple, alias="expectedOutputs"
    )
    output_policy: OutputPolicyV1 = Field(alias="outputPolicy")

    timeout_seconds: int = Field(default=900, alias="timeoutSeconds", ge=1, le=86400)
    report_mode: Literal["silent", "short", "full"] = Field(
        default="short", alias="reportMode"
    )
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("runtime_input_pack_path", "output_root")
    @classmethod
    def validate_absolute_runtime_paths(cls, value: str) -> str:
        if not looks_absolute(value):
            raise ValueError("runtimeInputPackPath and outputRoot must be absolute")
        return value

    @model_validator(mode="after")
    def validate_output_contract(self) -> "TaskEnvelopeV1":
        paths = [item.absolute_path for item in self.expected_outputs if item.absolute_path]
        path_keys = [path_key(value) for value in paths]
        if len(path_keys) != len(set(path_keys)):
            raise ValueError("expectedOutputs contains duplicate absolute paths")

        output_ids = [item.output_id for item in self.expected_outputs]
        if len(output_ids) != len(set(output_ids)):
            raise ValueError("expectedOutputs contains duplicate outputId values")

        pathless_roles = [
            item.role.casefold()
            for item in self.expected_outputs
            if item.absolute_path is None
        ]
        if len(pathless_roles) != len(set(pathless_roles)):
            raise ValueError("pathless expected outputs must have unique roles")

        for item in self.expected_outputs:
            if item.absolute_path and not path_is_within(item.absolute_path, self.output_root):
                raise ValueError("expected output path must be inside outputRoot")

        if len(self.expected_outputs) > self.output_policy.max_files:
            raise ValueError("expectedOutputs exceeds outputPolicy.maxFiles")

        if self.output_intent is OutputIntent.CREATE:
            if self.output_policy.allow_zero_files:
                raise ValueError("create intent cannot allow zero files")
            if any(item.action is not ChangedFileAction.CREATED for item in self.expected_outputs):
                raise ValueError("create intent expected outputs must use action=created")
            if not self.expected_outputs and not self.output_policy.allow_additional_files:
                raise ValueError(
                    "create intent requires expectedOutputs or allowAdditionalFiles=true"
                )

        elif self.output_intent is OutputIntent.REVISE:
            if self.output_policy.allow_zero_files:
                raise ValueError("revise intent cannot allow zero files")
            if self.output_policy.allow_additional_files:
                raise ValueError("revise intent does not allow additional files in MVP")
            if self.output_policy.max_files != 1 or len(self.expected_outputs) != 1:
                raise ValueError("revise intent requires exactly one expected output")
            expected = self.expected_outputs[0]
            if expected.action is not ChangedFileAction.MODIFIED:
                raise ValueError("revise intent expected output must use action=modified")
            if not expected.required or expected.absolute_path is None:
                raise ValueError("revise output must be required and have an absolutePath")

        elif self.output_intent is OutputIntent.ANALYZE:
            if not self.output_policy.allow_zero_files:
                raise ValueError("analyze intent must allow zero files")
            if any(item.action is not ChangedFileAction.CREATED for item in self.expected_outputs):
                raise ValueError("analyze file outputs, when present, must use action=created")

        return self

    def payload_for_fingerprint(self) -> dict[str, Any]:
        value = self.model_dump(mode="json", by_alias=True)
        value.pop("requestFingerprint", None)
        return value

    def computed_payload_fingerprint(self) -> str:
        return payload_fingerprint(self.payload_for_fingerprint())


class ResultEnvelopeV1(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    contract_version: Literal["bridge-result-v1"] = Field(
        default="bridge-result-v1", alias="contractVersion"
    )
    task_id: str = Field(alias="taskId", min_length=1)
    lcos_run_id: str = Field(alias="lcosRunId", min_length=1)
    provider_status: Literal["review", "failed", "cancelled", "timeout"] = Field(
        alias="providerStatus"
    )
    summary: str = Field(min_length=1)
    changed_files: tuple[ChangedFileV1, ...] = Field(default_factory=tuple, alias="changedFiles")
    warnings: tuple[str, ...] = Field(default_factory=tuple)
    suggested_next_actions: tuple[str, ...] = Field(
        default_factory=tuple, alias="suggestedNextActions"
    )
    error: dict[str, Any] | None = None

    @model_validator(mode="after")
    def validate_terminal_payload(self) -> "ResultEnvelopeV1":
        keys = [path_key(item.path) for item in self.changed_files]
        if len(keys) != len(set(keys)):
            raise ValueError("changedFiles contains duplicate paths")
        if self.provider_status in {"failed", "cancelled", "timeout"} and self.changed_files:
            raise ValueError("failed/cancelled/timeout results cannot contain changed files")
        return self


TaskEnvelope: TypeAlias = TaskEnvelopeV0 | TaskEnvelopeV1
ResultEnvelope: TypeAlias = ResultEnvelopeV0 | ResultEnvelopeV1


def parse_task_envelope(value: str | bytes | dict[str, Any]) -> TaskEnvelope:
    data = json.loads(value) if isinstance(value, (str, bytes)) else value
    version = data.get("contractVersion") or data.get("contract_version")
    if version == "bridge-task-v1":
        return TaskEnvelopeV1.model_validate(data)
    if version == "bridge-task-v0":
        return TaskEnvelopeV0.model_validate(data)
    raise ValueError(f"Unsupported TaskEnvelope contract version: {version!r}")


def parse_result_envelope(value: str | bytes | dict[str, Any]) -> ResultEnvelope:
    data = json.loads(value) if isinstance(value, (str, bytes)) else value
    version = data.get("contractVersion") or data.get("contract_version")
    if version == "bridge-result-v1":
        return ResultEnvelopeV1.model_validate(data)
    if version == "bridge-result-v0":
        return ResultEnvelopeV0.model_validate(data)
    raise ValueError(f"Unsupported ResultEnvelope contract version: {version!r}")


class ProviderCapabilities(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    provider: str
    execution_mode: Literal["pull", "api", "command"] = Field(
        default="pull", alias="executionMode"
    )
    task_types: tuple[str, ...] = Field(
        default=("creative_run", "markdown_script_revision"), alias="taskTypes"
    )
    output_intents: tuple[OutputIntent, ...] = Field(
        default=(OutputIntent.CREATE, OutputIntent.REVISE, OutputIntent.ANALYZE),
        alias="outputIntents",
    )
    contract_versions: tuple[str, ...] = Field(
        default=("bridge-task-v1",), alias="contractVersions"
    )
    session_binding: bool = Field(default=False, alias="sessionBinding")
    completion_hook: bool = Field(default=True, alias="completionHook")


class BridgeCapabilities(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    bridge_version: str = Field(alias="bridgeVersion")
    primary_contract_version: str = Field(alias="primaryContractVersion")
    supported_task_contracts: tuple[str, ...] = Field(alias="supportedTaskContracts")
    legacy_completion_contracts: tuple[str, ...] = Field(alias="legacyCompletionContracts")
    idempotent_create: bool = Field(default=True, alias="idempotentCreate")
    lookup_by_lcos_run_id: bool = Field(default=True, alias="lookupByLcosRunId")
    structured_result: bool = Field(default=True, alias="structuredResult")
    multiple_outputs: bool = Field(default=True, alias="multipleOutputs")
    zero_file_results: bool = Field(default=True, alias="zeroFileResults")
    output_root_guard: bool = Field(default=True, alias="outputRootGuard")
    cancel: bool = True
    finalize: bool = True
    events_after_seq: bool = Field(default=False, alias="eventsAfterSeq")
    providers: tuple[ProviderCapabilities, ...]


class BridgeTask(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    task_id: str = Field(alias="taskId")
    lcos_run_id: str = Field(alias="lcosRunId")
    idempotency_key: str = Field(alias="idempotencyKey")
    request_fingerprint: str = Field(alias="requestFingerprint")
    payload_fingerprint: str = Field(alias="payloadFingerprint")
    contract_version: str = Field(alias="contractVersion")
    output_intent: OutputIntent = Field(alias="outputIntent")
    provider: str
    task_type: str = Field(alias="taskType")
    status: ProviderStatus
    external_task_id: str | None = Field(default=None, alias="externalTaskId")
    external_session_id: str | None = Field(default=None, alias="externalSessionId")
    provider_status: str | None = Field(default=None, alias="providerStatus")
    claimed_by: str | None = Field(default=None, alias="claimedBy")
    final_disposition: str | None = Field(default=None, alias="finalDisposition")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    envelope: TaskEnvelope
    result: ResultEnvelope | None = None


class ConversationRef(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    provider: str
    external_session_id: str = Field(alias="externalSessionId")
    source_ref: str = Field(alias="sourceRef")
    title: str | None = None


class ConversationSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    conversation: ConversationRef
    summary: str
    fidelity: Literal["full", "partial", "summary_only"]
    loss_reasons: tuple[str, ...] = Field(default_factory=tuple, alias="lossReasons")
    captured_at: str = Field(default_factory=utc_now, alias="capturedAt")
