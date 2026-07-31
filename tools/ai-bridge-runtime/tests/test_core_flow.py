from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.legacy.compat import normalize_submit_status
from app.repositories.artifacts import ArtifactRepository
from app.repositories.capabilities import CapabilityRepository
from app.repositories.messages import MessageRepository
from app.repositories.metrics import MetricRepository
from app.repositories.sessions import SessionRepository
from app.repositories.tasks import TaskRepository
from app.runtime.storage import RuntimeStorage
from app.services.artifacts import ArtifactService
from app.services.capabilities import CapabilityService
from app.services.messages import MessageService
from app.services.metrics import MetricService
from app.services.results import ResultService
from app.services.sessions import SessionService
from app.services.tasks import TaskService
from app.validators import validate_changed_files, validate_report_mode


class CoreFlowTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.storage = RuntimeStorage(Path(self.tempdir.name))
        self.message_repo = MessageRepository(self.storage)
        self.task_repo = TaskRepository(self.storage)
        self.session_repo = SessionRepository(self.storage)
        self.artifact_repo = ArtifactRepository(self.storage)
        self.metric_repo = MetricRepository(self.storage)
        self.cap_repo = CapabilityRepository(self.storage, Path(self.tempdir.name) / "capability_registry.json")
        self.capabilities = CapabilityService(self.storage, Path(self.tempdir.name) / "capability_registry.json", self.cap_repo)
        self.sessions = SessionService(self.storage, self.session_repo)
        self.metrics = MetricService(self.metric_repo)
        self.artifacts = ArtifactService(self.storage, self.artifact_repo)
        self.tasks = TaskService(self.storage, self.sessions, self.capabilities, self.task_repo, self.message_repo, self.metrics)
        self.results = ResultService(self.storage, self.sessions, self.artifacts, self.task_repo, self.message_repo, self.metrics)

    def tearDown(self):
        self.tempdir.cleanup()

    def test_core_lifecycle(self):
        task = self.tasks.create_task(
            instruction="test",
            assignee="workbuddy",
            task_type="code_refactor",
            project_id="unit",
            expected_outputs="[]",
            input_files="[]",
            session_id="",
            capability="code_refactor",
            acceptance_criteria="[]",
            context="{}",
            priority="normal",
            timeout_seconds=0,
            report_mode="silent",
            validate_report_mode=validate_report_mode,
        )
        claimed = self.tasks.claim_task(task["task_id"], "workbuddy")
        started = self.tasks.start_task(task["task_id"], "workbuddy")
        changed_files, error = validate_changed_files([str(ROOT / "bridge_server.py")])
        self.assertEqual(error, "")
        reviewed = self.results.submit_result(
            task_id=task["task_id"],
            assignee="workbuddy",
            result_summary="ok",
            status_normalized="review",
            session_id="",
            short_summary="",
            normalized_changed_files=changed_files,
            structured_artifacts=[],
            milestone_report_path="",
            report_mode="silent",
            is_v2_compat=False,
        )
        completed = self.results.finalize_review(task_id=task["task_id"], decision="completed", review_comment="")
        self.assertEqual(claimed["status"], "assigned")
        self.assertEqual(started["status"], "running")
        self.assertEqual(reviewed["status"], "review")
        self.assertEqual(completed["status"], "completed")
        self.assertEqual(len(self.metric_repo.load_all().get("metrics", [])), 1)

    def test_message_flow(self):
        messages = MessageService(self.storage, self.message_repo)
        conv_id = messages.send_message(target="workbuddy", message="hello", sender="codex")
        self.assertTrue(conv_id)
        self.assertEqual(len(messages.get_messages(target="workbuddy")), 1)
        messages.respond(conversation_id=conv_id, response="ok", sender="workbuddy")
        self.assertEqual(len(messages.get_messages(target="codex")), 1)

    def test_legacy_completed_to_review(self):
        status, compat = normalize_submit_status("completed")
        self.assertEqual(status, "review")
        self.assertTrue(compat)

    def test_cancel_queued_task_removes_delivery_message(self):
        task = self.tasks.create_task(
            instruction="cancel me", assignee="workbuddy", task_type="file_ops", project_id="unit",
            expected_outputs="[]", input_files="[]", session_id="", capability="file_ops",
            acceptance_criteria="[]", context="{}", priority="normal", timeout_seconds=0,
            report_mode="short", validate_report_mode=validate_report_mode,
        )
        cancelled = self.tasks.cancel_task(task_id=task["task_id"], reason="replaced")
        self.assertEqual(cancelled["status"], "cancelled")
        self.assertEqual(cancelled["cancel_reason"], "replaced")
        self.assertEqual(self.tasks.get_pending_tasks("workbuddy"), [])
        self.assertEqual(self.message_repo.load_messages().get("workbuddy"), [])

    def test_supersede_queued_task_links_and_cancels_old_task(self):
        old_task = self.tasks.create_task(
            instruction="old", assignee="workbuddy", task_type="file_ops", project_id="unit",
            expected_outputs="[]", input_files="[]", session_id="", capability="file_ops",
            acceptance_criteria="[]", context="{}", priority="normal", timeout_seconds=0,
            report_mode="short", validate_report_mode=validate_report_mode,
        )
        new_task = self.tasks.create_task(
            instruction="new", assignee="workbuddy", task_type="file_ops", project_id="unit",
            expected_outputs="[]", input_files="[]", session_id=old_task["session_id"], capability="file_ops",
            acceptance_criteria="[]", context="{}", priority="high", timeout_seconds=0,
            report_mode="short", validate_report_mode=validate_report_mode,
        )
        linked = self.tasks.supersede_task(
            old_task_id=old_task["task_id"], new_task_id=new_task["task_id"], reason="newer scope"
        )
        self.assertEqual(linked["old_task"]["status"], "cancelled")
        self.assertEqual(linked["old_task"]["superseded_by_task_id"], new_task["task_id"])
        self.assertEqual(linked["new_task"]["supersedes_task_id"], old_task["task_id"])

    def test_cancel_running_task_is_cooperative_and_hidden_from_pending(self):
        task = self.tasks.create_task(
            instruction="running", assignee="workbuddy", task_type="file_ops", project_id="unit",
            expected_outputs="[]", input_files="[]", session_id="", capability="file_ops",
            acceptance_criteria="[]", context="{}", priority="normal", timeout_seconds=0,
            report_mode="short", validate_report_mode=validate_report_mode,
        )
        self.tasks.claim_task(task["task_id"], "workbuddy")
        self.tasks.start_task(task["task_id"], "workbuddy")
        requested = self.tasks.cancel_task(task_id=task["task_id"], reason="stop safely")
        self.assertEqual(requested["status"], "running")
        self.assertTrue(requested["cancel_requested_at"])
        self.assertEqual(self.tasks.get_pending_tasks("workbuddy"), [])


if __name__ == "__main__":
    unittest.main()
