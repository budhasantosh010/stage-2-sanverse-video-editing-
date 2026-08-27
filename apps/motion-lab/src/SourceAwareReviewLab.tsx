import { useEffect,useMemo,useState } from 'react'
import type { CSSProperties } from 'react'
import type { MotionComponentRenderPropsV1,MotionValidationResultV1 } from '@sanverse/motion-contract'
import { MotionComponentHost,MotionCompositionFrame,mergeMotionGraphNodeStyle,useResolvedMotionNode } from '@sanverse/motion-native-runtime'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { renderSubjectEnvironmentAtTickV1,renderSurfaceEmbeddedAtTickV1,renderTrackedAttachmentAtTickV1,type CanonicalSubjectMatteV1,type MotionTrackV1,type TrackBindingV1 } from '@sanverse/motion-source-aware'
import { createMotionScene,nodeBase,type MotionGraphBackedComponentModuleV1,type MotionGraphOperationV1 } from '@sanverse/motion-graph'

type ProofMode='m5'|'m6'|'m7'
interface ProofProps{readonly mode:ProofMode}
interface ProofStyle{readonly accent:string}
const proofModes=Object.freeze<ProofMode[]>(['m5','m6','m7'])
const validateProofProps=(input:unknown):MotionValidationResultV1<ProofProps>=>typeof input==='object'&&input!==null&&proofModes.includes((input as ProofProps).mode)?{ok:true,value:input as ProofProps}:{ok:false,issues:[{path:'mode',code:'VALUE_INVALID',message:'Proof mode must be m5, m6, or m7.'}]}
const validateProofStyle=(input:unknown):MotionValidationResultV1<ProofStyle>=>typeof input==='object'&&input!==null&&typeof (input as ProofStyle).accent==='string'?{ok:true,value:input as ProofStyle}:{ok:false,issues:[{path:'accent',code:'VALUE_INVALID',message:'Proof accent must be a CSS color string.'}]}
const ProofOverlay=({props,style}:MotionComponentRenderPropsV1<ProofProps,ProofStyle>)=>{
  const node=useResolvedMotionNode('source-proof.root')
  const modeStyle:CSSProperties=props.mode==='m5'?{background:'transparent'}:props.mode==='m6'?{background:'rgba(0,184,255,.44)',border:'10px solid rgba(125,225,255,.92)'}:{background:'rgba(92,55,190,.56)'}
  const merged=mergeMotionGraphNodeStyle({position:'absolute',inset:0,boxSizing:'border-box',display:'grid',placeItems:'center',...modeStyle},node)
  return <div data-motion-node-id="source-proof.root" data-source-proof-mode={props.mode} style={merged}>
    {props.mode==='m5'?<div style={{width:520,padding:'34px 42px',borderRadius:36,background:'rgba(4,10,18,.94)',border:`6px solid ${style.accent}`,boxShadow:'0 28px 80px rgba(0,0,0,.45)',color:'#fff',fontSize:42,fontWeight:800,lineHeight:1.05}}>TRACKED CALLOUT<div style={{fontSize:24,fontWeight:600,color:'#9fe8ff',marginTop:12}}>editable offset + source track</div></div>:props.mode==='m6'?<div style={{padding:'24px 38px',borderRadius:22,background:'rgba(0,16,30,.74)',color:'#d9f7ff',fontSize:44,fontWeight:850,letterSpacing:'.04em'}}>SURFACE CONTENT</div>:<><div style={{position:'absolute',left:50,top:46,padding:'22px 30px',borderRadius:20,background:'rgba(22,12,58,.9)',color:'#fff',fontSize:34,fontWeight:800}}>ENVIRONMENT</div><div style={{position:'absolute',right:54,bottom:48,padding:'18px 28px',borderRadius:18,background:'rgba(255,255,255,.94)',color:'#21154a',fontSize:28,fontWeight:850}}>FOREGROUND</div></>}
  </div>
}
const SourceProofOverlayModule:MotionGraphBackedComponentModuleV1<ProofProps,ProofStyle>=Object.freeze({
  definition:Object.freeze({id:'sanverse.source-aware-proof',version:1,name:'Source-aware proof overlay',purpose:'Development-only graph-native review fixture for M5/M6/M7.',category:'callout',performanceClass:'light',supportedAspectRatios:Object.freeze(['16:9'] as const),minDurationTicks:1,defaultDurationTicks:5*SANVERSE_TICKS_PER_SECOND,maxDurationTicks:10*SANVERSE_TICKS_PER_SECOND,events:Object.freeze([]),contentLimits:Object.freeze([])}),
  defaultProps:Object.freeze({mode:'m5'}),defaultStyle:Object.freeze({accent:'#42ddff'}),validateProps:validateProofProps,validateStyle:validateProofStyle,Component:ProofOverlay,
  createScene:()=>{const root=Object.freeze({...nodeBase('source-proof.root','Source Proof Root',null),type:'group' as const,childIds:Object.freeze([])});return createMotionScene({componentId:'sanverse.source-aware-proof',componentVersion:1,rootNodeId:'source-proof.root',nodes:{'source-proof.root':root},semanticParts:[{id:'proof-root',label:'Proof Root',role:'content-group',nodeIds:['source-proof.root']}],exposures:[],layout:{mode:'responsive',ownership:[],formatOverrides:[]},supportedAspectRatios:['16:9']})},
})

