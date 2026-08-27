import { describe,expect,it } from 'vitest'
import { constant,createMotionScene,keyframed,nodeBase,type MotionSceneV1 } from '@sanverse/motion-graph'
import type { MotionTrackV1,TrackBindingV1 } from './contracts.ts'
import { createImportedSubjectMatteV1 } from './subject.ts'
import { renderSubjectEnvironmentAtTickV1,renderSurfaceEmbeddedAtTickV1,renderTrackedAttachmentAtTickV1 } from './workflows.ts'

const composition={width:1000,height:500,fpsNumerator:30,fpsDenominator:1} as const
const scene=():MotionSceneV1=>{
  const root=nodeBase('root','Root',null),card=nodeBase('card','Card','root')
  return createMotionScene({componentId:'sanverse.source-aware-proof',componentVersion:1,rootNodeId:'root',nodes:Object.freeze({root:Object.freeze({...root,type:'group' as const,childIds:Object.freeze(['card'])}),card:Object.freeze({...card,type:'shape' as const,transform:Object.freeze({...card.transform,positionX:keyframed([{id:'mx0',tick:0,value:0,interpolation:'linear'},{id:'mx1',tick:1_440_000,value:100,interpolation:'linear'}]),positionY:constant(20)}),shape:'rounded-rectangle' as const,width:constant(160),height:constant(80),fillColor:constant('#35d07f'),strokeColor:constant('#ffffff'),strokeWidth:constant(2),radius:constant(18)})}),semanticParts:Object.freeze([{id:'card-part',label:'Card',role:'content-group' as const,nodeIds:Object.freeze(['card'])}]),exposures:Object.freeze([]),layout:Object.freeze({mode:'manual' as const,ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9'])})
}
const binding=(followMode:TrackBindingV1['followMode']='full-transform'):TrackBindingV1=>Object.freeze({schemaVersion:'sanverse.track-binding/v1',id:'binding-1',trackId:'track-1',nodeId:'card',followMode,offset:Object.freeze({x:5,y:-3,scaleX:1,scaleY:1,rotation:0}),anchor:Object.freeze({x:.5,y:.5}),smoothingPolicy:'none'})
const pointTrack=():MotionTrackV1=>Object.freeze({schemaVersion:'sanverse.motion-track/v1',id:'track-1',sourceId:'source-1',sourceStartTick:0,sourceEndTick:1_440_000,target:Object.freeze({kind:'object' as const,label:'marker',semanticNodeId:'card'}),samples:Object.freeze([{tick:0,x:.25,y:.4,scaleX:1,scaleY:1,rotation:0,visibility:1,confidence:1},{tick:720_000,x:.5,y:.5,scaleX:1.1,scaleY:1.1,rotation:10,visibility:1,confidence:1},{tick:1_440_000,x:.75,y:.6,scaleX:1.2,scaleY:1.2,rotation:20,visibility:1,confidence:1}]),interpolation:Object.freeze({mode:'linear' as const}),status:'valid',metadata:Object.freeze({coordinateSpace:'normalized-source' as const,provider:'fixture',materializedAt:'test'})})
const surfaceTrack=():MotionTrackV1=>Object.freeze({schemaVersion:'sanverse.motion-track/v1',id:'track-1',sourceId:'source-1',sourceStartTick:0,sourceEndTick:1_440_000,target:Object.freeze({kind:'surface' as const,label:'screen'}),samples:Object.freeze([{tick:0,x:.3,y:.3,visibility:1,confidence:1,surfaceCorners:Object.freeze({topLeft:{x:.1,y:.1},topRight:{x:.5,y:.12},bottomRight:{x:.48,y:.5},bottomLeft:{x:.12,y:.48}})},{tick:720_000,x:.35,y:.32,visibility:1,confidence:1,surfaceCorners:Object.freeze({topLeft:{x:.15,y:.12},topRight:{x:.55,y:.15},bottomRight:{x:.53,y:.52},bottomLeft:{x:.17,y:.49}})},{tick:1_440_000,x:.4,y:.34,visibility:1,confidence:1,surfaceCorners:Object.freeze({topLeft:{x:.2,y:.14},topRight:{x:.6,y:.18},bottomRight:{x:.58,y:.54},bottomLeft:{x:.22,y:.5}})}]),interpolation:Object.freeze({mode:'linear' as const}),status:'valid',metadata:Object.freeze({coordinateSpace:'normalized-source' as const,provider:'fixture',materializedAt:'test'})})

describe('V1.2 M5/M6/M7 source-aware review operations',()=>{
  it('M5 composes canonical track + user offset + normal graph motion and is history-free under direct/backward/random seek',()=>{
    const input={scene:scene(),track:pointTrack(),binding:binding(),composition}
    const direct=renderTrackedAttachmentAtTickV1({...input,tick:720_000}),later=renderTrackedAttachmentAtTickV1({...input,tick:1_200_000}),back=renderTrackedAttachmentAtTickV1({...input,tick:720_000})
    expect(direct.ok).toBe(true);expect(later.ok).toBe(true);expect(back).toEqual(direct)
    if(!direct.ok)return
    expect(direct.value.resolvedScene.nodes.card?.transform).toMatchObject({positionX:555,positionY:267,scaleX:1.1,scaleY:1.1,rotationDeg:10})
    expect(direct.value.semanticNodeIds).toEqual(['root','card'])
  })
  it('M5 fails closed on unresolved low-confidence/lost tracking',()=>{
    const track={...pointTrack(),samples:Object.freeze([{...pointTrack().samples[0]!,confidence:.1}]),sourceEndTick:0,status:'low-confidence' as const}
    expect(renderTrackedAttachmentAtTickV1({scene:scene(),track,binding:binding(),tick:0,composition})).toMatchObject({ok:false,refusal:{code:'TRACK_QA_FAILED'}})
  })
  it('M6 turns a canonical surface quad into graph-native perspective and preserves exact repeated seek',()=>{
    const input={scene:scene(),track:surfaceTrack(),binding:binding('surface'),nodeSize:{width:160,height:80},composition}
    const direct=renderSurfaceEmbeddedAtTickV1({...input,tick:720_000}),other=renderSurfaceEmbeddedAtTickV1({...input,tick:1_440_000}),again=renderSurfaceEmbeddedAtTickV1({...input,tick:720_000})
    expect(direct.ok).toBe(true);expect(other.ok).toBe(true);expect(again).toEqual(direct)
    if(!direct.ok)return
    expect(direct.value.resolvedScene.nodes.card?.transform).toMatchObject({anchorX:0,anchorY:0})
    expect(direct.value.resolvedScene.nodes.card?.transform.perspectiveMatrix3d).toMatch(/^matrix3d\(/u)
    expect(direct.value.operations).toHaveLength(3)
  })
  it('M6 refuses unsupported surface scale/rotation offsets instead of approximating them',()=>{
    const b={...binding('surface'),offset:{x:0,y:0,scaleX:1.1,scaleY:1,rotation:0}}
    expect(renderSurfaceEmbeddedAtTickV1({scene:scene(),track:surfaceTrack(),binding:b,nodeSize:{width:160,height:80},tick:0,composition})).toMatchObject({ok:false,refusal:{code:'SURFACE_OFFSET_UNSUPPORTED'}})
  })
  it('M7 materializes an imported canonical subject matte into existing C8 mask animation and direct-seeks deterministically',()=>{
    const matte=createImportedSubjectMatteV1('subject-1','source-1',[{tick:0,x:.25,y:.1,width:.3,height:.8,confidence:1},{tick:720_000,x:.3,y:.1,width:.3,height:.8,confidence:1},{tick:1_440_000,x:.35,y:.1,width:.3,height:.8,confidence:1}])
    const input={scene:scene(),matte,nodeId:'card',maskId:'subject-cutout',composition}
    const direct=renderSubjectEnvironmentAtTickV1({...input,tick:720_000}),later=renderSubjectEnvironmentAtTickV1({...input,tick:1_440_000}),again=renderSubjectEnvironmentAtTickV1({...input,tick:720_000})
    expect(direct.ok).toBe(true);expect(later.ok).toBe(true);expect(again).toEqual(direct)
    if(!direct.ok)return
    const mask=direct.value.resolvedScene.nodes.card?.masks[0]
    expect(mask).toMatchObject({id:'subject-cutout',invert:true,x:.3,y:.1,width:.3,height:.8})
  })
  it('M7 refuses a low-confidence subject matte before graph mutation',()=>{
    const matte=createImportedSubjectMatteV1('subject-low','source-1',[{tick:0,x:.25,y:.1,width:.3,height:.8,confidence:.2}])
    expect(renderSubjectEnvironmentAtTickV1({scene:scene(),matte,nodeId:'card',maskId:'subject-cutout',tick:0,composition})).toMatchObject({ok:false,refusal:{code:'SUBJECT_MATTE_QA_FAILED'}})
  })
})
