import type { CanvasNode } from '../../model'

export type ProjectRelationEndpointType = 'artifact' | 'view' | 'note' | 'scope' | 'workspace'

export interface ProjectRelationEndpoint {
  readonly entityType: ProjectRelationEndpointType
  readonly entityId: string
}

const AGGREGATE_SCOPE_ENTITY_KINDS = new Set<CanvasNode['entityKind']>(['collection', 'context', 'workflow'])

/**
 * Resolve one visible Project object into its canonical Relation endpoint.
 *
 * Physical node identity and persisted Relation identity are deliberately not
 * assumed to be the same: a Collection/Context/Workflow container can be
 * rendered through an ArtifactView body while canonically representing Scope.
 * Conversation is admitted only through its canonical Artifact identity; receiver/context
 * mapping identities remain separate and are never inferred here.
 */
export function projectRelationEndpointForNode(node: CanvasNode): ProjectRelationEndpoint | null {
  if (node.entityKind === 'conversation') {
    const conversationArtifactId = node.conversation?.conversationArtifactId?.trim()
    return conversationArtifactId ? { entityType: 'artifact', entityId: conversationArtifactId } : null
  }
  if (node.kind === 'note' && !node.artifactId) {
    return node.anchors?.length ? { entityType: 'note', entityId: node.id } : null
  }
  if (node.id.startsWith('workspace:')) {
    const entityId = node.id.slice('workspace:'.length).trim()
    return entityId ? { entityType: 'workspace', entityId } : null
  }
  if (node.id.startsWith('scope:')) {
    const entityId = node.id.slice('scope:'.length).trim()
    return entityId ? { entityType: 'scope', entityId } : null
  }
  if (node.opensScopeId && AGGREGATE_SCOPE_ENTITY_KINDS.has(node.entityKind)) {
    return { entityType: 'scope', entityId: node.opensScopeId }
  }
  return node.id.trim() ? { entityType: 'view', entityId: node.id } : null
}

export function projectRelationEndpointForNodeId(nodeId: string, nodes: readonly CanvasNode[]): ProjectRelationEndpoint | null {
  const node = nodes.find((item) => item.id === nodeId)
  return node ? projectRelationEndpointForNode(node) : null
}

export function isProjectRelationEligible(node: CanvasNode): boolean {
  return projectRelationEndpointForNode(node) !== null
}
