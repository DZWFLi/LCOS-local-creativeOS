from __future__ import annotations

import hashlib
import json
import ntpath
import posixpath
import re
from pathlib import Path

from app.errors import BridgeContractError

BRIDGE_CONTRACT_VERSION = "bridge-task-v0"
BRIDGE_RESULT_CONTRACT_VERSION = "bridge-result-v0"
LCOS_PROVIDER = "workbuddy"
LCOS_TASK_TYPE = "markdown_script_revision"
LCOS_REPORT_MODE = "short"
LCOS_OUTPUT_MODE = "create_new_file"
LCOS_RESULT_STATUSES = {"review", "failed", "cancelled", "timeout"}


def canonical_json(value: dict) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def normalize_absolute_path(value: str) -> str:
    if re.match(r"^[A-Za-z]:[\\/]", value) or value.startswith("\\\\"):
        return ntpath.normpath(value)
    return posixpath.normpath(value)


def normalize_task_envelope_for_fingerprint(envelope: dict) -> dict:
    fingerprint_input = dict(envelope)
    fingerprint_input.pop("requestFingerprint", None)
    runtime_input_path = fingerprint_input.get("runtimeInputPackPath")
    if isinstance(runtime_input_path, str):
        fingerprint_input["runtimeInputPackPath"] = normalize_absolute_path(runtime_input_path)
    outputs = fingerprint_input.get("expectedOutputs")
    if isinstance(outputs, list):
        fingerprint_input["expectedOutputs"] = [
            {
                **output,
                "absolutePath": normalize_absolute_path(output["absolutePath"]),
            }
            if isinstance(output, dict) and isinstance(output.get("absolutePath"), str)
            else output
            for output in outputs
        ]
    return fingerprint_input


def create_request_fingerprint(envelope: dict) -> str:
    fingerprint_input = normalize_task_envelope_for_fingerprint(envelope)
    encoded = canonical_json(fingerprint_input).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _require_string(value: dict, field: str) -> str:
    result = value.get(field)
    if not isinstance(result, str) or not result.strip():
        raise BridgeContractError(
            "INVALID_TASK_ENVELOPE",
            f"{field} must be a non-empty string.",
        )
    return result


def validate_task_envelope_v0(envelope: dict) -> dict:
    if not isinstance(envelope, dict):
        raise BridgeContractError("INVALID_TASK_ENVELOPE", "TaskEnvelopeV0 must be an object.")

    allowed_fields = {
        "contractVersion",
        "lcosRunId",
        "idempotencyKey",
        "requestFingerprint",
        "provider",
        "taskType",
        "runtimeInputPackPath",
        "expectedOutputs",
        "timeoutSeconds",
        "reportMode",
    }
    unknown = sorted(set(envelope) - allowed_fields)
    if unknown:
        raise BridgeContractError(
            "INVALID_TASK_ENVELOPE",
            f"TaskEnvelopeV0 contains unknown fields: {', '.join(unknown)}.",
        )

    if envelope.get("contractVersion") != BRIDGE_CONTRACT_VERSION:
        raise BridgeContractError(
            "CONTRACT_UNSUPPORTED",
            f"Expected {BRIDGE_CONTRACT_VERSION}.",
        )
    lcos_run_id = _require_string(envelope, "lcosRunId")
    if _require_string(envelope, "idempotencyKey") != lcos_run_id:
        raise BridgeContractError(
            "INVALID_TASK_ENVELOPE",
            "MVP idempotencyKey must equal lcosRunId.",
        )
    if envelope.get("provider") != LCOS_PROVIDER:
        raise BridgeContractError("CONTRACT_UNSUPPORTED", "Only workbuddy is supported.")
    if envelope.get("taskType") != LCOS_TASK_TYPE:
        raise BridgeContractError(
            "CONTRACT_UNSUPPORTED",
            "Only markdown_script_revision is supported.",
        )
    runtime_input_pack_path = normalize_absolute_path(
        _require_string(envelope, "runtimeInputPackPath")
    )
    if not Path(runtime_input_pack_path).is_absolute():
        raise BridgeContractError(
            "INVALID_TASK_ENVELOPE",
            "runtimeInputPackPath must be absolute.",
        )
    if envelope.get("reportMode") != LCOS_REPORT_MODE:
        raise BridgeContractError("CONTRACT_UNSUPPORTED", "MVP reportMode must be short.")

    timeout_seconds = envelope.get("timeoutSeconds")
    if not isinstance(timeout_seconds, int) or isinstance(timeout_seconds, bool) or timeout_seconds <= 0:
        raise BridgeContractError(
            "INVALID_TASK_ENVELOPE",
            "timeoutSeconds must be a positive integer.",
        )

    expected_outputs = envelope.get("expectedOutputs")
    if not isinstance(expected_outputs, list) or not expected_outputs:
        raise BridgeContractError(
            "INVALID_TASK_ENVELOPE",
            "expectedOutputs must be a non-empty array.",
        )
    normalized_outputs = []
    for index, output in enumerate(expected_outputs):
        if not isinstance(output, dict) or set(output) != {"absolutePath", "mode"}:
            raise BridgeContractError(
                "INVALID_TASK_ENVELOPE",
                f"expectedOutputs[{index}] must contain only absolutePath and mode.",
            )
        absolute_path = output.get("absolutePath")
        if not isinstance(absolute_path, str) or not Path(absolute_path).is_absolute():
            raise BridgeContractError(
                "INVALID_TASK_ENVELOPE",
                f"expectedOutputs[{index}].absolutePath must be absolute.",
            )
        if output.get("mode") != LCOS_OUTPUT_MODE:
            raise BridgeContractError(
                "CONTRACT_UNSUPPORTED",
                f"expectedOutputs[{index}].mode must be create_new_file.",
            )
        normalized_outputs.append({
            "absolutePath": normalize_absolute_path(absolute_path),
            "mode": LCOS_OUTPUT_MODE,
        })

    supplied_fingerprint = _require_string(envelope, "requestFingerprint")
    calculated_fingerprint = create_request_fingerprint(envelope)
    if supplied_fingerprint != calculated_fingerprint:
        raise BridgeContractError(
            "INVALID_REQUEST_FINGERPRINT",
            "requestFingerprint does not match canonical TaskEnvelopeV0.",
        )

    return {
        "contractVersion": BRIDGE_CONTRACT_VERSION,
        "lcosRunId": lcos_run_id,
        "idempotencyKey": lcos_run_id,
        "requestFingerprint": supplied_fingerprint,
        "provider": LCOS_PROVIDER,
        "taskType": LCOS_TASK_TYPE,
        "runtimeInputPackPath": runtime_input_pack_path,
        "expectedOutputs": normalized_outputs,
        "timeoutSeconds": timeout_seconds,
        "reportMode": LCOS_REPORT_MODE,
    }


