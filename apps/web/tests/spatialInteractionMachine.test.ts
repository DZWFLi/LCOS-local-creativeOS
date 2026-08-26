import { describe, expect, it } from 'vitest'
import { advanceSpatialMarquee, advanceSpatialNodeDrag, advanceSpatialPan, beginSpatialMarquee, beginSpatialNodeDrag, beginSpatialPan, spatialMarqueeRect } from '../src/features/spatial/spatialInteractionMachine'

describe('shared spatial pointer sessions',()=>{
  it('keeps middle-pan camera math in one state machine',()=>{
    const session=beginSpatialPan(4,{x:100,y:120},{x:20,y:30,zoom:1})
    expect(advanceSpatialPan(session,{x:140,y:90})).toEqual({x:60,y:0,zoom:1})
  })

  it('arms marquee only after the shared threshold',()=>{
    const start=beginSpatialMarquee(1,{x:10,y:10})
    const quiet=advanceSpatialMarquee(start,{x:13,y:12},4)
    expect(spatialMarqueeRect(quiet)).toBeNull()
    const moved=advanceSpatialMarquee(quiet,{x:24,y:30},4)
    expect(spatialMarqueeRect(moved)).toEqual({left:10,top:10,width:14,height:20})
  })

  it('translates node drag deltas by camera zoom (startZoom 冻结：拖拽中相机缩放不改变位移比例)',()=>{
    // 拖拽漂移修复后的契约：beginSpatialNodeDrag 第 5 参冻结起始 zoom，
    // advance 不再收实时 zoom——拖拽中滚轮缩放不会让节点漂移。
    const drag=beginSpatialNodeDrag(2,'a',{x:100,y:100},{x:400,y:300},.5)
    expect(advanceSpatialNodeDrag(drag,{x:140,y:120})).toEqual({x:480,y:340})
  })

  it('advance 对非拖拽会话返回 null（防御：marquee/pan 会话不误走节点位移分支）',()=>{
    const session=beginSpatialPan(3,{x:0,y:0},{x:0,y:0,zoom:1})
    expect(advanceSpatialNodeDrag(session,{x:10,y:10})).toBeNull()
  })
})
