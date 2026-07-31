from __future__ import annotations

import json
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.contracts import (
    BRIDGE_CONTRACT_VERSION,
    BRIDGE_RESULT_CONTRACT_VERSION,
    create_request_fingerprint,
    validate_result_envelope_v0,
    validate_task_envelope_v0,
)
from app.errors import BridgeContractError
from app.repositories.artifacts import ArtifactRepository
from app.repositories.capabilities import CapabilityRepository
from app.repositories.messages import MessageRepository
from app.repositories.metrics import MetricRepository
from app.repositories.sessions import SessionRepository
from app.repositories.tasks import TaskRepository
from app.runtime.storage import RuntimeStorage
from app.services.capabilities import CapabilityService
from app.services.health import HealthService
from app.services.metrics import MetricService
from app.services.sessions import SessionService
from app.services.tasks import TaskService
from app.validators import validate_report_mode


def task_envelope(
    *,
    run_id: str = "run-slice-b-001",
    output_path: str = "C:/LCOS_MVP_SAMPLE/staging/script-draft-run-slice-b-001.md",
) -> dict:
    envelope = {
        "contractVersion": BRIDGE_CONTRACT_VERSION,
        "lcosRunId": run_id,
        "idempotencyKey": run_id,
        "provider": "workbuddy",
        "taskType": "markdown_script_revision",
        "runtimeInputPackPath": "C:/LCOS_MVP_SAMPLE/runtime/runtime-input-pack.json",
        "expectedOutputs": [{
            "absolutePath": output_path,
            "mode": "create_new_file",
        }],
        "timeoutSeconds": 600,
        "reportMode": "short",
    }
    envelope["requestFingerprint"] = create_request_fingerprint(envelope)
    return envelope


class LcosBridgeContractTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)
        self.storage = RuntimeStorage(self.root)
        self.message_repo = MessageRepository(self.storage)
        self.task_repo = TaskRepository(self.storage)
        self.session_repo = SessionRepository(self.storage)
        self.artifact_repo = ArtifactRepository(self.storage)
        self.metric_repo = MetricRepository(self.storage)
        self.capability_repo = CapabilityRepository(
            self.storage,
            self.root / "capability_registry.json",
        )
        self.capabilities = CapabilityService(
            self.storage,
            self.root / "capability_registry.json",
            self.capability_repo,
        )
        self.sessions = SessionService(self.storage, self.session_repo)
        self.metrics = MetricService(self.metric_repo)
        self.tasks = TaskService(
            self.storage,
            self.sessions,
            self.capabilities,
            self.task_repo,
            self.message_repo,
            self.metrics,
        )

    def tearDown(self):
        self.tempdir.cleanup()

    def create_lcos_task(self, envelope: dict, service: TaskService | None = None) -> dict:
        selected_service = service or self.tasks
        return selected_service.create_task(
            instruction="Revise the Markdown script.",
            assignee="workbuddy",
            task_type=envelope["taskType"],
            project_id="mvp-sample",
            expected_outputs=json.dumps(envelope["expectedOutputs"]),
            input_files="[]",
            session_id="",
            capability="markdown_script_revision",
            acceptance_criteria="[]",
            context="{}",
            priority="normal",
            timeout_seconds=envelope["timeoutSeconds"],
            report_mode=envelope["reportMode"],
            validate_report_mode=validate_report_mode,
            contract_version=envelope["contractVersion"],
            lcos_run_id=envelope["lcosRunId"],
            idempotency_key=envelope["idempotencyKey"],
            request_fingerprint=envelope["requestFingerprint"],
            runtime_input_pack_path=envelope["runtimeInputPackPath"],
        )

    def test_fingerprint_is_canonical_unicode_and_path_normalized(self):
        first = task_envelope()
        reordered = dict(reversed(list(first.items())))
        slash_variant = dict(first)
        slash_variant["runtimeInputPackPath"] = r"C:\LCOS_MVP_SAMPLE\runtime\runtime-input-pack.json"
        slash_variant["expectedOutputs"] = [{
            "absolutePath": r"C:\LCOS_MVP_SAMPLE\staging\script-draft-run-slice-b-001.md",
            "mode": "create_new_file",
        }]
        slash_variant.pop("requestFingerprint")
        first_with_unicode = {**first, "requestFingerprint": "ignored"}
        first_with_unicode["lcosRunId"] = "run-脚本-001"
        first_with_unicode["idempotencyKey"] = "run-脚本-001"

        self.assertEqual(
            create_request_fingerprint(first),
            create_request_fingerprint(reordered),
        )
        self.assertEqual(
            create_request_fingerprint(first),
            create_request_fingerprint(slash_variant),
        )
        self.assertEqual(
            len(create_request_fingerprint(first_with_unicode)),
            64,
        )

    def test_task_envelope_rejects_forged_fingerprint_and_unknown_fields(self):
        forged = {**task_envelope(), "requestFingerprint": "0" * 64}
        with self.assertRaisesRegex(BridgeContractError, "requestFingerprint"):
            validate_task_envelope_v0(forged)
        unknown = {**task_envelope(), "providerTaskId": "forbidden"}
        unknown["requestFingerprint"] = create_request_fingerprint(unknown)
        with self.assertRaisesRegex(BridgeContractError, "unknown fields"):
            validate_task_envelope_v0(unknown)

    def test_first_create_and_compatible_replay_return_one_task(self):
        envelope = task_envelope()
        created = self.create_lcos_task(envelope)
        replayed = self.create_lcos_task(envelope)

        self.assertFalse(created["replayed"])
        self.assertTrue(replayed["replayed"])
        self.assertEqual(created["task_id"], replayed["task_id"])
        self.assertEqual(created["instruction"], "Execute the immutable RuntimeInputPackV0.")
        self.assertEqual(created["context"], {})
        self.assertEqual(created["input_files"], [r"C:\LCOS_MVP_SAMPLE\runtime\runtime-input-pack.json"])
        self.assertEqual(len(self.task_repo.load_all()["tasks"]), 1)
        self.assertEqual(len(self.message_repo.load_messages()["workbuddy"]), 1)
        self.assertEqual(len(self.metric_repo.load_all()["metrics"]), 1)
        self.assertEqual(list(self.root.glob("*.tmp")), [])

    def test_incompatible_replay_returns_idempotency_conflict(self):
        first = task_envelope()
        second = task_envelope(
            output_path="C:/LCOS_MVP_SAMPLE/staging/different-output.md",
        )
        self.create_lcos_task(first)
        with self.assertRaises(BridgeContractError) as caught:
            self.create_lcos_task(second)
        self.assertEqual(caught.exception.code, "IDEMPOTENCY_CONFLICT")
        self.assertEqual(caught.exception.http_status, 409)
        self.assertEqual(len(self.task_repo.load_all()["tasks"]), 1)

    def test_concurrent_replays_create_one_task(self):
        envelope = task_envelope()
        services = [
            TaskService(
                RuntimeStorage(self.root),
                self.sessions,
                self.capabilities,
                TaskRepository(RuntimeStorage(self.root)),
                self.message_repo,
                self.metrics,
            )
            for _ in range(32)
        ]
        with ThreadPoolExecutor(max_workers=16) as executor:
            results = list(executor.map(
                lambda service: self.create_lcos_task(envelope, service),
                services,
            ))
        self.assertEqual(len({result["task_id"] for result in results}), 1)
        self.assertEqual(sum(not result["replayed"] for result in results), 1)
        self.assertEqual(len(self.task_repo.load_all()["tasks"]), 1)
        self.assertEqual(len(self.message_repo.load_messages()["workbuddy"]), 1)
        self.assertEqual(len(self.metric_repo.load_all()["metrics"]), 1)

    def test_restart_recovers_task_by_lcos_run_id_without_mutation(self):
        envelope = task_envelope()
        created = self.create_lcos_task(envelope)
        before = self.storage.tasks_file.read_text(encoding="utf-8")

        restarted_storage = RuntimeStorage(self.root)
        restarted_repository = TaskRepository(restarted_storage)
        recovered = restarted_repository.find_by_lcos_run_id(envelope["lcosRunId"])

        self.assertEqual(recovered["task_id"], created["task_id"])
        self.assertEqual(
            restarted_storage.tasks_file.read_text(encoding="utf-8"),
            before,
        )
        lookup = self.tasks.get_task_by_lcos_run_id(envelope["lcosRunId"])
        self.assertEqual(lookup["taskId"], created["task_id"])
        self.assertEqual(lookup["lcosRunId"], envelope["lcosRunId"])
        self.assertEqual(lookup["contractVersion"], BRIDGE_CONTRACT_VERSION)

    def test_corrupt_task_storage_is_not_treated_as_empty(self):
        self.storage.tasks_file.write_text("{not-json", encoding="utf-8")
        with self.assertRaises(BridgeContractError) as caught:
            self.create_lcos_task(task_envelope())
        self.assertEqual(caught.exception.code, "RUNTIME_STORAGE_CORRUPT")
        self.assertEqual(
            self.storage.tasks_file.read_text(encoding="utf-8"),
            "{not-json",
        )

    def test_result_contract_accepts_only_created_files(self):
        result = {
            "contractVersion": BRIDGE_RESULT_CONTRACT_VERSION,
            "taskId": "task_12345678",
            "lcosRunId": "run-slice-b-001",
            "providerStatus": "review",
            "shortSummary": "Draft created.",
            "changedFiles": [{
                "path": "C:/LCOS_MVP_SAMPLE/staging/script-draft.md",
                "action": "created",
            }],
        }
        self.assertEqual(validate_result_envelope_v0(result), result)
        invalid = {
            **result,
            "changedFiles": [{
                "path": "C:/LCOS_MVP_SAMPLE/script-current.md",
                "action": "modified",
            }],
        }
        with self.assertRaises(BridgeContractError) as caught:
            validate_result_envelope_v0(invalid)
        self.assertEqual(caught.exception.code, "CONTRACT_UNSUPPORTED")

    def test_health_declares_real_capabilities_without_runtime_paths(self):
        health = HealthService(
            self.storage,
            self.message_repo,
            self.task_repo,
            self.session_repo,
            self.artifact_repo,
            self.metric_repo,
        ).check()
        serialized = json.dumps(health)
        self.assertTrue(health["ok"])
        self.assertEqual(health["contractVersion"], BRIDGE_CONTRACT_VERSION)
        self.assertTrue(health["capabilities"]["idempotentCreate"])
        self.assertTrue(health["capabilities"]["lookupByLcosRunId"])
        self.assertFalse(health["capabilities"]["eventsAfterSeq"])
        self.assertNotIn(str(self.root), serialized)

    def test_health_reports_corrupt_task_storage_structurally(self):
        self.storage.tasks_file.write_text("{not-json", encoding="utf-8")
        health = HealthService(
            self.storage,
            self.message_repo,
            self.task_repo,
            self.session_repo,
            self.artifact_repo,
            self.metric_repo,
        ).check()
        self.assertFalse(health["ok"])
        self.assertEqual(health["error"]["code"], "RUNTIME_STORAGE_CORRUPT")
        self.assertNotIn(str(self.root), json.dumps(health))

    def test_shared_contract_fixtures_are_valid_and_desensitized(self):
        task_fixture = json.loads(
            (ROOT / "fixtures" / "task-envelope-v0.json").read_text(encoding="utf-8")
        )
        result_fixture = json.loads(
            (ROOT / "fixtures" / "result-envelope-v0.json").read_text(encoding="utf-8")
        )
        self.assertEqual(validate_task_envelope_v0(task_fixture)["lcosRunId"], "run-mvp-fixture-001")
        self.assertEqual(validate_result_envelope_v0(result_fixture)["lcosRunId"], "run-mvp-fixture-001")
        serialized = json.dumps([task_fixture, result_fixture])
        for forbidden in ("Users/", "Users\\", "token", "password", "Authorization"):
            self.assertNotIn(forbidden, serialized)


if __name__ == "__main__":
    unittest.main()