def validate_result_envelope_v0(envelope: dict) -> dict:
    if not isinstance(envelope, dict):
        raise BridgeContractError("INVALID_RESULT_ENVELOPE", "ResultEnvelopeV0 must be an object.")
    allowed_fields = {
        "contractVersion",
        "taskId",
        "lcosRunId",
        "providerStatus",
        "shortSummary",
        "resultSummary",
        "changedFiles",
        "error",
    }
    unknown = sorted(set(envelope) - allowed_fields)
    if unknown:
        raise BridgeContractError(
            "INVALID_RESULT_ENVELOPE",
            f"ResultEnvelopeV0 contains unknown fields: {', '.join(unknown)}.",
        )
    if envelope.get("contractVersion") != BRIDGE_RESULT_CONTRACT_VERSION:
        raise BridgeContractError(
            "CONTRACT_UNSUPPORTED",
            f"Expected {BRIDGE_RESULT_CONTRACT_VERSION}.",
        )
    _require_string(envelope, "taskId")
    _require_string(envelope, "lcosRunId")
    if envelope.get("providerStatus") not in LCOS_RESULT_STATUSES:
        raise BridgeContractError(
            "INVALID_RESULT_ENVELOPE",
            "providerStatus must be review, failed, cancelled, or timeout.",
        )
    for field in ("shortSummary", "resultSummary"):
        if field in envelope and not isinstance(envelope[field], str):
            raise BridgeContractError(
                "INVALID_RESULT_ENVELOPE",
                f"{field} must be a string.",
            )
    if "error" in envelope:
        error = envelope["error"]
        if (
            not isinstance(error, dict)
            or set(error) != {"code", "message"}
            or not isinstance(error.get("code"), str)
            or not isinstance(error.get("message"), str)
        ):
            raise BridgeContractError(
                "INVALID_RESULT_ENVELOPE",
                "error must contain string code and message fields.",
            )
    changed_files = envelope.get("changedFiles")
    if not isinstance(changed_files, list):
        raise BridgeContractError(
            "INVALID_RESULT_ENVELOPE",
            "changedFiles must be an array.",
        )
    for index, changed_file in enumerate(changed_files):
        if not isinstance(changed_file, dict) or set(changed_file) != {"path", "action"}:
            raise BridgeContractError(
                "INVALID_RESULT_ENVELOPE",
                f"changedFiles[{index}] must contain only path and action.",
            )
        if not isinstance(changed_file.get("path"), str) or not Path(changed_file["path"]).is_absolute():
            raise BridgeContractError(
                "INVALID_RESULT_ENVELOPE",
                f"changedFiles[{index}].path must be absolute.",
            )
        if changed_file.get("action") != "created":
            raise BridgeContractError(
                "CONTRACT_UNSUPPORTED",
                "MVP ResultEnvelopeV0 only supports action=created.",
            )
    return envelope
