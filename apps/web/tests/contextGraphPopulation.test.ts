import { describe, expect, it } from 'vitest'
import type { CanvasNode, CanvasScope } from '../src/model'
import { deriveContextGraphAutoNodeIds, mergeContextGraphNodeIds } from '../src/features/context/contextGraphPopulation'

const root = 'scope-root'
const base = (id: string, title: string, extra: Partial<CanvasNode> = {}): CanvasNode => ({
  id,
  kind: 'source',
  title,
  subtitle: '',
  x: 0,
  y: 0,
  width: 200,
  height: 120,
  scopeId: root,
  ...extra,
})

const scopes: CanvasScope[] = [
  { id: root, label: 'Root', kind: 'root', parentScopeId: null, camera: { x: 0, y: 0, zoom: 1 } },
  { id: 'context-a', label: 'Context A', kind: 'context', parentScopeId: root, containerNodeId: 'ctx-node', camera: { x: 0, y: 0, zoom: 1 } },
  { id: 'collection-a', label: 'Collection A', kind: 'collection', parentScopeId: root, containerNodeId: 'collection-node', camera: { x: 0, y: 0, zoom: 1 } },
]

describe('Context Graph automatic project population', () => {
  it('surfaces saved Context entities, Brief/stage objects and Decisions project-wide without turning every file into graph noise', () => {
    const ids = deriveContextGraphAutoNodeIds([
      base('brief', 'Project Brief'),
      base('stage', '当前阶段'),
      base('decision', '已确认方向', { kind: 'decision' }),
      base('ctx-node', 'Context A', { kind: 'context', opensScopeId: 'context-a' }),
      base('collection-node', '素材集合', { kind: 'context', opensScopeId: 'collection-a' }),
      base('ordinary', '普通脚本.md'),
      base('nested', 'Brief in child', { scopeId: 'collection-a' }),
    ], scopes, root)
    expect(ids).toEqual(['brief', 'stage', 'decision', 'ctx-node', 'collection-node', 'nested'])
  })

  it('unions explicit user placement, auto population and all saved Context containers', () => {
    expect(mergeContextGraphNodeIds(['manual'], ['brief', 'manual'], ['ctx-a', 'ctx-b'])).toEqual(['manual', 'brief', 'ctx-a', 'ctx-b'])
  })
})
