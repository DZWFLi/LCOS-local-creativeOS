import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../src/model'
import { buildLocalRelationNodes, relationCurvePath } from '../src/features/presentation/relationGraphModel'
import { applyContextStrandPositions, layoutContextStrands } from '../src/features/presentation/contextStrands'

const node=(id:string,createdAt:string):CanvasNode=>({id,kind:'source',title:id,subtitle:'',x:0,y:0,width:180,height:100,createdAt})
const nodes=[node('a','1'),node('b','2'),node('c','3'),node('d','4'),node('e','5')]
const edges:CanvasEdge[]=[{id:'ab',from:'a',to:'b',kind:'reference'},{id:'bc',from:'b',to:'c',kind:'feedback'},{id:'de',from:'d',to:'e',kind:'modify'}]

describe('Phase D Context renderer models',()=>{
  it('uses Selection only as Local Graph focus and supports multiple centers',()=>{
    const local=buildLocalRelationNodes(nodes,edges,['a','c'],1)
    expect(local.filter((item)=>item.ring===0).map((item)=>item.node.id)).toEqual(['a','c'])
    expect(local.some((item)=>item.node.id==='d')).toBe(false)
  })

  it('keeps local graph depth bounded by hop preference',()=>{
    expect(buildLocalRelationNodes(nodes,edges,['a'],1).map((item)=>item.node.id)).toEqual(['a','b'])
    expect(buildLocalRelationNodes(nodes,edges,['a'],2).map((item)=>item.node.id)).toEqual(['a','b','c'])
  })

  it('routes relation edges as curves instead of center-to-center straight lines',()=>{
    expect(relationCurvePath({x:0,y:0},{x:100,y:40})).toContain(' Q ')
  })


  it('supports Presentation-only strand splice/cut by changing only renderer edge input',()=>{
    const baseEdges:CanvasEdge[]=[{id:'ab',from:'a',to:'b',kind:'reference'},{id:'de',from:'d',to:'e',kind:'modify'}]
    expect(layoutContextStrands(nodes,baseEdges).strands).toHaveLength(3)
    const temporary:CanvasEdge={id:'context-temp:b:d',from:'b',to:'d',kind:'reference'}
    expect(layoutContextStrands(nodes,[...baseEdges,temporary]).strands).toHaveLength(2)
    expect(layoutContextStrands(nodes,baseEdges.filter((edge)=>edge.id!=='ab')).strands.length).toBeGreaterThan(3)
  })

  it('moves one strand as Presentation geometry without changing its object membership',()=>{
    const layout=layoutContextStrands(nodes,edges)
    const first=layout.strands[0]!
    const moved=applyContextStrandPositions(layout,{[first.id]:{x:first.x+80,y:first.y+35}})
    const before=layout.items.find((item)=>item.strand===first.index)!
    const after=moved.items.find((item)=>item.node.id===before.node.id)!
    expect(after.x-before.x).toBe(80)
    expect(after.y-before.y).toBe(35)
    expect(moved.strands[0]?.objectIds).toEqual(first.objectIds)
  })

  it('derives parallel Context strands from relation components',()=>{
    const layout=layoutContextStrands(nodes,edges)
    expect(layout.strands).toHaveLength(2)
    expect(layout.items).toHaveLength(5)
    expect(layout.edges).toHaveLength(3)
  })
})
