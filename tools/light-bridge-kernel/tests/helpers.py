from __future__ import annotations

from lcos_bridge.canonical.models import ResultEnvelopeV1, TaskEnvelopeV1


def make_create_envelope(
    run_id: str = "run-create-1",
    fingerprint: str = "fp-create-1",
    *,
    expected_count: int = 1,
    allow_additional: bool = False,
    max_files: int = 5,
) -> TaskEnvelopeV1:
    expected = [
        {
            "outputId": f"deliverable-{index + 1}",
            "role": "script" if index == 0 else f"deliverable-{index + 1}",
            "action": "created",
            "absolutePath": f"C:\\demo\\{run_id}\\outputs\\file-{index + 1}.md",
            "mediaType": "text/markdown",
            "required": True,
        }
        for index in range(expected_count)
    ]
    return TaskEnvelopeV1.model_validate(
        {
            "contractVersion": "bridge-task-v1",
            "lcosRunId": run_id,
            "idempotencyKey": run_id,
            "requestFingerprint": fingerprint,
            "manifestId": f"manifest-{run_id}",
            "manifestHash": f"hash-{run_id}",
            "outputIntent": "create",
            "instructions": "Create the requested project deliverables.",
            "provider": "workbuddy",
            "taskType": "creative_run",
            "runtimeInputPackPath": f"C:\\demo\\{run_id}\\runtime-input-pack.json",
            "outputRoot": f"C:\\demo\\{run_id}\\outputs",
            "expectedOutputs": expected,
            "outputPolicy": {
                "allowZeroFiles": False,
                "allowAdditionalFiles": allow_additional,
                "maxFiles": max_files,
            },
            "timeoutSeconds": 900,
            "reportMode": "short",
        }
    )


def make_revise_envelope(
    run_id: str = "run-revise-1", fingerprint: str = "fp-revise-1"
) -> TaskEnvelopeV1:
    return TaskEnvelopeV1.model_validate(
        {
            "contractVersion": "bridge-task-v1",
            "lcosRunId": run_id,
            "idempotencyKey": run_id,
            "requestFingerprint": fingerprint,
            "manifestId": f"manifest-{run_id}",
            "manifestHash": f"hash-{run_id}",
            "outputIntent": "revise",
            "instructions": "Revise the selected script without overwriting its source file.",
            "provider": "workbuddy",
            "taskType": "creative_run",
            "runtimeInputPackPath": f"C:\\demo\\{run_id}\\runtime-input-pack.json",
            "outputRoot": f"C:\\demo\\{run_id}\\outputs",
            "expectedOutputs": [
                {
                    "outputId": "revised-script",
                    "role": "revised_script",
                    "action": "modified",
                    "absolutePath": f"C:\\demo\\{run_id}\\outputs\\script-revised.md",
                    "mediaType": "text/markdown",
                    "required": True,
                }
            ],
            "outputPolicy": {
                "allowZeroFiles": False,
                "allowAdditionalFiles": False,
                "maxFiles": 1,
            },
        }
    )


def make_analyze_envelope(
    run_id: str = "run-analyze-1", fingerprint: str = "fp-analyze-1"
) -> TaskEnvelopeV1:
    return TaskEnvelopeV1.model_validate(
        {
            "contractVersion": "bridge-task-v1",
            "lcosRunId": run_id,
            "idempotencyKey": run_id,
            "requestFingerprint": fingerprint,
            "manifestId": f"manifest-{run_id}",
            "manifestHash": f"hash-{run_id}",
            "outputIntent": "analyze",
            "instructions": "Analyze the project context and return structured conclusions.",
            "provider": "workbuddy",
            "taskType": "creative_run",
            "runtimeInputPackPath": f"C:\\demo\\{run_id}\\runtime-input-pack.json",
            "outputRoot": f"C:\\demo\\{run_id}\\outputs",
            "expectedOutputs": [],
            "outputPolicy": {
                "allowZeroFiles": True,
                "allowAdditionalFiles": True,
                "maxFiles": 5,
            },
        }
    )


def make_create_result(task_id: str, run_id: str = "run-create-1", count: int = 1) -> ResultEnvelopeV1:
    return ResultEnvelopeV1.model_validate(
        {
            "contractVersion": "bridge-result-v1",
            "taskId": task_id,
            "lcosRunId": run_id,
            "providerStatus": "review",
            "summary": "Created the requested deliverables.",
            "changedFiles": [
                {
                    "path": f"C:\\demo\\{run_id}\\outputs\\file-{index + 1}.md",
                    "action": "created",
                    "role": "script" if index == 0 else f"deliverable-{index + 1}",
                    "mediaType": "text/markdown",
                }
                for index in range(count)
            ],
            "warnings": [],
            "suggestedNextActions": ["Review the returned files."],
        }
    )


def make_revise_result(task_id: str, run_id: str = "run-revise-1") -> ResultEnvelopeV1:
    return ResultEnvelopeV1.model_validate(
        {
            "contractVersion": "bridge-result-v1",
            "taskId": task_id,
            "lcosRunId": run_id,
            "providerStatus": "review",
            "summary": "Revised the script in an isolated output file.",
            "changedFiles": [
                {
                    "path": f"C:\\demo\\{run_id}\\outputs\\script-revised.md",
                    "action": "modified",
                    "role": "revised_script",
                    "mediaType": "text/markdown",
                }
            ],
        }
    )


def make_analyze_result(task_id: str, run_id: str = "run-analyze-1") -> ResultEnvelopeV1:
    return ResultEnvelopeV1.model_validate(
        {
            "contractVersion": "bridge-result-v1",
            "taskId": task_id,
            "lcosRunId": run_id,
            "providerStatus": "review",
            "summary": "The script lacks a clear conflict in the second act.",
            "changedFiles": [],
            "warnings": ["No project files were created."],
            "suggestedNextActions": ["Create a revision task for act two."],
        }
    )
