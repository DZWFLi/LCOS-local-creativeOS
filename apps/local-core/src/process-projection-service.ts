import type { ProjectId } from '@local-creative-os/domain'

import type { SqliteMetadataRepository } from './metadata-repository.js'

export interface ProcessProjectionNode {
  readonly kind: 'run' | 'return' | 'revision' | 'checkpoint'
  readonly id: string
  readonly summary: string
  readonly status: string
  readonly createdAt: string
}

/**
 * Process Projection（4.8/6.4）：从既有真相投影过程视图，不建平行存储。
 */
export class ProcessProjectionService {
  constructor(private readonly repository: SqliteMetadataRepository) {}

  project(projectId: ProjectId): readonly ProcessProjectionNode[] {
    const nodes: ProcessProjectionNode[] = []
    const runs = this.repository.getProjectRuns(projectId, 100)
    for (const run of runs) {
      nodes.push({
        kind: 'run',
        id: String(run.id),
        summary: run.instruction.slice(0, 80),
        status: run.status,
        createdAt: run.createdAt,
      })
      const returns = this.repository.getArtifactReturns(run.id)
      for (const artifactReturn of returns) {
        nodes.push({
          kind: 'return',
          id: String(artifactReturn.id),
          summary: `${artifactReturn.action} · ${artifactReturn.status}`,
          status: artifactReturn.status,
          createdAt: artifactReturn.createdAt,
        })
      }
    }
    const artifacts = this.repository.getArtifacts(String(projectId))
    for (const artifact of artifacts) {
      for (const revision of this.repository.getArtifactRevisions(String(artifact.id)).slice(-6)) {
        nodes.push({
          kind: 'revision',
          id: String(revision.id),
          summary: `${artifact.title} · ${revision.status}${revision.runId === undefined ? '' : ` · ${String(revision.runId)}`}`,
          status: revision.status,
          createdAt: revision.createdAt,
        })
      }
    }
    for (const checkpoint of this.repository.getCheckpoints(String(projectId))) {
      nodes.push({
        kind: 'checkpoint',
        id: String(checkpoint.id),
        summary: checkpoint.label,
        status: 'saved',
        createdAt: checkpoint.createdAt,
      })
    }
    return nodes.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }
}
