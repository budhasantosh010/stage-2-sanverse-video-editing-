import { describe,expect,it } from 'vitest'
import { applySubjectControlV1,applySurfaceControlV1,applyTrackingControlV1,createImportedSubjectMatteV1,validateSourceAwareStoryboardSetupV1,type MotionTrackV1,type TrackBindingV1 } from './index.ts'

const samples=Object.freeze([{tick:0,x:.2,y:.3,visibility:1,confidence:1},{tick:720_000,x:.3,y:.35,visibility:1,confidence:1}])
const track:MotionTrackV1=Object.freeze({schemaVersion:'sanverse.motion-track/v1',id:'track:1',sourceId:'source:1',sourceStartTick:0,sourceEndTick:720_000,target:{kind:'object' as const,label:'phone'},samples,interpolation:{mode:'linear' as const},status:'valid',metadata:{coordinateSpace:'normalized-source' as const,provider:'fixture',materializedAt:'now'}})
const binding:TrackBindingV1=Object.freeze({schemaVersion:'sanverse.track-binding/v1',id:'binding:1',trackId:track.id,nodeId:'hero',followMode:'position',offset:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},anchor:{x:.5,y:.5},smoothingPolicy:'none'})
const surfaceTrack:MotionTrackV1=Object.freeze({...track,id:'track:surface',target:{kind:'surface' as const,label:'screen'},samples:Object.freeze(samples.map(sample=>Object.freeze({...sample,surfaceCorners:{topLeft:{x:.2,y:.2},topRight:{x:.8,y:.2},bottomRight:{x:.8,y:.8},bottomLeft:{x:.2,y:.8}}})))})
const surfaceBinding:TrackBindingV1=Object.freeze({...binding,id:'binding:surface',trackId:surfaceTrack.id,followMode:'surface'})
const matte=createImportedSubjectMatteV1('matte:1','source:1',[{tick:0,x:.3,y:.1,width:.3,height:.8,confidence:1},{tick:720_000,x:.32,y:.1,width:.3,height:.8,confidence:1}])

describe('V1.2 source-aware semantic controls',()=>{
  it('validates executable M5/M6/M7 storyboard setup without introducing a second storyboard authority',()=>{
    expect(validateSourceAwareStoryboardSetupV1({schemaVersion:'sanverse.source-aware-storyboard-setup/v1',id:'setup:m5',mode:'M5',sourceId:'source:1',graphicNodeId:'hero',trackId:'track:1',bindingId:'binding:1',targetLabel:'phone',attachment:'upper-right',followMode:'position'})).toMatchObject({ok:true})
    expect(validateSourceAwareStoryboardSetupV1({schemaVersion:'sanverse.source-aware-storyboard-setup/v1',id:'setup:m6',mode:'M6',sourceId:'source:1',graphicNodeId:'hero',trackId:'track:surface',bindingId:'binding:surface',targetLabel:'screen',attachment:'surface',followMode:'surface'})).toMatchObject({ok:true})
    expect(validateSourceAwareStoryboardSetupV1({schemaVersion:'sanverse.source-aware-storyboard-setup/v1',id:'setup:m7',mode:'M7',sourceId:'source:1',graphicNodeId:'hero',matteId:'matte:1',targetLabel:'speaker'})).toMatchObject({ok:true})
  })
  it('supports attach/detach/target/follow/offset/anchor/smoothing/correct-sample as typed tracking controls',()=>{
    let state={attached:false,track,binding}
    const attached=applyTrackingControlV1(state,{type:'tracking.attach',track,binding});expect(attached.ok).toBe(true);if(!attached.ok)return;state=attached.value
    for(const operation of [{type:'tracking.set-target',target:{kind:'object',label:'tablet'}},{type:'tracking.set-follow-mode',followMode:'position+scale'},{type:'tracking.set-offset',offset:{x:10,y:-8,scaleX:1.1,scaleY:1.1,rotation:0}},{type:'tracking.set-anchor',anchor:{x:.4,y:.6}},{type:'tracking.set-smoothing-policy',smoothingPolicy:'canonical-curve'},{type:'tracking.correct-sample',sample:{tick:720_000,x:.31,y:.36,visibility:1,confidence:.99}}] as const){const next=applyTrackingControlV1(state,operation);expect(next.ok,operation.type).toBe(true);if(next.ok)state=next.value}
    expect(state.track.target.label).toBe('tablet');expect(state.binding.followMode).toBe('position+scale');expect(state.binding.offset.x).toBe(10);expect(state.track.samples.at(-1)?.x).toBe(.31)
    expect(applyTrackingControlV1(state,{type:'tracking.detach'})).toMatchObject({ok:true,value:{attached:false}})
  })
  it('supports truthful surface controls and refuses unsupported fit approximation',()=>{
    let state={attached:false,track:surfaceTrack,binding:surfaceBinding,fit:'stretch' as const,opacity:1,maskId:null as string|null}
    const attached=applySurfaceControlV1(state,{type:'surface.attach',track:surfaceTrack,binding:surfaceBinding});expect(attached.ok).toBe(true);if(!attached.ok)return;state=attached.value
    expect(applySurfaceControlV1(state,{type:'surface.fit',fit:'contain'})).toMatchObject({ok:false,refusal:{code:'SURFACE_FIT_UNSUPPORTED'}})
    const opacity=applySurfaceControlV1(state,{type:'surface.set-opacity',opacity:.7});expect(opacity).toMatchObject({ok:true,value:{opacity:.7}})
    const corrected=applySurfaceControlV1(state,{type:'surface.set-quad',tick:720_000,sample:{...surfaceTrack.samples[1]!,x:.35}});expect(corrected.ok).toBe(true)
  })
  it('supports subject isolate and canonical matte replacement through typed state only',()=>{
    const state={isolated:false,matte};expect(applySubjectControlV1(state,{type:'subject.isolate'})).toMatchObject({ok:true,value:{isolated:true}});expect(applySubjectControlV1(state,{type:'subject.set-matte',matte})).toMatchObject({ok:true,value:{matte:{id:'matte:1'}}})
  })
})
