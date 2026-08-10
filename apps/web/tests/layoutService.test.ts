import { describe, expect, it } from 'vitest'
import { layoutConnectedComponents } from '../src/features/layout/layoutGraph'
import { layoutPreviewSync } from '../src/features/layout/layoutService'
import type { LayoutNodeInput } from '../src/features/layout/layoutTypes'

const node=(id:string,x:number,y:number,pinned=false):LayoutNodeInput=>({id,x,y,width:120,height:60,pinned})

describe('Phase C layout service',()=>{
  it('detects relation components without inventing node families',()=>{
    const nodes=[node('a',0,0),node('b',200,0),node('c',900,0)]
    const components=layoutConnectedComponents(nodes,[{id:'ab',from:'a',to:'b'}])
    expect(components.map((component)=>component.nodes.map((item)=>item.id))).toEqual([['a','b'],['c']])
  })

  it('uses manual mode as collision repair only when no relation structure exists',()=>{
    const nodes=[node('a',100,100),node('b',110,110)]
    const result=layoutPreviewSync({nodes,edges:[],strategy:'manual',gap:28})
    expect(result.engine).toBe('manual')
    expect(result.movedIds.length).toBeGreaterThan(0)
    expect(result.componentCount).toBe(2)
  })

  it('lays directed relations left-to-right while preserving an explicit anchor',()=>{
    const nodes=[node('input',100,240,true),node('run',360,110),node('output',650,320)]
    const result=layoutPreviewSync({nodes,edges:[{id:'1',from:'input',to:'run'},{id:'2',from:'run',to:'output'}],strategy:'layered',origin:{x:100,y:100}})
    const positions=new Map(result.positions.map((item)=>[item.id,item]))
    expect(positions.get('input')).toMatchObject({x:100,y:240})
    expect(positions.get('run')!.x).toBeGreaterThan(positions.get('input')!.x)
    expect(positions.get('output')!.x).toBeGreaterThan(positions.get('run')!.x)
    expect(result.routes[0]!.points.length).toBe(4)
  })

  it('keeps disconnected components separated after packing',()=>{
    const nodes=[node('a',0,0),node('b',20,0),node('c',0,20),node('d',20,20)]
    const result=layoutPreviewSync({nodes,edges:[{id:'ab',from:'a',to:'b'},{id:'cd',from:'c',to:'d'}],strategy:'layered',componentGap:140})
    const positions=new Map(result.positions.map((item)=>[item.id,item]))
    const firstRight=Math.max(positions.get('a')!.x+120,positions.get('b')!.x+120)
    const secondLeft=Math.min(positions.get('c')!.x,positions.get('d')!.x)
    const secondRight=Math.max(positions.get('c')!.x+120,positions.get('d')!.x+120)
    const firstLeft=Math.min(positions.get('a')!.x,positions.get('b')!.x)
    expect(secondLeft>firstRight||firstLeft>secondRight||Math.abs(positions.get('c')!.y-positions.get('a')!.y)>80).toBe(true)
  })

  it('uses incremental relational layout and never moves the focus anchor',()=>{
    const nodes=[node('focus',600,360,true),node('a',820,360),node('b',600,560),node('c',380,360)]
    const result=layoutPreviewSync({nodes,edges:[{id:'1',from:'focus',to:'a'},{id:'2',from:'focus',to:'b'},{id:'3',from:'focus',to:'c'}],strategy:'relational'})
    const focus=result.positions.find((item)=>item.id==='focus')!
    expect(focus).toMatchObject({x:600,y:360})
    expect(result.positions.every((item)=>Number.isFinite(item.x)&&Number.isFinite(item.y))).toBe(true)
  })
})
