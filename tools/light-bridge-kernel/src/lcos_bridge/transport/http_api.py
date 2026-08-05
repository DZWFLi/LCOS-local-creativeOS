from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .. import __version__
from ..canonical.models import (
    InputResponseV1,
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


class DirectInput(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    session_id: str = Field(alias="sessionId")


class FinalizeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: str
    comment: str = ""


class InputResponseBody(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    request_id: str = Field(alias="requestId", min_length=1)
    text: str | None = Field(default=None, max_length=20000)
    selected_options: tuple[str, ...] = Field(default_factory=tuple, alias="selectedOptions")
    responded_by: str = Field(default="user", alias="respondedBy")


def _task_dict(task: Any) -> dict[str, Any]:
    return task.model_dump(mode="json", by_alias=True)


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

    @app.post("/v1/tasks/{task_id}/direct")
    def direct_task(task_id: str, input_value: DirectInput) -> dict[str, Any]:
        return {
            "ok": True,
            "task": _task_dict(service.direct_task(task_id, input_value.session_id)),
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

    @app.post("/v1/tasks/{task_id}/input-response")
    def answer_task_input(task_id: str, input_value: InputResponseBody) -> dict[str, Any]:
        response = InputResponseV1.model_validate(input_value.model_dump(mode="json", by_alias=True))
        return {"ok": True, "task": _task_dict(service.answer_input(task_id, response))}

    @app.post("/v1/tasks/{task_id}/cancel")
    def cancel_task(task_id: str) -> dict[str, Any]:
        return {"ok": True, "task": _task_dict(service.cancel(task_id))}

    @app.post("/v1/tasks/{task_id}/finalize")
    def finalize_task(task_id: str, input_value: FinalizeInput) -> dict[str, Any]:
        return {
            "ok": True,
            "task": _task_dict(service.finalize(task_id, input_value.decision)),
        }


    return app
