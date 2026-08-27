import { useEffect,useMemo,useState } from 'react'
import type { CSSProperties } from 'react'
import { buildCreativePreferenceIntelligenceV1,type CreativeFailureEvidenceV1,type CreativePreferenceEvidenceV1 } from '@sanverse/creative-direction'
import { renderCameraDepthAtTickV1,type CameraRigV1,type DepthBindingV1 } from '@sanverse/motion-camera-depth'
import type { MotionComponentRenderPropsV1,MotionValidationResultV1 } from '@sanverse/motion-contract'
import { inspectRiveBridgeV1,materializeRiveSubsetV1 } from '@sanverse/motion-external-bridge'
import { createMotionScene,evaluateScene,keyframed,nodeBase,constant,type MotionGraphBackedComponentModuleV1,type MotionGraphOperationV1,type MotionSceneV1 } from '@sanverse/motion-graph'
import { MotionComponentHost,MotionCompositionFrame,mergeMotionGraphNodeStyle,useResolvedMotionNode } from '@sanverse/motion-native-runtime'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { renderTrackedAttachmentAtTickV1,type MotionTrackV1,type TrackBindingV1 } from '@sanverse/motion-source-aware'

const durationTicks=5*SANVERSE_TICKS_PER_SECOND
const composition=Object.freeze({width:1280,height:720,fpsNumerator:30,fpsDenominator:1})
const page:CSSProperties={minHeight:'100vh',boxSizing:'border-box',padding:22,background:'#08090b',color:'#f5f5f5',fontFamily:'Inter,ui-sans-serif,system-ui,sans-serif'}
const panel:CSSProperties={border:'1px solid #2d3038',borderRadius:16,background:'#101217',padding:14}
const badge:CSSProperties={display:'inline-flex',border:'1px solid #363a45',borderRadius:999,padding:'5px 9px',fontSize:11,color:'#ddd',background:'#181b22'}
const label:CSSProperties={fontSize:11,textTransform:'uppercase',letterSpacing:'.12em',color:'#8c92a2'}

