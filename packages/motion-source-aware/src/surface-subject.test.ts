import { describe,expect,it } from 'vitest'
import { createDefaultMask } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { createImportedSubjectMatteV1,evaluateSubjectMatteV1,materializeSubjectMatteToMaskV1,projectSurfaceQuadV1,runSurfaceQaV1,type MotionSurfaceSampleV1 } from './index.ts'

const sample:MotionSurfaceSampleV1={tick:720_000,corners:{topLeft:{x:.2,y:.2},topRight:{x:.75,y:.18},bottomRight:{x:.8,y:.72},bottomLeft:{x:.18,y:.75}},confidence:.97}
describe('M6 surface and M7 subject authority',()=>{
  it('projects a content rectangle to a deterministic CSS matrix3d',()=>{const a=projectSurfaceQuadV1({width:400,height:240},sample.corners,{width:1000,height:500,fpsNumerator:30,fpsDenominator:1}),b=projectSurfaceQuadV1({width:400,height:240},sample.corners,{width:1000,height:500,fpsNumerator:30,fpsDenominator:1});expect(a).toEqual(b);expect(a.cssMatrix3d.startsWith('matrix3d(')).toBe(true)})
  it('detects inverted surface geometry instead of pretending perspective succeeded',()=>{const bad={...sample,corners:{topLeft:{x:.8,y:.2},topRight:{x:.2,y:.2},bottomRight:{x:.2,y:.8},bottomLeft:{x:.8,y:.8}}};expect(runSurfaceQaV1([bad]).some(f=>f.code==='SURFACE_INVERSION')).toBe(true)})
  it('supports a real imported canonical subject matte route compatible with C8 masks',()=>{const matte=createImportedSubjectMatteV1('matte:subject','source:demo',[{tick:0,x:.35,y:.15,width:.3,height:.7,confidence:1},{tick:SANVERSE_TICKS_PER_SECOND,x:.45,y:.15,width:.3,height:.7,confidence:1}]);const middle=evaluateSubjectMatteV1(matte,720_000);expect(middle.x).toBeCloseTo(.4);const mask=materializeSubjectMatteToMaskV1(matte,createDefaultMask('subject-mask','ellipse'));expect(mask.type).toBe('ellipse');expect(mask.x.kind).toBe('keyframes')})
})
