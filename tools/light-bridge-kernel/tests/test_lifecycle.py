from __future__ import annotations

import json
import sqlite3

import pytest

from lcos_bridge.canonical.ids import canonical_json, payload_fingerprint, task_id_for_run
from lcos_bridge.canonical.models import ResultEnvelopeV0, ResultEnvelopeV1
from lcos_bridge.core.errors import BridgeError
from lcos_bridge.core.service import BridgeService
from lcos_bridge.core.store import SQLiteTaskStore
from tests.helpers import (
    make_analyze_envelope,
    make_analyze_result,
    make_create_envelope,
    make_create_result,
    make_revise_envelope,
    make_revise_result,
)


def test_restart_recovers_same_task(tmp_path):
    path = tmp_path / "bridge.sqlite3"
    first = BridgeService(SQLiteTaskStore(path))
    task, _ = first.create_task(make_create_envelope())
    second = BridgeService(SQLiteTaskStore(path))
    recovered = second.get_by_run_id("run-create-1")
    assert recovered is not None
    assert recovered.task_id == task.task_id
    assert recovered.output_intent == "create"


def test_create_multi_file_result(service):
    task, _ = service.create_task(make_create_envelope(expected_count=2))
    service.start(task.task_id)
    review = service.submit_result(make_create_result(task.task_id, count=2))
    assert review.status == "review"
    assert review.result is not None
    assert len(review.result.changed_files) == 2


def test_analyze_can_complete_without_files(service):
    task, _ = service.create_task(make_analyze_envelope())
    review = service.submit_result(make_analyze_result(task.task_id))
    assert review.status == "review"
    assert review.result is not None
    assert review.result.changed_files == ()


def test_revise_requires_modified_action(service):
    task, _ = service.create_task(make_revise_envelope())
    review = service.submit_result(make_revise_result(task.task_id))
    assert review.status == "review"


def test_revise_created_action_rejected(service):
    task, _ = service.create_task(make_revise_envelope())
    invalid = ResultEnvelopeV1.model_validate(
        {
            "contractVersion": "bridge-result-v1",
            "taskId": task.task_id,
            "lcosRunId": task.lcos_run_id,
            "providerStatus": "review",
            "summary": "Wrong action.",
            "changedFiles": [
                {
                    "path": f"C:\\demo\\{task.lcos_run_id}\\outputs\\script-revised.md",
                    "action": "created",
                    "role": "revised_script",
                }
            ],
        }
    )
    with pytest.raises(BridgeError) as captured:
        service.submit_result(invalid)
    assert captured.value.code == "RESULT_ACTION_INVALID"


def test_output_root_escape_rejected(service):
    task, _ = service.create_task(
        make_create_envelope(expected_count=0, allow_additional=True)
    )
    result = ResultEnvelopeV1.model_validate(
        {
            "contractVersion": "bridge-result-v1",
            "taskId": task.task_id,
            "lcosRunId": task.lcos_run_id,
            "providerStatus": "review",
            "summary": "Attempted an unsafe output.",
            "changedFiles": [
                {"path": "C:\\outside\\bad.md", "action": "created"}
            ],
        }
    )
    with pytest.raises(BridgeError) as captured:
        service.submit_result(result)
    assert captured.value.code == "OUTPUT_ROOT_ESCAPE"


def test_required_output_missing(service):
    task, _ = service.create_task(make_create_envelope(expected_count=2))
    with pytest.raises(BridgeError) as captured:
        service.submit_result(make_create_result(task.task_id, count=1))
    assert captured.value.code == "REQUIRED_OUTPUT_MISSING"


def test_additional_file_allowed_inside_root(service):
    task, _ = service.create_task(
        make_create_envelope(expected_count=0, allow_additional=True, max_files=2)
    )
    result = ResultEnvelopeV1.model_validate(
        {
            "contractVersion": "bridge-result-v1",
            "taskId": task.task_id,
            "lcosRunId": task.lcos_run_id,
            "providerStatus": "review",
            "summary": "Created two useful outputs.",
            "changedFiles": [
                {
                    "path": f"C:\\demo\\{task.lcos_run_id}\\outputs\\script.md",
                    "action": "created",
                },
                {
                    "path": f"C:\\demo\\{task.lcos_run_id}\\outputs\\shot-list.md",
                    "action": "created",
                },
            ],
        }
    )
    review = service.submit_result(result)
    assert review.status == "review"