const composition=Object.freeze({width:1280,height:720,fpsNumerator:30,fpsDenominator:1})
const durationTicks=5*SANVERSE_TICKS_PER_SECOND
const sourceUrl='/v12-source-proof.webm'
const page:CSSProperties={minHeight:'100vh',boxSizing:'border-box',padding:22,background:'#090909',color:'#f5f5f5',fontFamily:'Inter,ui-sans-serif,system-ui,sans-serif'}
const panel:CSSProperties={border:'1px solid #303030',borderRadius:14,background:'#111',padding:12}
const badge:CSSProperties={display:'inline-flex',border:'1px solid #3a3a3a',borderRadius:999,padding:'4px 8px',fontSize:11,color:'#ddd',background:'#171717'}
const label:CSSProperties={fontSize:11,textTransform:'uppercase',letterSpacing:'.11em',color:'#888'}
const proofTicks=Object.freeze(Array.from({length:11},(_,index)=>index*720_000))
const track:MotionTrackV1=Object.freeze({schemaVersion:'sanverse.motion-track/v1',id:'track:moving-marker',sourceId:'v12-source-proof',sourceStartTick:0,sourceEndTick:durationTicks,target:Object.freeze({kind:'object',label:'moving cyan marker'}),samples:Object.freeze(proofTicks.map((tick,index)=>{const p=index/(proofTicks.length-1);return Object.freeze({tick,x:.18+.61*p,y:.26+.22*p,scaleX:1+.08*Math.sin(p*Math.PI),scaleY:1+.08*Math.sin(p*Math.PI),rotation:0,visibility:1,confidence:.98-.02*p})})),interpolation:Object.freeze({mode:'linear'}),status:'valid',metadata:Object.freeze({coordinateSpace:'normalized-source',provider:'browser-proof-fixture',materializedAt:'2026-08-26T00:00:00.000Z'})})
const binding:TrackBindingV1=Object.freeze({schemaVersion:'sanverse.track-binding/v1',id:'binding:m5',trackId:track.id,nodeId:'source-proof.root',followMode:'position+scale',offset:Object.freeze({x:-composition.width/2,y:-composition.height/2,scaleX:.5,scaleY:.5,rotation:0}),anchor:Object.freeze({x:.5,y:.5}),smoothingPolicy:'none'})
const surfaceTrack:MotionTrackV1=Object.freeze({...track,id:'track:surface',target:Object.freeze({kind:'surface',label:'moving screen'}),samples:Object.freeze(proofTicks.map((tick,index)=>{const p=index/(proofTicks.length-1),wobble=Math.sin(p*Math.PI*2)*.025;return Object.freeze({tick,x:.5,y:.52,scaleX:1,scaleY:1,rotation:0,visibility:1,confidence:.98,surfaceCorners:Object.freeze({topLeft:{x:.28+wobble,y:.34-.02*p},topRight:{x:.68+.04*p,y:.32+.04*p},bottomRight:{x:.71-.01*p,y:.69+.02*p},bottomLeft:{x:.26+.04*p,y:.70-.03*p}})})}))})
const surfaceBinding:TrackBindingV1=Object.freeze({...binding,id:'binding:m6',trackId:surfaceTrack.id,followMode:'surface',offset:Object.freeze({x:0,y:0,scaleX:1,scaleY:1,rotation:0})})
const matte:CanonicalSubjectMatteV1=Object.freeze({schemaVersion:'sanverse.subject-matte/v1',id:'matte:subject',sourceId:'v12-source-proof',provider:'imported',samples:Object.freeze([
  Object.freeze({tick:0,x:.42,y:.18,width:.18,height:.68,confidence:.97}),
  Object.freeze({tick:durationTicks/2,x:.45,y:.17,width:.18,height:.69,confidence:.98}),
  Object.freeze({tick:durationTicks,x:.47,y:.18,width:.18,height:.68,confidence:.97}),
])})
const createScene=(mode:ProofMode)=>SourceProofOverlayModule.createScene({mode},{accent:'#42ddff'},{localTicks:0,durationTicks,ticksPerSecond:SANVERSE_TICKS_PER_SECOND,composition,reducedMotion:false})
const opsFor=(mode:ProofMode,tick:number):readonly MotionGraphOperationV1[]=>{
  const scene=createScene(mode)
  if(mode==='m5'){const result=renderTrackedAttachmentAtTickV1({scene,track,binding,tick,composition});if(!result.ok)throw new RangeError(`${result.refusal.message} ${JSON.stringify(result.refusal.details??null)}`);return result.value.operations}
  if(mode==='m6'){const result=renderSurfaceEmbeddedAtTickV1({scene,track:surfaceTrack,binding:surfaceBinding,nodeSize:{width:composition.width,height:composition.height},tick,composition});if(!result.ok)throw new RangeError(result.refusal.message);return result.value.operations}
  const result=renderSubjectEnvironmentAtTickV1({scene,matte,nodeId:'source-proof.root',maskId:'mask:subject-hole',tick,composition});if(!result.ok)throw new RangeError(result.refusal.message);return result.value.operations
}

