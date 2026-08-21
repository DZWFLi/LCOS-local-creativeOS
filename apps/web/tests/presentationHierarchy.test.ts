import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../src/model'
import { adjustHierarchyDepth, buildHierarchySeed, hierarchyRows, moveHierarchySubtreeAfter, moveHierarchySubtreeBefore, moveHierarchySubtreeBy, reparentHierarchyNode, toggleHierarchyCollapsed, visibleHierarchyRows, wouldCreateCycle } from '../src/features/presentation/presentationHierarchy'
import { layoutMindMap } from '../src/features/presentation/mindMapLayout'

const node=(id:string,createdAt:string):CanvasNode=>({id,kind:'source',title:id,subtitle:'',x:0,y:0,width:180,height:100,createdAt})
const nodes=[node('a','1'),node('b','2'),node('c','3'),node('d','4')]
const edges:CanvasEdge[]=[{id:'ab',from:'a',to:'b',kind:'reference'},{id:'bc',from:'b',to:'c',kind:'reference'}]

describe('Phase D shared Presentation hierarchy',()=>{
  it('seeds a deterministic tree projection without rewriting canonical relations',()=>{
    const state=buildHierarchySeed(nodes,edges)
    expect(state.orderIds).toEqual(['a','b','c','d'])
    expect(state.depthById).toMatchObject({a:0,b:1,c:2,d:0})
  })

  it('keeps collapse and subtree indentation structurally consistent',()=>{
    let state=buildHierarchySeed(nodes,edges)
    state=toggleHierarchyCollapsed(state,'b')
    expect(visibleHierarchyRows(nodes,state).map((row)=>row.id)).toEqual(['a','b','d'])
    state=toggleHierarchyCollapsed(state,'b')
    state=adjustHierarchyDepth(state,'d',1)
    expect(state.depthById.d).toBe(1)
  })

  it('moves whole subtrees instead of separating descendants',()=>{
    const state=moveHierarchySubtreeBefore(buildHierarchySeed(nodes,edges),'a','d')
    expect(state.orderIds).toEqual(['a','b','c','d']) // already before d
    const reverse=moveHierarchySubtreeBefore(buildHierarchySeed(nodes,edges),'d','a')
    expect(reverse.orderIds).toEqual(['d','a','b','c'])
  })


  it('moves a subtree only among siblings without reparenting it',()=>{
    const siblingNodes=[node('a','1'),node('b','2'),node('c','3'),node('d','4'),node('e','5')]
    const siblingEdges:CanvasEdge[]=[
      {id:'ab',from:'a',to:'b',kind:'reference'},
      {id:'ac',from:'a',to:'c',kind:'reference'},
      {id:'bd',from:'b',to:'d',kind:'reference'},
      {id:'ce',from:'c',to:'e',kind:'reference'},
    ]
    const state=buildHierarchySeed(siblingNodes,siblingEdges)
    expect(state.orderIds).toEqual(['a','b','d','c','e'])
    const moved=moveHierarchySubtreeBy(state,'c',-1)
    expect(moved.orderIds).toEqual(['a','c','e','b','d'])
    expect(moved.depthById.c).toBe(1)
    expect(moved.depthById.e).toBe(2)
  })


  it('does not silently reparent a subtree during drag reorder',()=>{
    const siblingNodes=[node('a','1'),node('b','2'),node('c','3'),node('d','4'),node('e','5')]
    const siblingEdges:CanvasEdge[]=[
      {id:'ab',from:'a',to:'b',kind:'reference'},
      {id:'ac',from:'a',to:'c',kind:'reference'},
      {id:'bd',from:'b',to:'d',kind:'reference'},
      {id:'ce',from:'c',to:'e',kind:'reference'},
    ]
    const state=buildHierarchySeed(siblingNodes,siblingEdges)
    expect(moveHierarchySubtreeBefore(state,'d','c')).toBe(state)
  })


  it('supports explicit after-drop sibling ordering without changing parent depth',()=>{
    const siblingNodes=[node('a','1'),node('b','2'),node('c','3'),node('d','4'),node('e','5')]
    const siblingEdges:CanvasEdge[]=[
      {id:'ab',from:'a',to:'b',kind:'reference'},
      {id:'ac',from:'a',to:'c',kind:'reference'},
      {id:'bd',from:'b',to:'d',kind:'reference'},
      {id:'ce',from:'c',to:'e',kind:'reference'},
    ]
    const state=buildHierarchySeed(siblingNodes,siblingEdges)
    const moved=moveHierarchySubtreeAfter(state,'b','c')
    expect(moved.orderIds).toEqual(['a','c','e','b','d'])
    expect(moved.depthById.b).toBe(1)
    expect(moved.depthById.d).toBe(2)
  })

  it('renders the same hierarchy as a bilateral mind map',()=>{
    const layout=layoutMindMap(nodes,buildHierarchySeed(nodes,edges))
    expect(layout.placements.map((item)=>item.id)).toHaveLength(nodes.length)
    expect(new Set(layout.placements.filter((item)=>item.parentId===null).map((item)=>item.side)).size).toBe(2)
  })

  it('reparents a whole subtree under a new parent (Phase 3 §6.6)', () => {
    const state = buildHierarchySeed(nodes, edges) // a(0) b(1) c(2) d(0)
    const next = reparentHierarchyNode(state, 'd', 'b')
    expect(next).not.toBeNull()
    expect(next!.orderIds).toEqual(['a', 'b', 'c', 'd'])
    expect(next!.depthById).toMatchObject({ a: 0, b: 1, c: 2, d: 2 })
    const parents = Object.fromEntries(hierarchyRows(nodes, next!).map((row) => [row.id, row.parentId]))
    expect(parents).toMatchObject({ b: 'a', c: 'b', d: 'b' })
  })

  it('rejects cycles, self-parenting and missing targets without partial mutation', () => {
    const state = buildHierarchySeed(nodes, edges)
    expect(wouldCreateCycle(state, 'b', 'c')).toBe(true) // c 是 b 的后代
    expect(reparentHierarchyNode(state, 'b', 'c')).toBeNull()
    expect(reparentHierarchyNode(state, 'a', 'a')).toBeNull()
    expect(reparentHierarchyNode(state, 'a', 'missing')).toBeNull()
    expect(state.orderIds).toEqual(['a', 'b', 'c', 'd'])
  })

  it('reorders within the same parent instead of double-indenting (Phase 3 §6.6)', () => {
    const state = buildHierarchySeed(nodes, edges)
    const next = reparentHierarchyNode(state, 'd', null, 'a')
    expect(next!.orderIds).toEqual(['d', 'a', 'b', 'c'])
    expect(next!.depthById.d).toBe(0)
  })
})