interface CameraProofProps{readonly variant:'camera-depth'}
interface CameraProofStyle{readonly accent:string}
const validateProps=(input:unknown):MotionValidationResultV1<CameraProofProps>=>typeof input==='object'&&input!==null&&(input as CameraProofProps).variant==='camera-depth'?{ok:true,value:input as CameraProofProps}:{ok:false,issues:[{path:'variant',code:'VALUE_INVALID',message:'Camera proof variant is required.'}]}
const validateStyle=(input:unknown):MotionValidationResultV1<CameraProofStyle>=>typeof input==='object'&&input!==null&&typeof (input as CameraProofStyle).accent==='string'?{ok:true,value:input as CameraProofStyle}:{ok:false,issues:[{path:'accent',code:'VALUE_INVALID',message:'Camera proof accent is required.'}]}
const nodeStyle=(id:string,base:CSSProperties)=>mergeMotionGraphNodeStyle(base,useResolvedMotionNode(id))
const CameraProof=({style}:MotionComponentRenderPropsV1<CameraProofProps,CameraProofStyle>)=>{
  const back=nodeStyle('camera.back',{position:'absolute',left:'50%',top:'50%',width:720,height:420,marginLeft:-360,marginTop:-210,borderRadius:42,background:'linear-gradient(145deg,#172033,#222c46)',border:'2px solid #33415f',boxShadow:'0 24px 70px rgba(0,0,0,.34)'})
  const middle=nodeStyle('camera.middle',{position:'absolute',left:'50%',top:'50%',width:420,height:230,marginLeft:-210,marginTop:-115,borderRadius:34,background:'linear-gradient(145deg,#273d55,#1c7885)',border:'3px solid #4cc9d8',boxShadow:'0 22px 55px rgba(0,0,0,.35)',display:'grid',placeItems:'center',color:'#dffcff',fontSize:38,fontWeight:800})
  const callout=nodeStyle('camera.callout',{position:'absolute',left:'50%',top:'50%',width:310,height:112,marginLeft:-155,marginTop:-56,borderRadius:28,background:'rgba(7,13,22,.96)',border:`4px solid ${style.accent}`,boxShadow:'0 20px 50px rgba(0,0,0,.45)',display:'grid',placeItems:'center',color:'#fff',fontSize:29,fontWeight:850})
  const front=nodeStyle('camera.front',{position:'absolute',left:'50%',top:'50%',width:185,height:185,marginLeft:-92.5,marginTop:-92.5,borderRadius:48,background:'linear-gradient(150deg,#ffbd63,#f17444)',boxShadow:'0 26px 65px rgba(0,0,0,.42)',display:'grid',placeItems:'center',color:'#291408',fontSize:24,fontWeight:900})
  return <div style={{position:'absolute',inset:0,overflow:'hidden'}}>
    <div data-motion-node-id="camera.back" data-depth-layer="background" style={back}/>
    <div data-motion-node-id="camera.middle" data-depth-layer="middle" style={middle}>MID PLANE</div>
    <div data-motion-node-id="camera.callout" data-depth-layer="tracked-callout" style={callout}>C9 TRACKED CALLOUT</div>
    <div data-motion-node-id="camera.front" data-depth-layer="foreground" style={front}>FRONT</div>
  </div>
}
const CameraProofModule:MotionGraphBackedComponentModuleV1<CameraProofProps,CameraProofStyle>=Object.freeze({
  definition:Object.freeze({id:'sanverse.camera-depth-proof',version:1,name:'Camera depth proof',purpose:'Development-only C9→C10 exact-tick 2.5D proof.',category:'diagram',performanceClass:'medium',supportedAspectRatios:Object.freeze(['16:9'] as const),minDurationTicks:1,defaultDurationTicks:durationTicks,maxDurationTicks:durationTicks,events:Object.freeze([]),contentLimits:Object.freeze([])}),
  defaultProps:Object.freeze({variant:'camera-depth'}),defaultStyle:Object.freeze({accent:'#4ce1ff'}),validateProps,validateStyle,Component:CameraProof,
  createScene:()=>{
    const root=nodeBase('camera.root','Camera Root',null),back=nodeBase('camera.back','Background Plane','camera.root'),middle=nodeBase('camera.middle','Middle Plane','camera.root'),callout=nodeBase('camera.callout','Tracked Callout','camera.root'),front=nodeBase('camera.front','Foreground Plane','camera.root')
    return createMotionScene({componentId:'sanverse.camera-depth-proof',componentVersion:1,rootNodeId:'camera.root',nodes:Object.freeze({
      'camera.root':Object.freeze({...root,type:'group' as const,childIds:Object.freeze(['camera.back','camera.middle','camera.callout','camera.front'])}),
      'camera.back':Object.freeze({...back,type:'shape' as const,transform:Object.freeze({...back.transform,positionX:constant(-150),positionY:constant(-20)}),shape:'rounded-rectangle' as const,width:constant(720),height:constant(420),fillColor:constant('#172033'),strokeColor:constant('#33415f'),strokeWidth:constant(2),radius:constant(42)}),
      'camera.middle':Object.freeze({...middle,type:'shape' as const,transform:Object.freeze({...middle.transform,positionX:constant(30),positionY:constant(35)}),shape:'rounded-rectangle' as const,width:constant(420),height:constant(230),fillColor:constant('#1c7885'),strokeColor:constant('#4cc9d8'),strokeWidth:constant(3),radius:constant(34)}),
      'camera.callout':Object.freeze({...callout,type:'shape' as const,shape:'rounded-rectangle' as const,width:constant(310),height:constant(112),fillColor:constant('#07101b'),strokeColor:constant('#4ce1ff'),strokeWidth:constant(4),radius:constant(28)}),
      'camera.front':Object.freeze({...front,type:'shape' as const,transform:Object.freeze({...front.transform,positionX:constant(230),positionY:constant(125)}),shape:'rounded-rectangle' as const,width:constant(185),height:constant(185),fillColor:constant('#f17444'),strokeColor:constant('transparent'),strokeWidth:constant(0),radius:constant(48)}),
    }),semanticParts:Object.freeze([{id:'background',label:'Background',role:'surface' as const,nodeIds:Object.freeze(['camera.back'])},{id:'middle',label:'Middle',role:'content-group' as const,nodeIds:Object.freeze(['camera.middle'])},{id:'tracked-callout',label:'Tracked callout',role:'content-group' as const,nodeIds:Object.freeze(['camera.callout'])},{id:'foreground',label:'Foreground',role:'decoration' as const,nodeIds:Object.freeze(['camera.front'])}]),exposures:Object.freeze([]),layout:Object.freeze({mode:'manual' as const,ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9'])})
  },
})

const trackTicks=Object.freeze([0,720_000,1_440_000,2_160_000,2_880_000,3_600_000,4_320_000,5_040_000,5_760_000,6_480_000,7_200_000])
const calloutTrack:MotionTrackV1=Object.freeze({schemaVersion:'sanverse.motion-track/v1',id:'track:c10-callout',sourceId:'camera-depth-proof-source',sourceStartTick:0,sourceEndTick:durationTicks,target:Object.freeze({kind:'object',label:'speaker anchor'}),samples:Object.freeze(trackTicks.map((tick,index)=>{const p=index/(trackTicks.length-1);return Object.freeze({tick,x:.38+.25*p,y:.31+.12*Math.sin(p*Math.PI),scaleX:1,scaleY:1,rotation:0,visibility:1,confidence:.99})})),interpolation:Object.freeze({mode:'linear'}),status:'valid',metadata:Object.freeze({coordinateSpace:'normalized-source',provider:'v13-browser-proof',materializedAt:'2026-08-27T00:00:00.000Z'})})
const calloutBinding:TrackBindingV1=Object.freeze({schemaVersion:'sanverse.track-binding/v1',id:'binding:c10-callout',trackId:calloutTrack.id,nodeId:'camera.callout',followMode:'position',offset:Object.freeze({x:-composition.width/2,y:-composition.height/2,scaleX:1,scaleY:1,rotation:0}),anchor:Object.freeze({x:.5,y:.5}),smoothingPolicy:'none'})
const cameraRig:CameraRigV1=Object.freeze({schemaVersion:'sanverse.camera-rig/v1',id:'camera:v13-proof',durationTicks,positionX:keyframed([{id:'cx0',tick:0,value:-90,interpolation:'linear'},{id:'cx1',tick:3_600_000,value:70,interpolation:'bezier',bezier:{inX:.25,inY:1,outX:.2,outY:.75}},{id:'cx2',tick:durationTicks,value:120,interpolation:'linear'}]),positionY:keyframed([{id:'cy0',tick:0,value:-25,interpolation:'linear'},{id:'cy1',tick:durationTicks,value:45,interpolation:'linear'}]),zoom:keyframed([{id:'cz0',tick:0,value:1,interpolation:'linear'},{id:'cz1',tick:3_600_000,value:1.18,interpolation:'bezier',bezier:{inX:.25,inY:1,outX:.2,outY:.75}},{id:'cz2',tick:durationTicks,value:1.06,interpolation:'linear'}])})
const depthBindings:readonly DepthBindingV1[]=Object.freeze([{schemaVersion:'sanverse.depth-binding/v1',id:'depth:back',nodeId:'camera.back',depth:.2},{schemaVersion:'sanverse.depth-binding/v1',id:'depth:middle',nodeId:'camera.middle',depth:.62},{schemaVersion:'sanverse.depth-binding/v1',id:'depth:callout',nodeId:'camera.callout',depth:1},{schemaVersion:'sanverse.depth-binding/v1',id:'depth:front',nodeId:'camera.front',depth:1.35}])
const context=(tick:number)=>Object.freeze({localTicks:tick,durationTicks,ticksPerSecond:SANVERSE_TICKS_PER_SECOND,composition,reducedMotion:false})
const preferenceEvidence:readonly CreativePreferenceEvidenceV1[]=Object.freeze([{schemaVersion:'sanverse.creative-preference-evidence/v1',id:'pref:1',projectId:'project:a',kind:'owner-accepted',dimension:'camera-policy',value:'restrained',contextTags:Object.freeze(['talking-head'])},{schemaVersion:'sanverse.creative-preference-evidence/v1',id:'pref:2',projectId:'project:b',kind:'owner-repaired',dimension:'camera-policy',value:'restrained',contextTags:Object.freeze(['talking-head'])},{schemaVersion:'sanverse.creative-preference-evidence/v1',id:'pref:3',projectId:'project:b',kind:'owner-accepted',dimension:'camera-policy',value:'restrained',contextTags:Object.freeze(['talking-head'])}])
const failureEvidence:readonly CreativeFailureEvidenceV1[]=Object.freeze([{schemaVersion:'sanverse.creative-failure-evidence/v1',id:'failure:1',projectId:'project:a',code:'CAMERA_TOO_AGGRESSIVE',family:'camera',contextTags:Object.freeze(['talking-head']),resolution:'reduce depth and pan amplitude'},{schemaVersion:'sanverse.creative-failure-evidence/v1',id:'failure:2',projectId:'project:c',code:'CAMERA_TOO_AGGRESSIVE',family:'camera',contextTags:Object.freeze(['talking-head']),resolution:'reduce depth and pan amplitude'}])
const intelligence=buildCreativePreferenceIntelligenceV1(preferenceEvidence,failureEvidence)
if(!intelligence.ok)throw new RangeError(intelligence.refusal.message)
const riveSource=JSON.stringify({schemaVersion:'sanverse.rive-subset/v1',artboardId:'v13-chip',width:1000,height:300,durationTicks,stateMachines:[],shapes:[{id:'chip',name:'Rive deterministic chip',type:'rect',x:180,y:150,width:260,height:110,fill:'#7a5cff',radius:28,opacity:1,xKeyframes:[{id:'rx0',tick:0,value:180,interpolation:'linear'},{id:'rx1',tick:durationTicks,value:820,interpolation:'linear'}]}]})
const riveInspection=inspectRiveBridgeV1(riveSource)
if(!riveInspection.ok||riveInspection.value.decision!=='native-materialize')throw new RangeError(riveInspection.ok?riveInspection.value.reasons.join(' '):riveInspection.refusal.message)
const riveDecision=riveInspection.value.decision
const riveSceneResult=materializeRiveSubsetV1('v13-rive-chip',riveSource)
if(!riveSceneResult.ok)throw new RangeError(riveSceneResult.refusal.message)
const riveScene=riveSceneResult.value
const cameraProofProps:CameraProofProps=Object.freeze({variant:'camera-depth'})
const cameraProofStyle:CameraProofStyle=Object.freeze({accent:'#4ce1ff'})

export interface CameraDepthReviewFrameV1 {readonly tick:number;readonly operations:readonly MotionGraphOperationV1[];readonly finalScene:MotionSceneV1;readonly camera:Readonly<{positionX:number;positionY:number;zoom:number}>;readonly transforms:Readonly<Record<string,Readonly<{positionX:number;positionY:number;scaleX:number;scaleY:number}>>>;readonly rivePositionX:number;readonly preference:string;readonly failureLesson:string}
export const buildCameraDepthReviewFrame=(tick:number):CameraDepthReviewFrameV1=>{
  const safeTick=Math.max(0,Math.min(durationTicks,Math.round(tick))),base=CameraProofModule.createScene(cameraProofProps,cameraProofStyle,context(safeTick)),tracked=renderTrackedAttachmentAtTickV1({scene:base,track:calloutTrack,binding:calloutBinding,tick:safeTick,composition})
  if(!tracked.ok)throw new RangeError(tracked.refusal.message)
  const camera=renderCameraDepthAtTickV1({scene:tracked.value.scene,rig:cameraRig,bindings:depthBindings,tick:safeTick,composition})
  if(!camera.ok)throw new RangeError(camera.refusal.message)
  const resolved=evaluateScene(camera.value.scene,context(safeTick)),transforms=Object.fromEntries(depthBindings.map(binding=>{const t=resolved.nodes[binding.nodeId]!.transform;return [binding.nodeId,Object.freeze({positionX:t.positionX,positionY:t.positionY,scaleX:t.scaleX,scaleY:t.scaleY})]})),rive=evaluateScene(riveScene,context(safeTick)),rivePositionX=rive.nodes['v13-rive-chip::chip']?.transform.positionX??0
  return Object.freeze({tick:safeTick,operations:Object.freeze([...tracked.value.operations,...camera.value.operations]),finalScene:camera.value.scene,camera:Object.freeze({positionX:camera.value.camera.positionX,positionY:camera.value.camera.positionY,zoom:camera.value.camera.zoom}),transforms:Object.freeze(transforms),rivePositionX,preference:intelligence.value.promoted[0]?.value??'none',failureLesson:intelligence.value.failureLessons[0]?.recommendation??'none'})
}

export function CameraDepthReviewLab(){
  const [tick,setTick]=useState(0),[full,setFull]=useState(false)
  useEffect(()=>{let raf=0,cancelled=false;const anchor=performance.now();const loop=(now:number)=>{if(cancelled)return;const next=Math.max(0,Math.min(durationTicks,Math.round((now-anchor)/1000*SANVERSE_TICKS_PER_SECOND)));setTick(next);if(next>=durationTicks){setFull(true);return}raf=requestAnimationFrame(loop)};raf=requestAnimationFrame(loop);return()=>{cancelled=true;cancelAnimationFrame(raf)}},[])
  const frame=useMemo(()=>buildCameraDepthReviewFrame(tick),[tick]),ctx=useMemo(()=>context(frame.tick),[frame.tick]),riveLeft=`${50+frame.rivePositionX*100}%`
  return <main style={page} data-camera-depth-review="true" data-camera-depth-current-tick={frame.tick} data-camera-depth-duration-ticks={durationTicks} data-camera-depth-full-playback={full?'true':'false'} data-camera-depth-c9-composed="true" data-camera-depth-graph-backed="true" data-camera-depth-b8={frame.preference} data-camera-depth-rive={riveDecision}>
    <header style={{maxWidth:1400,margin:'0 auto 14px',display:'flex',justifyContent:'space-between',alignItems:'end',gap:14}}><div><div style={label}>Sanverse Creative Engine V1.3</div><h1 style={{margin:'5px 0 4px'}}>C10 camera + 2.5D depth · C9 composed</h1><p style={{margin:0,color:'#9ba1af',fontSize:13}}>Canonical C9 tracking resolves first. Deterministic C10 camera/depth then projects ordinary Motion Graph transforms at the same exact tick.</p></div><span style={badge}>{full?'✓ full 1× playback':'▶ playing at 1×'}</span></header>
    <div style={{maxWidth:1400,margin:'0 auto',display:'grid',gridTemplateColumns:'minmax(0,2.1fr) minmax(310px,.9fr)',gap:14}}>
      <section style={panel}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><strong>Graph-native camera stack</strong><span style={badge}>{(frame.tick/SANVERSE_TICKS_PER_SECOND).toFixed(2)} / 5.00s · zoom {frame.camera.zoom.toFixed(3)}</span></div><div style={{position:'relative',overflow:'hidden',aspectRatio:'16/9',borderRadius:12,border:'1px solid #292d36',background:'radial-gradient(circle at 50% 45%,#161a24,#080a0f 72%)'}}><MotionCompositionFrame composition={composition} displayScale={.64} background="transparent"><MotionComponentHost module={CameraProofModule} props={cameraProofProps} style={cameraProofStyle} context={ctx} graphOperations={frame.operations} selectedGraphNodeId="camera.callout"/></MotionCompositionFrame></div><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:10}}>{depthBindings.map(binding=><div key={binding.id} style={{...badge,display:'block',textAlign:'center'}} data-depth-binding={binding.nodeId}>{binding.nodeId.replace('camera.','')} · depth {binding.depth.toFixed(2)}</div>)}</div></section>
      <aside style={{display:'grid',gap:14,alignContent:'start'}}>
        <section style={panel} data-b8-proof="true"><div style={label}>B8 owner preference intelligence</div><h3 style={{margin:'7px 0'}}>Promoted: {frame.preference}</h3><div style={{fontSize:13,color:'#aeb4c2',lineHeight:1.45}}>3 explicit positive owner signals across 2 projects. Automatic mutation stays OFF.</div><div style={{marginTop:10,padding:10,borderRadius:10,background:'#19151b',fontSize:12,color:'#e1bcc8'}}>Failure lesson: {frame.failureLesson}</div></section>
        <section style={panel} data-rive-proof="true"><div style={label}>Truthful Rive bridge</div><h3 style={{margin:'7px 0'}}>Deterministic subset → native graph</h3><div style={{height:112,position:'relative',overflow:'hidden',borderRadius:12,background:'#0c0d13',border:'1px solid #272a33'}}><div style={{position:'absolute',left:riveLeft,top:'50%',width:92,height:44,marginLeft:-46,marginTop:-22,borderRadius:14,background:'#7a5cff',display:'grid',placeItems:'center',fontSize:11,fontWeight:900,transform:'translateZ(0)'}}>RIVE→GRAPH</div></div><div style={{marginTop:8,fontSize:12,color:'#aeb4c2'}}>Raw .riv/state machines remain runtime-required; this proof uses the bounded exact-tick exported subset.</div></section>
        <section style={panel}><div style={label}>Current camera</div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:8}}><span style={badge}>x {frame.camera.positionX.toFixed(1)}</span><span style={badge}>y {frame.camera.positionY.toFixed(1)}</span><span style={badge}>z {frame.camera.zoom.toFixed(3)}</span></div></section>
      </aside>
    </div>
    <footer style={{maxWidth:1400,margin:'14px auto 0',...panel,fontSize:12,color:'#a5abba'}}>Authority chain: C9 materialized track → ordinary graph transform → C10 exact-tick camera/depth → ordinary graph transform. B8 is evidence-only. Rive V1.3 either materializes its deterministic subset or fails closed.</footer>
  </main>
}
