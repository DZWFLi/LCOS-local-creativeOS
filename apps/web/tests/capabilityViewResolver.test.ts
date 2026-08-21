import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../src/model'
import { resolveContextView, resolveWorkflowView } from '../src/features/surfaces/capabilityViewResolver'

const node = (id: string, kind: CanvasNode['kind'] = 'source', scopeId?: string): CanvasNode => ({ id, kind, title: id, subtitle: '', x: 0, y: 0, width: 180, height: 100, ...(scopeId ? { scopeId } : {}) })
const edges: CanvasEdge[] = [
  { id: 'a-b', from: 'a', to: 'b', kind: 'reference' },
  { id: 'b-run', from: 'b', to: 'run', kind: 'generate' },
  { id: 'run-output', from: 'run', to: 'output', kind: 'generate' },
]
const nodes = [node('a'), node('b'), node('run', 'process'), node('output', 'generated'), node('unrelated')]

describe('capability view resolver', () => {
  it('keeps Context history bound to one explicit source', () => {
    const view = resolveContextView(nodes, edges, {}, [{ id: 'history', label: 'H1', title: 'Imported conversation', current: true, objectIds: ['a', 'b'] }])
    expect(view.sourceKind).toBe('conversation')
    expect(view.nodes.map((item) => item.id)).toEqual(['a', 'b'])
    expect(view.edges.map((item) => item.id)).toEqual(['a-b'])
  })

  it('uses explicitly committed objects plus one hop without swallowing the project', () => {
    const view = resolveContextView(nodes, edges, { explicitObjectIds: ['a'], includeOneHop: true }, [])
    expect(view.sourceKind).toBe('selection')
    expect(view.nodes.map((item) => item.id)).toEqual(['a', 'b'])
    expect(view.nodes.some((item) => item.id === 'unrelated')).toBe(false)
  })

  it('does not invent Workflow members from process nodes', () => {
    const view = resolveWorkflowView(nodes, edges, {})
    expect(view.sourceKind).toBe('empty')
    expect(view.nodes).toEqual([])
  })

  it('returns honest empty views when there is no explicit source', () => {
    expect(resolveContextView([node('a')], [], {}, []).sourceKind).toBe('empty')
    expect(resolveWorkflowView([node('a')], [], {}).sourceKind).toBe('empty')
  })

  it('lets explicit user or Agent intent override heuristics without expanding membership', () => {
    const view = resolveContextView(nodes, edges, { explicitViewIds: ['a', 'output'] }, [{ id: 'history', label: 'H1', title: 'Imported conversation', current: true, objectIds: ['b'] }])
    expect(view.sourceKind).toBe('explicit')
    expect(view.nodes.map((item) => item.id)).toEqual(['a', 'output'])
    expect(view.edges).toEqual([])
  })

  it('treats Workspace focus as a fallback presentation, not project truth', () => {
    const view = resolveWorkflowView(nodes, edges, { workspaceFocusIds: ['b'] })
    expect(view.sourceKind).toBe('workspace')
    expect(view.nodes.map((item) => item.id)).toEqual(['b'])
  })
  it('resolves exact Context and Workflow members across physical Scope boundaries', () => {
    const crossScopeNodes = [
      node('root-a', 'source', 'scope-root'),
      node('collection-b', 'source', 'scope-collection'),
      node('context-c', 'source', 'scope-context'),
      node('other', 'source', 'scope-other'),
    ]
    const crossScopeEdges: CanvasEdge[] = [
      { id: 'a-b', from: 'root-a', to: 'collection-b', kind: 'reference' },
      { id: 'b-c', from: 'collection-b', to: 'context-c', kind: 'reference' },
      { id: 'c-other', from: 'context-c', to: 'other', kind: 'reference' },
    ]
    const exact = ['root-a', 'collection-b', 'context-c']
    expect(resolveContextView(crossScopeNodes, crossScopeEdges, { explicitViewIds: exact }, []).nodes.map((item) => item.id)).toEqual(exact)
    expect(resolveWorkflowView(crossScopeNodes, crossScopeEdges, { explicitViewIds: exact }).nodes.map((item) => item.id)).toEqual(exact)
  })

  it('treats an explicitly empty Presentation as authoritative instead of falling back', () => {
    const context = resolveContextView(nodes, edges, { explicitViewIds: [], workspaceFocusIds: ['b'] }, [{ id: 'history', label: 'H1', title: 'Old history', current: true, objectIds: ['a'] }])
    expect(context.sourceKind).toBe('explicit')
    expect(context.nodes).toEqual([])

    const workflow = resolveWorkflowView(nodes, edges, { explicitViewIds: [], workspaceFocusIds: ['b'] })
    expect(workflow.sourceKind).toBe('explicit')
    expect(workflow.nodes).toEqual([])
  })

})
