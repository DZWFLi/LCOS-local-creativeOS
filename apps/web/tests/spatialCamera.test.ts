import { describe, expect, it } from 'vitest'
import { applySpatialWheelGesture, edgeScrollDelta, fitSpatialBounds, spatialScreenToWorld, spatialWorldToScreen } from '../src/features/spatial/spatialCamera'
import { spatialDensityForSize, spatialLodForCount } from '../src/features/spatial/spatialLod'

const camera={x:120,y:80,zoom:.8}

describe('shared spatial camera',()=>{
  it('round-trips screen and world coordinates',()=>{
    const rect={left:20,top:30} as DOMRect
    const world=spatialScreenToWorld(420,330,rect,camera)
    const screen=spatialWorldToScreen(world,camera)
    expect(screen.x).toBeCloseTo(400)
    expect(screen.y).toBeCloseTo(300)
  })

  it('keeps two-finger pan separate from zoom',()=>{
    expect(applySpatialWheelGesture(camera,{deltaX:24,deltaY:-36,zoom:false,anchorX:0,anchorY:0})).toEqual({x:108,y:98,zoom:.8})
  })

  it('returns symmetric edge-scroll pressure',()=>{
    expect(edgeScrollDelta({x:8,y:400},{left:0,right:1000,top:0,bottom:800},96,18).x).toBeGreaterThan(0)
    expect(edgeScrollDelta({x:992,y:400},{left:0,right:1000,top:0,bottom:800},96,18).x).toBeLessThan(0)
  })

  it('fits bounds without exceeding the shared zoom clamp',()=>{
    const next=fitSpatialBounds({x:0,y:0,width:2400,height:1200},1200,800)
    expect(next.zoom).toBeGreaterThanOrEqual(.02)
    expect(next.zoom).toBeLessThanOrEqual(2)
  })

  it('shares LOD and viewport density thresholds across renderers',()=>{
    expect(spatialLodForCount(80)).toBe('full')
    expect(spatialLodForCount(150)).toBe('simplified')
    expect(spatialLodForCount(300)).toBe('overview')
    expect(spatialDensityForSize({width:500,height:700})).toBe('constrained')
    expect(spatialDensityForSize({width:700,height:700})).toBe('compact')
  })
})