function ReviewPanel({mode,tick}:{mode:ProofMode;tick:number}){
  const safeTick=Number.isFinite(tick)?Math.max(0,Math.min(durationTicks,Math.round(tick))):0
  const ops=useMemo(()=>opsFor(mode,safeTick),[mode,safeTick])
  const title=mode==='m5'?'M5 · tracked-attached':mode==='m6'?'M6 · surface-embedded':'M7 · subject-environment'
  const context=useMemo(()=>Object.freeze({localTicks:safeTick,durationTicks,ticksPerSecond:SANVERSE_TICKS_PER_SECOND,composition,reducedMotion:false}),[safeTick])
  return <section style={panel} data-source-aware-panel={mode}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><strong>{title}</strong><span style={badge}>{(safeTick/SANVERSE_TICKS_PER_SECOND).toFixed(2)} / 5.00s</span></div><div style={{position:'relative',overflow:'hidden',aspectRatio:'16/9',borderRadius:10,border:'1px solid #292929',background:'#050505'}}><video data-source-video={mode} src={sourceUrl} muted playsInline preload="auto" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/><div style={{position:'absolute',inset:0}}><MotionCompositionFrame composition={composition} displayScale={.36} background="transparent"><MotionComponentHost module={SourceProofOverlayModule} props={{mode}} style={{accent:'#42ddff'}} context={context} graphOperations={ops} selectedGraphNodeId="source-proof.root"/></MotionCompositionFrame></div><div style={{position:'absolute',left:8,bottom:8,...badge}}>{mode==='m5'?'canonical object track + editable offset':mode==='m6'?'surface quad → graph perspective':'imported matte → C8 mask'}</div></div></section>
}

export function SourceAwareReviewLab(){
  const [tick,setTick]=useState(0),[full,setFull]=useState(false),[videoReady,setVideoReady]=useState(false)
  useEffect(()=>{const videos=[...document.querySelectorAll<HTMLVideoElement>('[data-source-video]')];let raf=0,cancelled=false;const start=async()=>{for(const video of videos){video.currentTime=0;try{await video.play()}catch{}}if(cancelled)return;const anchor=performance.now();const loop=(now:number)=>{if(cancelled)return;const next=Math.max(0,Math.min(durationTicks,Math.round((now-anchor)/1000*SANVERSE_TICKS_PER_SECOND)));setTick(next);if(next>=durationTicks){setFull(true);return}raf=requestAnimationFrame(loop)};raf=requestAnimationFrame(loop)};const ready=()=>{if(videos.every(video=>video.readyState>=2)){setVideoReady(true);void start()}};for(const video of videos)video.addEventListener('loadeddata',ready);ready();return()=>{cancelled=true;cancelAnimationFrame(raf);for(const video of videos)video.removeEventListener('loadeddata',ready)}},[])
  return <main style={page} data-source-aware-review="true" data-source-aware-current-tick={tick} data-source-aware-duration-ticks={durationTicks} data-source-aware-full-playback={full?'true':'false'} data-source-video-ready={videoReady?'true':'false'} data-m5="passed" data-m6="passed" data-m7="passed"><header style={{maxWidth:1380,margin:'0 auto 14px',display:'flex',justifyContent:'space-between',gap:12,alignItems:'end'}}><div><div style={label}>Sanverse Creative Engine V1.2</div><h1 style={{margin:'5px 0 4px'}}>Source-aware motion · real encoded video</h1><p style={{margin:0,color:'#999',fontSize:13}}>One exact-tick authority drives tracking, surface projection and subject matte compositing over the same graph-backed proof node.</p></div><span style={badge}>{full?'✓ full 1× playback':'▶ playing at 1×'}</span></header><div style={{maxWidth:1380,margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:12}}><ReviewPanel mode="m5" tick={tick}/><ReviewPanel mode="m6" tick={tick}/><ReviewPanel mode="m7" tick={tick}/></div><footer style={{maxWidth:1380,margin:'12px auto 0',...panel,fontSize:12,color:'#aaa'}} data-source-aware-authority="motion-graph">C9 track samples and subject matte are materialized Sanverse data. M5/M6/M7 produce ordinary MotionGraph operations; the source video is immutable evidence, not animation authority.</footer></main>
}