def test_file_limit_enforced(service):
    task, _ = service.create_task(
        make_create_envelope(expected_count=0, allow_additional=True, max_files=1)
    )
    result = ResultEnvelopeV1.model_validate(
        {
            "contractVersion": "bridge-result-v1",
            "taskId": task.task_id,
            "lcosRunId": task.lcos_run_id,
            "providerStatus": "review",
            "summary": "Too many outputs.",
            "changedFiles": [
                {
                    "path": f"C:\\demo\\{task.lcos_run_id}\\outputs\\one.md",
                    "action": "created",
                },
                {
                    "path": f"C:\\demo\\{task.lcos_run_id}\\outputs\\two.md",
                    "action": "created",
                },
            ],
        }
    )
    with pytest.raises(BridgeError) as captured:
        service.submit_result(result)
    assert captured.value.code == "RESULT_FILE_LIMIT_EXCEEDED"


def test_retrying_finalization_does_not_requeue(service):
    task, _ = service.create_task(make_create_envelope())
    service.submit_result(make_create_result(task.task_id))
    finalized = service.finalize(task.task_id, "retrying")
    assert finalized.status == "completed"
    assert finalized.final_disposition == "retrying"
    assert service.claim_next("workbuddy", "worker-2") is None


def test_v1_store_migrates_and_reads_existing_v0_task(tmp_path):
    db = tmp_path / "bridge.sqlite3"
    envelope = {
        "contractVersion": "bridge-task-v0",
        "lcosRunId": "legacy-run",
        "idempotencyKey": "legacy-run",
        "requestFingerprint": "legacy-fp",
        "provider": "workbuddy",
        "taskType": "markdown_script_revision",
        "runtimeInputPackPath": "C:\\demo\\legacy\\runtime-input-pack.json",
        "expectedOutputs": [
            {
                "absolutePath": "C:\\demo\\legacy\\output.md",
                "mode": "create_new_file",
            }
        ],
        "timeoutSeconds": 900,
        "reportMode": "short",
        "metadata": {},
    }
    payload = dict(envelope)
    payload.pop("requestFingerprint")
    with sqlite3.connect(db) as connection:
        connection.executescript(
            """
            CREATE TABLE bridge_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE bridge_tasks (
              task_id TEXT PRIMARY KEY,
              lcos_run_id TEXT NOT NULL UNIQUE,
              idempotency_key TEXT NOT NULL UNIQUE,
              request_fingerprint TEXT NOT NULL,
              payload_fingerprint TEXT NOT NULL,
              contract_version TEXT NOT NULL,
              provider TEXT NOT NULL,
              task_type TEXT NOT NULL,
              status TEXT NOT NULL,
              envelope_json TEXT NOT NULL,
              result_json TEXT,
              external_task_id TEXT,
              external_session_id TEXT,
              provider_status TEXT,
              claimed_by TEXT,
              final_disposition TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            """
        )
        connection.execute(
            """
            INSERT INTO bridge_tasks(
              task_id, lcos_run_id, idempotency_key, request_fingerprint,
              payload_fingerprint, contract_version, provider, task_type,
              status, envelope_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                task_id_for_run("legacy-run"),
                "legacy-run",
                "legacy-run",
                "legacy-fp",
                payload_fingerprint(payload),
                "bridge-task-v0",
                "workbuddy",
                "markdown_script_revision",
                "running",
                canonical_json(envelope),
                "2026-07-30T00:00:00Z",
                "2026-07-30T00:00:00Z",
            ),
        )
    service = BridgeService(SQLiteTaskStore(db))
    task = service.get_by_run_id("legacy-run")
    assert task is not None
    assert task.output_intent == "revise"
    assert db.with_suffix(".sqlite3.v1.bak").exists()

    result = ResultEnvelopeV0.model_validate(
        {
            "contractVersion": "bridge-result-v0",
            "taskId": task.task_id,
            "lcosRunId": "legacy-run",
            "providerStatus": "review",
            "changedFiles": [
                {"path": "C:\\demo\\legacy\\output.md", "action": "created"}
            ],
        }
    )
    completed = service.submit_result(result)
    assert completed.status == "review"
