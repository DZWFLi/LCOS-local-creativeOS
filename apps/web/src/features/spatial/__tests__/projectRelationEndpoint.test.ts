import { describe, expect, it } from 'vitest'
import type { CanvasNode } from '../../../model'
import { projectRelationEndpointForNode, projectRelationEndpointForNodeId } from '../projectRelationEndpoint'

const node = (input: Partial<CanvasNode> & Pick<CanvasNode, 'id'>): CanvasNode => ({
  kind: input.kind ?? 'source',
  title: input.title ?? input.id,
  subtitle: input.subtitle ?? '',
  x: input.x ?? 0,
  y: input.y ?? 0,
  width: input.width ?? 220,
  height: input.height ?? 120,
  displayMode: input.displayMode ?? 'standard',
  ...input,
})

describe('projectRelationEndpointForNode', () => {
  it('keeps ordinary material on its canonical view endpoint', () => {
    expect(projectRelationEndpointForNode(node({ id: 'view-1' }))).toEqual({ entityType: 'view', entityId: 'view-1' })
  })


  it('keeps anchored Core Note on canonical note truth and fails closed for local-only note shells', () => {
    expect(projectRelationEndpointForNode(node({ id: 'note-1', kind: 'note', anchors: [{ type: 'project' }] }))).toEqual({ entityType: 'note', entityId: 'note-1' })
    expect(projectRelationEndpointForNode(node({ id: 'note-local', kind: 'note' }))).toBeNull()
  })

  it('canonicalizes aggregate container views to their Scope truth', () => {
    expect(projectRelationEndpointForNode(node({ id: 'container-view', entityKind: 'context', opensScopeId: 'scope-context' }))).toEqual({ entityType: 'scope', entityId: 'scope-context' })
  })

  it('canonicalizes explicit scope/workspace projections without treating presentation ids as views', () => {
    expect(projectRelationEndpointForNode(node({ id: 'scope:scope-1', entityKind: 'workflow', opensScopeId: 'scope-1' }))).toEqual({ entityType: 'scope', entityId: 'scope-1' })
    expect(projectRelationEndpointForNode(node({ id: 'workspace:ws-1', entityKind: 'workspace' }))).toEqual({ entityType: 'workspace', entityId: 'ws-1' })
  })

  it('keeps Conversation ordinary Relation fail-close', () => {
    expect(projectRelationEndpointForNode(node({ id: 'conversation-view', entityKind: 'conversation' }))).toBeNull()
  })

  it('fails closed for an id that is not one of the actual projected nodes', () => {
    expect(projectRelationEndpointForNodeId('scope:ghost', [node({ id: 'view-1' })])).toBeNull()
  })
})
