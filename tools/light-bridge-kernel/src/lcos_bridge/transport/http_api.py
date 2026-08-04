from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .. import __version__
from ..canonical.models import (
    ResultEnvelopeV0,
    ResultEnvelopeV1,
    TaskEnvelopeV1,
    parse_result_envelope,
)
from ..core.errors import BridgeError
from ..core.service import BridgeService


class ClaimInput(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    provider: str
    worker_id: str = Field(alias="workerId")


class StartInput(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    worker_id: str | None = Field(default=None, alias="workerId")


class FinalizeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: str
    comment: str = ""


def _task_dict(task: Any) -> dict[str, Any]:
    return task.model_dump(mode="json", by_alias=True)


def _mcp_task_dict(task: Any) -> dict[str, Any]:
    value: dict[str, Any] = {
        "task_id": task.task_id,
        "lcos_run_id": task.lcos_run_id,
        "idempotency_key": task.idempotency_key,
        "request_fingerprint": task.request_fingerprint,
        "contract_version": task.contract_version,
        "output_intent": task.output_intent.value,
        "provider": task.provider,
        "status": task.status.value,
        "session_id": task.external_session_id,
        "provider_status": task.provider_status,
    }
    if task.result is not None:
        result = task.result
        if isinstance(result, ResultEnvelopeV1):
            value.update(
                {
                    "summary": result.summary,
                    "warnings": list(result.warnings),
                    "suggested_next_actions": list(result.suggested_next_actions),
                    "changed_files": [
                        item.model_dump(mode="json", by_alias=True)
                        for item in result.changed_files
                    ],
                    "error": result.error,
                }
            )
        else:
            value.update(
                {
                    "short_summary": result.short_summary,
                    "result_summary": result.result_summary,
                    "changed_files": [
                        item.model_dump(mode="json", by_alias=True)
                        for item in result.changed_files
                    ],
                    "error": result.error,
                }
            )
    return value


def _tool_result(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "content": [
            {
                "type": "text",
                "text": json.dumps(value, ensure_ascii=False, separators=(",", ":")),
            }
        ]
    }


def _parse_jsonish(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return value


def _mcp_create_envelope_v1(args: dict[str, Any]) -> TaskEnvelopeV1:
    raw_envelope = _parse_jsonish(args.get("envelope"), None)
    if isinstance(raw_envelope, dict):
        return TaskEnvelopeV1.model_validate(raw_envelope)

    expected_outputs = _parse_jsonish(args.get("expected_outputs"), [])
    output_policy = _parse_jsonish(args.get("output_policy"), {})
    metadata = _parse_jsonish(args.get("metadata"), {})
    return TaskEnvelopeV1.model_validate(
        {
            "contractVersion": args.get("contract_version") or "bridge-task-v1",
            "lcosRunId": args.get("lcos_run_id"),
            "idempotencyKey": args.get("idempotency_key"),
            "requestFingerprint": args.get("request_fingerprint"),
            "manifestId": args.get("manifest_id"),
            "manifestHash": args.get("manifest_hash"),
            "outputIntent": args.get("output_intent"),
            "instructions": args.get("instructions") or args.get("instruction"),
            "provider": args.get("provider") or args.get("assignee") or "workbuddy",
            "taskType": args.get("task_type") or "creative_run",
            "runtimeInputPackPath": args.get("runtime_input_pack_path"),
            "outputRoot": args.get("output_root"),
            "expectedOutputs": expected_outputs,
            "outputPolicy": output_policy,
            "timeoutSeconds": args.get("timeout_seconds", 900),
            "reportMode": args.get("report_mode", "short"),
            "metadata": metadata,
        }
    )


def _mcp_result_for_task(args: dict[str, Any], task: Any):
    raw_envelope = _parse_jsonish(args.get("result"), None)
    if isinstance(raw_envelope, dict):
        return parse_result_envelope(raw_envelope)

    changed_raw = _parse_jsonish(args.get("changed_files"), [])
    if task.contract_version == "bridge-task-v1":
        return ResultEnvelopeV1.model_validate(
            {
                "contractVersion": "bridge-result-v1",
                "taskId": task.task_id,
                "lcosRunId": args.get("lcos_run_id") or task.lcos_run_id,
                "providerStatus": args.get("provider_status") or args.get("status") or "review",
                "summary": args.get("summary") or args.get("short_summary") or "Task completed.",
                "changedFiles": changed_raw,
                "warnings": _parse_jsonish(args.get("warnings"), []),
                "suggestedNextActions": _parse_jsonish(
                    args.get("suggested_next_actions"), []
                ),
                "error": args.get("error"),
            }
        )
    return ResultEnvelopeV0.model_validate(
        {
            "contractVersion": "bridge-result-v0",
            "taskId": task.task_id,
            "lcosRunId": args.get("lcos_run_id") or task.lcos_run_id,
            "providerStatus": args.get("provider_status") or args.get("status") or "review",
            "shortSummary": args.get("short_summary"),
            "resultSummary": args.get("result_summary"),
            "changedFiles": changed_raw,
            "error": args.get("error"),
        }
    )


def create_app(service: BridgeService) -> FastAPI:
    app = FastAPI(title="LCOS Light Bridge", version=__version__)

    @app.exception_handler(BridgeError)
    async def bridge_error_handler(_: Request, error: BridgeError) -> JSONResponse:
        return JSONResponse(
            status_code=error.http_status,
            content={"ok": False, "error": error.as_dict()},
        )

    @app.exception_handler(ValidationError)
    async def validation_error_handler(_: Request, error: ValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "ok": False,
                "error": {
                    "code": "CONTRACT_VALIDATION_FAILED",
                    "message": "Request does not match the canonical Bridge contract.",
                    "details": error.errors(include_url=False, include_context=False),
                },
            },
        )

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {
            "ok": True,
            **service.capabilities().model_dump(mode="json", by_alias=True),
        }

    @app.get("/v1/capabilities")
    def capabilities() -> dict[str, Any]:
        return service.capabilities().model_dump(mode="json", by_alias=True)

    @app.post("/v1/tasks", status_code=201)
    def create_task(envelope: TaskEnvelopeV1) -> dict[str, Any]:
        task, replayed = service.create_task(envelope)
        return {"ok": True, "replayed": replayed, "task": _task_dict(task)}

    @app.get("/v1/tasks/by-run/{lcos_run_id}")
    def get_by_run(lcos_run_id: str) -> dict[str, Any]:
        task = service.get_by_run_id(lcos_run_id)
        if task is None:
            raise BridgeError(
                "TASK_NOT_FOUND", "Task was not found.", retryable=False, http_status=404
            )
        return {"ok": True, "task": _task_dict(task)}

    @app.get("/v1/tasks/{task_id}")
    def get_task(task_id: str) -> dict[str, Any]:
        task = service.get_task(task_id)
        if task is None:
            raise BridgeError(
                "TASK_NOT_FOUND", "Task was not found.", retryable=False, http_status=404
            )
        return {"ok": True, "task": _task_dict(task)}

    @app.post("/v1/tasks/claim-next")
    def claim_next(input_value: ClaimInput) -> dict[str, Any]:
        task = service.claim_next(input_value.provider, input_value.worker_id)
        return {"ok": True, "task": None if task is None else _task_dict(task)}

    @app.post("/v1/tasks/{task_id}/claim")
    def claim_task_by_id(task_id: str, input_value: ClaimInput) -> dict[str, Any]:
        return {
            "ok": True,
            "task": _task_dict(
                service.claim_task_by_id(task_id, input_value.provider, input_value.worker_id)
            ),
        }

    @app.post("/v1/tasks/{task_id}/running")
    def start_task(task_id: str, input_value: StartInput) -> dict[str, Any]:
        return {
            "ok": True,
            "task": _task_dict(service.start(task_id, input_value.worker_id)),
        }

    @app.post("/v1/tasks/{task_id}/heartbeat")
    def heartbeat_task(task_id: str, input_value: StartInput) -> dict[str, Any]:
        return {
            "ok": True,
            "task": _task_dict(service.heartbeat(task_id, input_value.worker_id or "worker")),
        }

    @app.post("/v1/tasks/{task_id}/result")
    async def submit_result(task_id: str, request: Request) -> dict[str, Any]:
        result = parse_result_envelope(await request.json())
        if result.task_id != task_id:
            raise BridgeError(
                "RESULT_IDENTITY_MISMATCH",
                "Path task_id and ResultEnvelope taskId differ.",
                retryable=False,
                http_status=409,
            )
        return {"ok": True, "task": _task_dict(service.submit_result(result))}

    @app.post("/v1/tasks/{task_id}/cancel")
    def cancel_task(task_id: str) -> dict[str, Any]:
        return {"ok": True, "task": _task_dict(service.cancel(task_id))}

    @app.post("/v1/tasks/{task_id}/finalize")
    def finalize_task(task_id: str, input_value: FinalizeInput) -> dict[str, Any]:
        return {
            "ok": True,
            "task": _task_dict(service.finalize(task_id, input_value.decision)),
        }

    @app.post("/mcp")
    async def mcp(request: Request) -> Response:
        payload = await request.json()
        method = payload.get("method")
        request_id = payload.get("id")
        session_id = request.headers.get("mcp-session-id") or str(uuid.uuid4())
        headers = {"mcp-session-id": session_id}

        if method == "notifications/initialized":
            return Response(status_code=202, headers=headers)
        if method == "initialize":
            return JSONResponse(
                headers=headers,
                content={
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "protocolVersion": payload.get("params", {}).get(
                            "protocolVersion", "2025-03-26"
                        ),
                        "capabilities": {"tools": {}},
                        "serverInfo": {
                            "name": "lcos-light-bridge",
                            "version": __version__,
                        },
                    },
                },
            )
        if method == "tools/list":
            names = [
                "health_check",
                "create_task",
                "get_task_by_lcos_run_id",
                "get_task_status",
                "claim_task",
                "start_task",
                "submit_result",
                "cancel_task",
                "finalize_task_review",
                "get_capabilities",
                "claim_task_by_id",
                "heartbeat_task",
            ]
            return JSONResponse(
                headers=headers,
                content={
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "tools": [
                            {"name": name, "inputSchema": {"type": "object"}}
                            for name in names
                        ]
                    },
                },
            )
        if method != "tools/call":
            return JSONResponse(
                headers=headers,
                content={
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {"code": -32601, "message": "Method not found"},
                },
            )

        params = payload.get("params", {})
        name = params.get("name")
        args = params.get("arguments", {}) or {}
        try:
            if name == "health_check":
                value = {
                    "ok": True,
                    **service.capabilities().model_dump(mode="json", by_alias=True),
                }
            elif name == "get_capabilities":
                value = {
                    "ok": True,
                    **service.capabilities().model_dump(mode="json", by_alias=True),
                }
            elif name == "create_task":
                task, replayed = service.create_task(_mcp_create_envelope_v1(args))
                value = {"ok": True, "replayed": replayed, **_mcp_task_dict(task)}
            elif name == "get_task_by_lcos_run_id":
                task = service.get_by_run_id(str(args.get("lcos_run_id", "")))
                value = (
                    {
                        "ok": False,
                        "error": {
                            "code": "TASK_NOT_FOUND",
                            "message": "Task was not found.",
                            "retryable": False,
                        },
                    }
                    if task is None
                    else {"ok": True, **_mcp_task_dict(task)}
                )
            elif name == "get_task_status":
                task = service.get_task(str(args.get("task_id", "")))
                value = (
                    {
                        "ok": False,
                        "error": {
                            "code": "TASK_NOT_FOUND",
                            "message": "Task was not found.",
                            "retryable": False,
                        },
                    }
                    if task is None
                    else {"ok": True, **_mcp_task_dict(task)}
                )
            elif name == "claim_task":
                task = service.claim_next(
                    str(args.get("provider") or args.get("assignee") or "workbuddy"),
                    str(args.get("worker_id") or args.get("worker") or "worker"),
                )
                value = {
                    "ok": True,
                    "task": None if task is None else _mcp_task_dict(task),
                }
            elif name == "claim_task_by_id":
                value = {
                    "ok": True,
                    **_mcp_task_dict(
                        service.claim_task_by_id(
                            str(args.get("task_id", "")),
                            str(args.get("provider") or "workbuddy"),
                            str(args.get("worker_id") or args.get("worker") or "worker"),
                        )
                    ),
                }
            elif name == "start_task":
                task = service.start(str(args.get("task_id", "")), args.get("worker_id"))
                value = {"ok": True, **_mcp_task_dict(task)}
            elif name == "heartbeat_task":
                value = {
                    "ok": True,
                    **_mcp_task_dict(
                        service.heartbeat(
                            str(args.get("task_id", "")),
                            str(args.get("worker_id") or args.get("worker") or "worker"),
                        )
                    ),
                }
            elif name == "submit_result":
                task_id = str(args.get("task_id", ""))
                task = service.get_task(task_id)
                if task is None:
                    raise BridgeError(
                        "TASK_NOT_FOUND",
                        "Task was not found.",
                        retryable=False,
                        http_status=404,
                    )
                result = _mcp_result_for_task(args, task)
                value = {"ok": True, **_mcp_task_dict(service.submit_result(result))}
            elif name == "cancel_task":
                value = {
                    "ok": True,
                    **_mcp_task_dict(service.cancel(str(args.get("task_id", "")))),
                }
            elif name == "finalize_task_review":
                value = {
                    "ok": True,
                    **_mcp_task_dict(
                        service.finalize(
                            str(args.get("task_id", "")),
                            str(args.get("decision", "completed")),
                        )
                    ),
                }
            else:
                raise BridgeError(
                    "TOOL_NOT_FOUND",
                    f"Unsupported tool {name!r}.",
                    retryable=False,
                    http_status=404,
                )
        except BridgeError as error:
            value = {"ok": False, "error": error.as_dict()}
        except Exception as error:
            value = {
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": str(error),
                    "retryable": False,
                },
            }

        return JSONResponse(
            headers=headers,
            content={
                "jsonrpc": "2.0",
                "id": request_id,
                "result": _tool_result(value),
            },
        )

    return app
