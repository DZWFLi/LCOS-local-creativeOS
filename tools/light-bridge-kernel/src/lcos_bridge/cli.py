from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated

import typer
import uvicorn

from .canonical.models import TaskEnvelopeV1, parse_result_envelope
from .core.errors import BridgeError
from .core.service import BridgeService
from .core.store import SQLiteTaskStore
from .settings import BridgeSettings
from .transport.http_api import create_app

app = typer.Typer(help="LCOS Light Bridge Kernel")
task_app = typer.Typer(help="Task plane commands")
app.add_typer(task_app, name="task")


def _service(runtime_root: str | Path | None) -> tuple[BridgeSettings, BridgeService]:
    settings = BridgeSettings.from_env(runtime_root=runtime_root)
    return settings, BridgeService(SQLiteTaskStore(settings.database_path))


def _print(value: object) -> None:
    typer.echo(json.dumps(value, ensure_ascii=False, indent=2))


@app.command()
def doctor(
    runtime_root: Annotated[str | None, typer.Option("--runtime-root")] = None,
) -> None:
    try:
        settings, service = _service(runtime_root)
        _print(
            {
                "ok": True,
                "runtimeRoot": str(settings.runtime_root),
                "database": str(settings.database_path),
                "capabilities": service.capabilities().model_dump(
                    mode="json", by_alias=True
                ),
            }
        )
    except BridgeError as error:
        _print({"ok": False, "error": error.as_dict()})
        raise typer.Exit(2) from error


@app.command()
def serve(
    runtime_root: Annotated[str | None, typer.Option("--runtime-root")] = None,
    host: Annotated[str, typer.Option("--host")] = "127.0.0.1",
    port: Annotated[int, typer.Option("--port")] = 43122,
) -> None:
    settings = BridgeSettings.from_env(runtime_root=runtime_root, host=host, port=port)
    service = BridgeService(SQLiteTaskStore(settings.database_path))
    uvicorn.run(create_app(service), host=settings.host, port=settings.port, log_level="info")


@task_app.command("create")
def task_create(
    file: Annotated[Path, typer.Option("--file", exists=True, dir_okay=False)],
    runtime_root: Annotated[str | None, typer.Option("--runtime-root")] = None,
) -> None:
    _, service = _service(runtime_root)
    envelope = TaskEnvelopeV1.model_validate_json(file.read_text(encoding="utf-8"))
    task, replayed = service.create_task(envelope)
    _print(
        {
            "ok": True,
            "replayed": replayed,
            "task": task.model_dump(mode="json", by_alias=True),
        }
    )


@task_app.command("get")
def task_get(
    task_id: Annotated[str | None, typer.Option("--task-id")] = None,
    run_id: Annotated[str | None, typer.Option("--run-id")] = None,
    runtime_root: Annotated[str | None, typer.Option("--runtime-root")] = None,
) -> None:
    if not task_id and not run_id:
        raise typer.BadParameter("--task-id or --run-id is required")
    _, service = _service(runtime_root)
    task = service.get_task(task_id) if task_id else service.get_by_run_id(str(run_id))
    if task is None:
        _print({"ok": False, "error": {"code": "TASK_NOT_FOUND"}})
        raise typer.Exit(4)
    _print({"ok": True, "task": task.model_dump(mode="json", by_alias=True)})


@task_app.command("claim-next")
def claim_next(
    provider: Annotated[str, typer.Option("--provider")],
    worker: Annotated[str, typer.Option("--worker")],
    runtime_root: Annotated[str | None, typer.Option("--runtime-root")] = None,
) -> None:
    _, service = _service(runtime_root)
    task = service.claim_next(provider, worker)
    _print(
        {
            "ok": True,
            "task": None
            if task is None
            else task.model_dump(mode="json", by_alias=True),
        }
    )


@task_app.command("start")
def task_start(
    task_id: Annotated[str, typer.Option("--task-id")],
    worker: Annotated[str | None, typer.Option("--worker")] = None,
    runtime_root: Annotated[str | None, typer.Option("--runtime-root")] = None,
) -> None:
    _, service = _service(runtime_root)
    _print(
        {
            "ok": True,
            "task": service.start(task_id, worker).model_dump(
                mode="json", by_alias=True
            ),
        }
    )


@task_app.command("submit-result")
def submit_result(
    file: Annotated[Path, typer.Option("--file", exists=True, dir_okay=False)],
    runtime_root: Annotated[str | None, typer.Option("--runtime-root")] = None,
) -> None:
    _, service = _service(runtime_root)
    result = parse_result_envelope(file.read_text(encoding="utf-8"))
    _print(
        {
            "ok": True,
            "task": service.submit_result(result).model_dump(
                mode="json", by_alias=True
            ),
        }
    )


@task_app.command("cancel")
def task_cancel(
    task_id: Annotated[str, typer.Option("--task-id")],
    runtime_root: Annotated[str | None, typer.Option("--runtime-root")] = None,
) -> None:
    _, service = _service(runtime_root)
    _print(
        {
            "ok": True,
            "task": service.cancel(task_id).model_dump(mode="json", by_alias=True),
        }
    )


@task_app.command("finalize")
def task_finalize(
    task_id: Annotated[str, typer.Option("--task-id")],
    decision: Annotated[str, typer.Option("--decision")],
    runtime_root: Annotated[str | None, typer.Option("--runtime-root")] = None,
) -> None:
    _, service = _service(runtime_root)
    _print(
        {
            "ok": True,
            "task": service.finalize(task_id, decision).model_dump(
                mode="json", by_alias=True
            ),
        }
    )
