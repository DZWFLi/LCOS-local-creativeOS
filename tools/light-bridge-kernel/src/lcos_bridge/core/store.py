from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
from datetime import datetime, timedelta, timezone

from ..canonical.ids import canonical_json, task_id_for_run
from ..canonical.models import (
    BridgeTask,
    ChangedFileAction,
    ExpectedOutputV1,
    OutputIntent,
    ProviderStatus,
    ResultEnvelope,
    ResultEnvelopeV0,
    ResultEnvelopeV1,
    TaskEnvelopeV0,
    TaskEnvelopeV1,
    parse_result_envelope,
    parse_task_envelope,
    path_is_within,
    path_key,
    utc_now,
)
from .errors import BridgeError

SCHEMA_VERSION = 3


class SQLiteTaskStore:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.database_path, timeout=30, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute("PRAGMA busy_timeout = 30000")
        try:
            yield connection
        finally:
            connection.close()

    def _initialize(self) -> None:
        with self._connection() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS bridge_meta (
                  key TEXT PRIMARY KEY,
                  value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS bridge_tasks (
                  task_id TEXT PRIMARY KEY,
                  lcos_run_id TEXT NOT NULL UNIQUE,
                  idempotency_key TEXT NOT NULL UNIQUE,
                  request_fingerprint TEXT NOT NULL,
                  payload_fingerprint TEXT NOT NULL,
                  contract_version TEXT NOT NULL,
                  output_intent TEXT NOT NULL DEFAULT 'revise',
                  provider TEXT NOT NULL,
                  task_type TEXT NOT NULL,
                  status TEXT NOT NULL,
                  envelope_json TEXT NOT NULL,
                  result_json TEXT,
                  external_task_id TEXT,
                  external_session_id TEXT,
                  provider_status TEXT,
                  claimed_by TEXT,
                  lease_expires_at TEXT,
                  last_heartbeat_at TEXT,
                  attempt_count INTEGER NOT NULL DEFAULT 0,
                  final_disposition TEXT,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_bridge_tasks_provider_status
                ON bridge_tasks(provider, status, created_at);
                """
            )

            columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(bridge_tasks)").fetchall()
            }
            if "output_intent" not in columns:
                self._backup_database(connection, suffix="v1")
                connection.execute(
                    "ALTER TABLE bridge_tasks ADD COLUMN output_intent TEXT NOT NULL DEFAULT 'revise'"
                )
            for name, definition in (
                ("lease_expires_at", "TEXT"),
                ("last_heartbeat_at", "TEXT"),
                ("attempt_count", "INTEGER NOT NULL DEFAULT 0"),
            ):
                if name not in columns:
                    connection.execute(f"ALTER TABLE bridge_tasks ADD COLUMN {name} {definition}")
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_bridge_tasks_intent_status "
                "ON bridge_tasks(output_intent, status, created_at)"
            )

            connection.execute(
                "INSERT INTO bridge_meta(key, value) VALUES('schema_version', ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (str(SCHEMA_VERSION),),
            )

    def _backup_database(self, connection: sqlite3.Connection, *, suffix: str) -> None:
        backup_path = self.database_path.with_suffix(self.database_path.suffix + f".{suffix}.bak")
        if backup_path.exists():
            return
        target = sqlite3.connect(backup_path)
        try:
            connection.backup(target)
        finally:
            target.close()

    def create_task(self, envelope: TaskEnvelopeV1) -> tuple[BridgeTask, bool]:
        task_id = task_id_for_run(envelope.lcos_run_id)
        payload_fingerprint = envelope.computed_payload_fingerprint()
        now = utc_now()
        with self._connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                row = connection.execute(
                    "SELECT * FROM bridge_tasks WHERE lcos_run_id = ? OR idempotency_key = ?",
                    (envelope.lcos_run_id, envelope.idempotency_key),
                ).fetchone()
                if row is not None:
                    task = self._row_to_task(row)
                    compatible = (
                        task.lcos_run_id == envelope.lcos_run_id
                        and task.idempotency_key == envelope.idempotency_key
                        and task.request_fingerprint == envelope.request_fingerprint
                        and task.payload_fingerprint == payload_fingerprint
                        and task.contract_version == envelope.contract_version
                    )
                    if not compatible:
                        raise BridgeError(
                            "IDEMPOTENCY_CONFLICT",
                            "The Run identity already exists with a different request fingerprint or payload.",
                            retryable=False,
                            http_status=409,
                        )
                    connection.execute("COMMIT")
                    return task, True

                connection.execute(
                    """
                    INSERT INTO bridge_tasks(
                      task_id, lcos_run_id, idempotency_key,
                      request_fingerprint, payload_fingerprint, contract_version,
                      output_intent, provider, task_type, status, envelope_json,
                      created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        task_id,
                        envelope.lcos_run_id,
                        envelope.idempotency_key,
                        envelope.request_fingerprint,
                        payload_fingerprint,
                        envelope.contract_version,
                        envelope.output_intent.value,
                        envelope.provider,
                        envelope.task_type,
                        ProviderStatus.QUEUED.value,
                        canonical_json(envelope.model_dump(mode="json", by_alias=True)),
                        now,
                        now,
                    ),
                )
                row = connection.execute(
                    "SELECT * FROM bridge_tasks WHERE task_id = ?", (task_id,)
                ).fetchone()
                connection.execute("COMMIT")
                assert row is not None
                return self._row_to_task(row), False
            except Exception:
                if connection.in_transaction:
                    connection.execute("ROLLBACK")
                raise

    def get_by_run_id(self, lcos_run_id: str) -> BridgeTask | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT * FROM bridge_tasks WHERE lcos_run_id = ?", (lcos_run_id,)
            ).fetchone()
        return None if row is None else self._row_to_task(row)

    def get(self, task_id: str) -> BridgeTask | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT * FROM bridge_tasks WHERE task_id = ?", (task_id,)
            ).fetchone()
        return None if row is None else self._row_to_task(row)

    def claim_next(self, provider: str, worker_id: str, lease_seconds: int = 120) -> BridgeTask | None:
        now = utc_now()
        expires = (datetime.now(timezone.utc) + timedelta(seconds=max(10, lease_seconds))).isoformat().replace("+00:00", "Z")
        with self._connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            try:
                row = connection.execute(
                    """
                    SELECT * FROM bridge_tasks
                    WHERE provider = ? AND (status = ? OR (status IN (?, ?) AND lease_expires_at < ?))
                    ORDER BY created_at ASC
                    LIMIT 1
                    """,
                    (provider, ProviderStatus.QUEUED.value, ProviderStatus.CLAIMED.value, ProviderStatus.RUNNING.value, now),
                ).fetchone()
                if row is None:
                    connection.execute("COMMIT")
                    return None
                connection.execute(
                    """
                    UPDATE bridge_tasks
                    SET status = ?, provider_status = ?, claimed_by = ?, lease_expires_at = ?,
                        last_heartbeat_at = ?, attempt_count = attempt_count + 1, updated_at = ?
                    WHERE task_id = ?
                    """,
                    (
                        ProviderStatus.CLAIMED.value,
                        ProviderStatus.CLAIMED.value,
                        worker_id,
                        expires, now, now,
                        row["task_id"],
                    ),
                )
                updated = connection.execute(
                    "SELECT * FROM bridge_tasks WHERE task_id = ?", (row["task_id"],)
                ).fetchone()
                connection.execute("COMMIT")
                assert updated is not None
                return self._row_to_task(updated)
            except Exception:
                if connection.in_transaction:
                    connection.execute("ROLLBACK")
                raise

    def heartbeat(self, task_id: str, worker_id: str, lease_seconds: int = 120) -> BridgeTask:
        task = self._require(task_id)
        if task.claimed_by != worker_id or task.status not in {ProviderStatus.CLAIMED, ProviderStatus.RUNNING}:
            raise BridgeError("LEASE_CONFLICT", "Task lease is not owned by this worker.", retryable=False, http_status=409)
        now = utc_now()
        expires = (datetime.now(timezone.utc) + timedelta(seconds=max(10, lease_seconds))).isoformat().replace("+00:00", "Z")
        with self._connection() as connection:
            connection.execute("UPDATE bridge_tasks SET last_heartbeat_at=?, lease_expires_at=?, updated_at=? WHERE task_id=?", (now, expires, now, task_id))
        return self._require(task_id)

    def mark_running(self, task_id: str, worker_id: str | None = None) -> BridgeTask:
        task = self._require(task_id)
        if task.status not in {ProviderStatus.QUEUED, ProviderStatus.CLAIMED}:
            raise BridgeError(
                "TASK_STATE_CONFLICT",
                f"Task {task_id} cannot enter running from {task.status}.",
                retryable=False,
                http_status=409,
            )
        if task.claimed_by is not None and worker_id != task.claimed_by:
            raise BridgeError("LEASE_CONFLICT", "Task lease is owned by another worker.", retryable=False, http_status=409)
        return self._update_status(
            task_id,
            ProviderStatus.RUNNING,
            provider_status=ProviderStatus.RUNNING.value,
            claimed_by=worker_id or task.claimed_by,
        )

    def submit_result(self, result: ResultEnvelope) -> BridgeTask:
        task = self._require(result.task_id)
        if task.lcos_run_id != result.lcos_run_id:
            raise BridgeError(
                "RESULT_IDENTITY_MISMATCH",
                "Result lcos_run_id does not match the Task.",
                retryable=False,
                http_status=409,
            )
        if task.status in {ProviderStatus.COMPLETED, ProviderStatus.CANCELLED}:
            if task.result == result:
                return task
            raise BridgeError(
                "TASK_STATE_CONFLICT",
                f"Task {task.task_id} is already terminal.",
                retryable=False,
                http_status=409,
            )

        if isinstance(task.envelope, TaskEnvelopeV1):
            if not isinstance(result, ResultEnvelopeV1):
                raise BridgeError(
                    "RESULT_CONTRACT_MISMATCH",
                    "A bridge-task-v1 Task requires bridge-result-v1.",
                    retryable=False,
                    http_status=400,
                )
            self._validate_v1_result(task.envelope, result)
        else:
            if not isinstance(result, ResultEnvelopeV0):
                raise BridgeError(
                    "RESULT_CONTRACT_MISMATCH",
                    "A legacy bridge-task-v0 Task requires bridge-result-v0.",
                    retryable=False,
                    http_status=400,
                )
            self._validate_v0_result(task.envelope, result)

        now = utc_now()
        with self._connection() as connection:
            connection.execute(
                """
                UPDATE bridge_tasks
                SET status = ?, provider_status = ?, result_json = ?, updated_at = ?
                WHERE task_id = ?
                """,
                (
                    result.provider_status,
                    result.provider_status,
                    canonical_json(result.model_dump(mode="json", by_alias=True)),
                    now,
                    task.task_id,
                ),
            )
        return self._require(task.task_id)

    def _validate_v0_result(
        self, envelope: TaskEnvelopeV0, result: ResultEnvelopeV0
    ) -> None:
        allowed = {path_key(item.absolute_path) for item in envelope.expected_outputs}
        returned = {path_key(item.path) for item in result.changed_files}
        if not returned.issubset(allowed):
            raise BridgeError(
                "UNEXPECTED_OUTPUT",
                "Legacy result contains a changed file outside expectedOutputs.",
                retryable=False,
                http_status=400,
            )
        if result.provider_status == "review" and not result.changed_files:
            raise BridgeError(
                "RESULT_EMPTY",
                "A legacy review result must contain at least one created file.",
                retryable=False,
                http_status=400,
            )

    def _validate_v1_result(
        self, envelope: TaskEnvelopeV1, result: ResultEnvelopeV1
    ) -> None:
        if result.provider_status != "review":
            return

        files = result.changed_files
        policy = envelope.output_policy
        if not files and not policy.allow_zero_files:
            raise BridgeError(
                "RESULT_EMPTY",
                f"{envelope.output_intent.value} intent requires at least one output file.",
                retryable=False,
                http_status=400,
            )
        if len(files) > policy.max_files:
            raise BridgeError(
                "RESULT_FILE_LIMIT_EXCEEDED",
                f"Result returned {len(files)} files; maxFiles is {policy.max_files}.",
                retryable=False,
                http_status=400,
            )

        for changed in files:
            if not path_is_within(changed.path, envelope.output_root):
                raise BridgeError(
                    "OUTPUT_ROOT_ESCAPE",
                    "Result contains a changed file outside outputRoot.",
                    retryable=False,
                    http_status=400,
                )

        if envelope.output_intent is OutputIntent.CREATE:
            if any(item.action is not ChangedFileAction.CREATED for item in files):
                raise BridgeError(
                    "RESULT_ACTION_INVALID",
                    "create intent only accepts action=created.",
                    retryable=False,
                    http_status=400,
                )
        elif envelope.output_intent is OutputIntent.REVISE:
            if len(files) != 1 or files[0].action is not ChangedFileAction.MODIFIED:
                raise BridgeError(
                    "RESULT_ACTION_INVALID",
                    "revise intent requires exactly one action=modified output.",
                    retryable=False,
                    http_status=400,
                )
        elif envelope.output_intent is OutputIntent.ANALYZE:
            if any(item.action is not ChangedFileAction.CREATED for item in files):
                raise BridgeError(
                    "RESULT_ACTION_INVALID",
                    "analyze file outputs, when present, must use action=created.",
                    retryable=False,
                    http_status=400,
                )

        matched_output_ids: set[str] = set()
        for changed in files:
            matched = self._match_expected(envelope.expected_outputs, changed.path, changed.role)
            if matched is None:
                if not policy.allow_additional_files:
                    raise BridgeError(
                        "UNEXPECTED_OUTPUT",
                        "Result contains a file not declared by expectedOutputs.",
                        retryable=False,
                        http_status=400,
                    )
                continue
            if matched.action is not changed.action:
                raise BridgeError(
                    "RESULT_ACTION_INVALID",
                    f"Output {matched.output_id!r} returned an unexpected action.",
                    retryable=False,
                    http_status=400,
                )
            matched_output_ids.add(matched.output_id)

        missing = [
            item.output_id
            for item in envelope.expected_outputs
            if item.required and item.output_id not in matched_output_ids
        ]
        if missing:
            raise BridgeError(
                "REQUIRED_OUTPUT_MISSING",
                f"Required outputs were not returned: {', '.join(missing)}.",
                retryable=False,
                http_status=400,
            )

    @staticmethod
    def _match_expected(
        expected_outputs: tuple[ExpectedOutputV1, ...],
        path: str,
        role: str | None,
    ) -> ExpectedOutputV1 | None:
        key = path_key(path)
        for expected in expected_outputs:
            if expected.absolute_path and path_key(expected.absolute_path) == key:
                return expected
        if role:
            role_key = role.casefold()
            for expected in expected_outputs:
                if expected.role.casefold() == role_key:
                    return expected
        return None

    def cancel(self, task_id: str) -> BridgeTask:
        task = self._require(task_id)
        if task.status == ProviderStatus.COMPLETED:
            raise BridgeError(
                "TASK_STATE_CONFLICT",
                "A completed Task cannot be cancelled.",
                retryable=False,
                http_status=409,
            )
        return self._update_status(
            task_id,
            ProviderStatus.CANCELLED,
            provider_status=ProviderStatus.CANCELLED.value,
            final_disposition="cancelled",
        )

    def finalize(self, task_id: str, decision: str) -> BridgeTask:
        task = self._require(task_id)
        if task.status not in {
            ProviderStatus.REVIEW,
            ProviderStatus.FAILED,
            ProviderStatus.TIMEOUT,
            ProviderStatus.CANCELLED,
            ProviderStatus.COMPLETED,
        }:
            raise BridgeError(
                "TASK_STATE_CONFLICT",
                f"Task {task_id} cannot be finalized from {task.status}.",
                retryable=False,
                http_status=409,
            )
        status = ProviderStatus.CANCELLED if decision == "cancelled" else ProviderStatus.COMPLETED
        return self._update_status(
            task_id,
            status,
            provider_status=task.provider_status,
            final_disposition=decision,
        )

    def _require(self, task_id: str) -> BridgeTask:
        task = self.get(task_id)
        if task is None:
            raise BridgeError(
                "TASK_NOT_FOUND",
                f"Task {task_id!r} was not found.",
                retryable=False,
                http_status=404,
            )
        return task

    def _update_status(
        self,
        task_id: str,
        status: ProviderStatus,
        *,
        provider_status: str | None,
        claimed_by: str | None = None,
        final_disposition: str | None = None,
    ) -> BridgeTask:
        now = utc_now()
        with self._connection() as connection:
            connection.execute(
                """
                UPDATE bridge_tasks
                SET status = ?, provider_status = ?, claimed_by = COALESCE(?, claimed_by),
                    final_disposition = COALESCE(?, final_disposition), updated_at = ?
                WHERE task_id = ?
                """,
                (status.value, provider_status, claimed_by, final_disposition, now, task_id),
            )
        return self._require(task_id)

    @staticmethod
    def _row_to_task(row: sqlite3.Row) -> BridgeTask:
        envelope = parse_task_envelope(json.loads(row["envelope_json"]))
        result = (
            None
            if row["result_json"] is None
            else parse_result_envelope(json.loads(row["result_json"]))
        )
        output_intent = row["output_intent"] if "output_intent" in row.keys() else envelope.output_intent
        return BridgeTask(
            taskId=row["task_id"],
            lcosRunId=row["lcos_run_id"],
            idempotencyKey=row["idempotency_key"],
            requestFingerprint=row["request_fingerprint"],
            payloadFingerprint=row["payload_fingerprint"],
            contractVersion=row["contract_version"],
            outputIntent=output_intent,
            provider=row["provider"],
            taskType=row["task_type"],
            status=row["status"],
            externalTaskId=row["external_task_id"],
            externalSessionId=row["external_session_id"],
            providerStatus=row["provider_status"],
            claimedBy=row["claimed_by"],
            leaseExpiresAt=row["lease_expires_at"],
            lastHeartbeatAt=row["last_heartbeat_at"],
            attemptCount=row["attempt_count"],
            finalDisposition=row["final_disposition"],
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
            envelope=envelope,
            result=result,
        )
