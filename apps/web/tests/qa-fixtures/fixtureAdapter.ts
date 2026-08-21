import type { ExecutionRuntimeContract, PreviewContract, Result, WorkspaceQueryContract } from '@local-creative-os/contracts'
import type { ArtifactViewId } from '@local-creative-os/domain'
import { fixtureWorkspaces } from './fixtures'
import type { Camera, Workspace as UiWorkspace } from '../../src/model'

type WorkspaceQuery = Parameters<WorkspaceQueryContract['getWorkspaces']>[0]
type WorkspaceResult = Awaited<ReturnType<WorkspaceQueryContract['getWorkspaces']>>
type WorkspaceCommand = Parameters<WorkspaceQueryContract['updateViewport']>[0]
type WorkspaceContract = Extract<WorkspaceResult, { ok: true }>['value'][number]
type PreviewResult = Awaited<ReturnType<PreviewContract['getPreview']>>
type RunResult = Awaited<ReturnType<ExecutionRuntimeContract['getRun']>>

export const fixtureProjectId = 'fixture-project' as WorkspaceQuery['projectId']
const now = () => new Date().toISOString()

function toContractWorkspace(workspace: UiWorkspace): WorkspaceContract {
  return {
    id: workspace.id as WorkspaceCommand['workspaceId'],
    projectId: fixtureProjectId,
    scopeId: workspace.scopeId as WorkspaceContract['scopeId'],
    name: workspace.label,
    intent: workspace.intent,
    viewport: workspace.camera,
    focusedViewIds: workspace.focusedViewIds.map((id) => id as ArtifactViewId),
    visibleLayers: workspace.visibleLayers,
    contextPolicy: workspace.contextPolicy ?? 'selection-only',
    updatedAt: now(),
  } as WorkspaceContract
}

function ok<Value>(value: Value): Result<Value> { return { ok: true, value } }

function fixtureError(code: 'FIXTURE_ONLY' | 'UNAVAILABLE', message: string): Result<never> {
  return { ok: false, error: { code, message, retryable: false, origin: 'fixture' } }
}

export interface FrontendAdapter {
  readonly origin: 'fixture'
  readonly projectId: WorkspaceQuery['projectId']
  readonly workspace: Pick<WorkspaceQueryContract, 'getWorkspaces' | 'updateViewport'>
  readonly preview: Pick<PreviewContract, 'getPreview'>
  readonly runtime: Pick<ExecutionRuntimeContract, 'getRun' | 'retryRun'>
}

export function toUiWorkspace(workspace: WorkspaceContract): UiWorkspace {
  return { id: String(workspace.id), label: workspace.name, intent: workspace.intent, scopeId: 'scope-root', camera: workspace.viewport, visibleLayers: workspace.visibleLayers.filter((layer): layer is 'core' | 'process' => layer === 'core' || layer === 'process'), focusedViewIds: workspace.focusedViewIds.map(String), contextPolicy: 'workspace-related', createdAt: workspace.updatedAt, updatedAt: workspace.updatedAt }
}

function createFixtureWorkspaceAdapter(): FrontendAdapter['workspace'] {
  return {
    async getWorkspaces(query: WorkspaceQuery): Promise<WorkspaceResult> {
      if (query.projectId !== fixtureProjectId) return fixtureError('FIXTURE_ONLY', 'Fixture adapter only serves the local prototype project')
      const values = fixtureWorkspaces.map(toContractWorkspace)
      return ok(query.workspaceId ? values.filter((workspace) => workspace.id === query.workspaceId) : values)
    },
    async updateViewport(command: WorkspaceCommand) {
      const workspace = fixtureWorkspaces.find((item) => item.id === command.workspaceId)
      if (!workspace) return fixtureError('UNAVAILABLE', 'Fixture Workspace not found')
      return ok(toContractWorkspace({ ...workspace, camera: command.viewport as Camera }))
    },
  }
}

function createFixturePreviewAdapter(): FrontendAdapter['preview'] {
  return {
    async getPreview(artifactId, kind, pageIndex): Promise<PreviewResult> {
      return ok({ artifactId, kind, state: 'ready', origin: 'fixture', pageIndex, pageCount: kind === 'page' ? 12 : undefined })
    },
  }
}

function createFixtureRuntimeAdapter(): FrontendAdapter['runtime'] {
  return {
    async getRun(runId): Promise<RunResult> {
      return fixtureError('FIXTURE_ONLY', `Run ${String(runId)} is represented by the in-memory UI lifecycle`)
    },
    async retryRun(runId): Promise<RunResult> {
      return fixtureError('FIXTURE_ONLY', `Retry ${String(runId)} remains a frontend Fixture action`)
    },
  }
}

export function createFixtureFrontendAdapter(): FrontendAdapter {
  return { origin: 'fixture', projectId: fixtureProjectId, workspace: createFixtureWorkspaceAdapter(), preview: createFixturePreviewAdapter(), runtime: createFixtureRuntimeAdapter() }
}
