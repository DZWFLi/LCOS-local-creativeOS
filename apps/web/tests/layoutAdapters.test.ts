import { describe, expect, it } from 'vitest'
import { createElkLayoutEngine } from '../src/features/layout/elkLayoutAdapter'
import { createFcoseLayoutEngine, fcoseOptions } from '../src/features/layout/fcoseLayoutAdapter'

const request={
  strategy:'layered' as const,
  nodes:[{id:'a',x:10,y:20,width:100,height:50,pinned:true},{id:'b',x:240,y:120,width:120,height:60}],
  edges:[{id:'ab',from:'a',to:'b'}],
  gap:30,
}

describe('Phase C external layout adapter boundaries',()=>{
  it('maps LCOS geometry to ELK and reasserts manual anchors after engine output',async()=>{
    let received:any
    const engine=createElkLayoutEngine({layout:async(graph)=>{received=graph;return{...graph,children:[{id:'a',x:999,y:999},{id:'b',x:420,y:160}]}}})
    const result=await engine.layout(request)
    expect(received.layoutOptions['elk.algorithm']).toBe('layered')
    expect(received.layoutOptions['elk.edgeRouting']).toBe('ORTHOGONAL')
    expect(result.positions.find((item)=>item.id==='a')).toMatchObject({x:10,y:20})
    expect(result.engine).toBe('elk')
  })

  it('emits official fCoSE fixed-node constraints and converts centers back to LCOS top-left positions',async()=>{
    const relational={...request,strategy:'relational' as const}
    const options=fcoseOptions(relational)
    expect(options.fixedNodeConstraint).toEqual([{nodeId:'a',position:{x:60,y:45}}])
    let received:any
    const engine=createFcoseLayoutEngine({run:async(input)=>{received=input;return{a:{x:900,y:900},b:{x:500,y:260}}}})
    const result=await engine.layout(relational)
    expect(received.options.randomize).toBe(false)
    expect(result.positions.find((item)=>item.id==='a')).toMatchObject({x:10,y:20})
    expect(result.positions.find((item)=>item.id==='b')!.x).toBeCloseTo(440)
    expect(result.engine).toBe('fcose')
  })
})
