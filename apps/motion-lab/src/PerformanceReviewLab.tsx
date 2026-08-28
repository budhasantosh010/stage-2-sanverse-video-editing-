import { useEffect,useMemo,useRef,useState } from 'react'
import type { CSSProperties } from 'react'
import { evaluateMotionExpertWithinBudgetV15 } from '@sanverse/motion-expert-runtime'
import { evaluateScene,prepareMotionSceneEvaluatorV15,type ResolvedMotionSceneV1 } from '@sanverse/motion-graph'
import {
  auditMotionSceneReferencesV15,
  compareMotionPreviewExportParityV15,
  createCreativePerformanceRecorderV15,
  createV15StressScene,
  createV15TextParityScene,
  runMotionLongProjectLifecycleV15,
  runMotionSerializationStressV15,
  runV15CameraStress,
  runV15SeekStress,
  runV15TrackingStress,
  V15_STRESS_DURATION_TICKS,
  V15_STRESS_TICKS_PER_SECOND,
  v15StressContext,
} from '@sanverse/motion-performance'

const page:CSSProperties={minHeight:'100vh',boxSizing:'border-box',padding:20,background:'#08090b',color:'#f4f4f5',fontFamily:'Arial,ui-sans-serif,system-ui,sans-serif'}
const panel:CSSProperties={border:'1px solid #2b2d31',borderRadius:14,background:'#111317',padding:14}
const badge:CSSProperties={display:'inline-flex',alignItems:'center',gap:5,border:'1px solid #343840',borderRadius:999,padding:'5px 9px',fontSize:11,color:'#d9dce2',background:'#191c22'}
const label:CSSProperties={fontSize:10,textTransform:'uppercase',letterSpacing:'.13em',color:'#969ca8'}
const stressScene=createV15StressScene()
const previewEvaluator=prepareMotionSceneEvaluatorV15(stressScene)
const textScene=createV15TextParityScene()
const textPreviewEvaluator=prepareMotionSceneEvaluatorV15(textScene)

const countAnimatedProperties=():number=>{
  let count=0
  const inspect=(value:unknown)=>{if(value&&typeof value==='object'&&(value as {kind?:string}).kind==='keyframes')count+=1}
  for(const node of Object.values(stressScene.nodes)){
    inspect(node.visible);inspect(node.opacity);Object.values(node.transform).forEach(inspect)
    for(const mask of node.masks){inspect(mask.opacity);inspect(mask.feather);inspect(mask.expansion);inspect(mask.x);inspect(mask.y);inspect(mask.width);inspect(mask.height);inspect(mask.radius)}
    if(node.type==='shape'){inspect(node.width);inspect(node.height);inspect(node.fillColor);inspect(node.strokeColor);inspect(node.strokeWidth);inspect(node.radius)}
  }
  return count
}

interface StaticEvidence {
  readonly seek:ReturnType<typeof runV15SeekStress>
  readonly tracking:ReturnType<typeof runV15TrackingStress>
  readonly camera:ReturnType<typeof runV15CameraStress>
  readonly parity:ReturnType<typeof compareMotionPreviewExportParityV15>
  readonly references:ReturnType<typeof auditMotionSceneReferencesV15>
  readonly serialization:ReturnType<typeof runMotionSerializationStressV15>
  readonly lifecycle:ReturnType<typeof runMotionLongProjectLifecycleV15>
  readonly expertBudgetOk:boolean
  readonly animatedProperties:number
  readonly maskCount:number
}
let cachedStatic:StaticEvidence|null=null
const getStaticEvidence=():StaticEvidence=>{
  if(cachedStatic)return cachedStatic
  const recorder=createCreativePerformanceRecorderV15()
  const seek=runV15SeekStress(stressScene,recorder,[0,720_000,3_600_000,7_200_000,12_960_000,3_600_000])
  const tracking=runV15TrackingStress(recorder)
  const camera=runV15CameraStress(stressScene,recorder,24)
  const parity=compareMotionPreviewExportParityV15({scene:textScene,contexts:[0,720_000,7_200_000,12_960_000].map(tick=>v15StressContext(tick)),recorder})
  const references=auditMotionSceneReferencesV15(stressScene)
  const serialization=runMotionSerializationStressV15(stressScene,12)
  const lifecycle=runMotionLongProjectLifecycleV15(75)
  const experts=Object.values(stressScene.nodes).filter(node=>node.type==='expert')
  const expertBudgetOk=experts.every(node=>node.type==='expert'&&evaluateMotionExpertWithinBudgetV15({spec:node.expert,tick:7_200_000,budget:{maxClass:'HEAVY',maxPixelCount:2_000_000}}).ok)
  cachedStatic=Object.freeze({seek,tracking,camera,parity,references,serialization,lifecycle,expertBudgetOk,animatedProperties:countAnimatedProperties(),maskCount:Object.values(stressScene.nodes).reduce((sum,node)=>sum+node.masks.length,0)})
  return cachedStatic
}

const p95=(values:readonly number[]):number=>{
  if(values.length===0)return 0
  const sorted=[...values].sort((a,b)=>a-b)
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*.95)-1))]??0
}

const TextSurface=({frame,kind}:{frame:ResolvedMotionSceneV1;kind:'preview'|'export'})=>{
  const headline=frame.nodes['parity.headline'],metric=frame.nodes['parity.metric']
  const h=headline?.type==='text'?headline:null,m=metric?.type==='text'?metric:null
  return <div data-v15-text-surface={kind} style={{width:420,height:150,boxSizing:'border-box',display:'grid',placeItems:'center',alignContent:'center',gap:8,padding:16,background:'#060708',border:'1px solid #26292f',borderRadius:10,color:'#fff',overflow:'hidden'}}>
    <div style={{fontFamily:h?.fontFamily??'Arial',fontSize:h?.fontSize??54,fontWeight:h?.fontWeight??700,color:h?.fillColor??'#fff',lineHeight:1,textAlign:'center'}}>{h?.text??''}</div>
    <div style={{fontFamily:m?.fontFamily??'Arial',fontSize:m?.fontSize??44,fontWeight:m?.fontWeight??600,color:m?.fillColor??'#d5d5d5',lineHeight:1,textAlign:'center'}}>{m?.text??''}</div>
  </div>
}

export function PerformanceReviewLab(){
  const evidence=useMemo(()=>getStaticEvidence(),[])
  const [frame,setFrame]=useState(()=>previewEvaluator.evaluate(v15StressContext(0)))
  const [tick,setTick]=useState(0),[full,setFull]=useState(false),[frameCount,setFrameCount]=useState(0),[evalP95,setEvalP95]=useState(0),[evalMax,setEvalMax]=useState(0)
  const times=useRef<number[]>([])
  useEffect(()=>{
    let raf=0,cancelled=false
    const anchor=performance.now()
    const loop=(now:number)=>{
      if(cancelled)return
      const elapsed=Math.max(0,now-anchor)
      const next=Math.min(V15_STRESS_DURATION_TICKS,Math.round(elapsed/1000*V15_STRESS_TICKS_PER_SECOND))
      const started=performance.now(),resolved=previewEvaluator.evaluate(v15StressContext(next)),duration=performance.now()-started
      times.current.push(duration)
      setFrame(resolved);setTick(next);setFrameCount(value=>value+1)
      if(next>=V15_STRESS_DURATION_TICKS){
        const measurements=[...times.current]
        setEvalP95(p95(measurements));setEvalMax(Math.max(0,...measurements));setFull(true);return
      }
      raf=requestAnimationFrame(loop)
    }
    raf=requestAnimationFrame(loop)
    return()=>{cancelled=true;cancelAnimationFrame(raf)}
  },[])
  const textContext=v15StressContext(tick),previewText=textPreviewEvaluator.evaluate(textContext),exportText=evaluateScene(textScene,textContext)
  const shapes=Object.values(frame.nodes).filter(node=>node.type==='shape').slice(0,96)
  const allStatic=evidence.seek.equal&&evidence.tracking.directSeekEqual&&evidence.camera.directSeekEqual&&evidence.parity.ok&&evidence.references.ok&&evidence.serialization.ok&&evidence.lifecycle.ok&&evidence.expertBudgetOk
  return <main style={page} data-v15-performance-review="true" data-v15-current-tick={tick} data-v15-duration-ticks={V15_STRESS_DURATION_TICKS} data-v15-full-playback={full?'true':'false'} data-v15-playback-rate="1" data-v15-node-count={Object.keys(stressScene.nodes).length} data-v15-animated-properties={evidence.animatedProperties} data-v15-mask-count={evidence.maskCount} data-v15-direct-seek={evidence.seek.equal?'true':'false'} data-v15-tracking-seek={evidence.tracking.directSeekEqual?'true':'false'} data-v15-camera-seek={evidence.camera.directSeekEqual?'true':'false'} data-v15-parity={evidence.parity.ok?'true':'false'} data-v15-long-project={evidence.lifecycle.ok?'true':'false'} data-v15-resources={evidence.lifecycle.finalResources} data-v15-expert-budget={evidence.expertBudgetOk?'true':'false'} data-v15-static-gates={allStatic?'true':'false'} data-v15-frame-count={frameCount} data-v15-frame-eval-p95-ms={evalP95.toFixed(3)} data-v15-frame-eval-max-ms={evalMax.toFixed(3)}>
    <header style={{maxWidth:1480,margin:'0 auto 14px',display:'flex',justifyContent:'space-between',alignItems:'end',gap:16}}><div><div style={label}>Sanverse Creative Engine V1.5 · C13</div><h1 style={{margin:'5px 0'}}>Performance maturity under canonical load</h1><p style={{margin:0,maxWidth:940,color:'#a5abb5',fontSize:13,lineHeight:1.5}}>The full canonical scene is evaluated on every browser frame. Wall-clock measurements are evidence only; visual state still comes only from exact tick + canonical data.</p></div><span style={badge}>{full?'✓ 1× stress playback complete':'▶ 1× stress playback'} · {(tick/V15_STRESS_TICKS_PER_SECOND).toFixed(2)}/10.00s</span></header>
    <section style={{maxWidth:1480,margin:'0 auto',display:'grid',gridTemplateColumns:'1.2fr .8fr',gap:14}}>
      <div style={panel}><div style={{display:'flex',justifyContent:'space-between',gap:12,marginBottom:10}}><div><div style={label}>Prepared preview evaluator</div><h3 style={{margin:'5px 0'}}>{Object.keys(stressScene.nodes).length}-node canonical stress scene</h3></div><div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'end'}}><span style={badge}>{Object.keys(stressScene.nodes).length} nodes</span><span style={badge}>{evidence.animatedProperties} animated properties</span><span style={badge}>{evidence.maskCount} masks</span></div></div>
        <div style={{height:470,position:'relative',overflow:'hidden',borderRadius:10,background:'#050607',border:'1px solid #24272d'}} data-v15-stress-canvas="true">{shapes.map(node=>node.type!=='shape'?null:<div key={node.id} data-motion-node-id={node.id} style={{position:'absolute',left:`${Math.max(0,Math.min(100,(node.transform.positionX+.5)*100))}%`,top:`${Math.max(0,Math.min(100,(node.transform.positionY+.5)*100))}%`,width:Math.max(4,node.width*260),height:Math.max(3,node.height*260),opacity:node.opacity,background:node.fillColor,borderRadius:node.shape==='ellipse'?'50%':node.shape==='rounded-rectangle'?8:2,transform:`translate(-50%,-50%) rotate(${node.transform.rotationDeg}deg) scale(${node.transform.scaleX},${node.transform.scaleY})`}}/>)}<div style={{position:'absolute',right:10,bottom:10,...badge}}>rendering 96 representatives · evaluating all {Object.keys(stressScene.nodes).length}</div></div>
      </div>
      <div style={{display:'grid',gap:14}}>
        <section style={panel}><div style={label}>Measured runtime</div><h3 style={{margin:'7px 0'}}>{full?`${evalP95.toFixed(2)} ms p95 prepared frame evaluation`:'collecting browser samples…'}</h3><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:7,fontSize:12,color:'#b8bdc6'}}><span style={badge}>baseline seek {evidence.seek.baselineMs.toFixed(1)} ms</span><span style={badge}>prepared seek {evidence.seek.preparedMs.toFixed(1)} ms</span><span style={badge}>tracking {evidence.tracking.durationMs.toFixed(1)} ms</span><span style={badge}>camera {evidence.camera.durationMs.toFixed(1)} ms</span></div></section>
        <section style={panel}><div style={label}>Reliability gates</div><div style={{display:'grid',gap:7,marginTop:9}}><span style={badge}>direct/back/random seek {evidence.seek.equal?'PASS':'FAIL'}</span><span style={badge}>tracking + camera seek {evidence.tracking.directSeekEqual&&evidence.camera.directSeekEqual?'PASS':'FAIL'}</span><span style={badge}>serialization {evidence.serialization.ok?'PASS':'FAIL'} · {evidence.serialization.cycles} cycles</span><span style={badge}>long project cleanup {evidence.lifecycle.ok?'PASS':'FAIL'} · leaks {evidence.lifecycle.finalResources}</span><span style={badge}>Expert Runtime host budget {evidence.expertBudgetOk?'PASS':'FAIL'}</span></div></section>
      </div>
    </section>
    <section style={{maxWidth:1480,margin:'14px auto 0',...panel}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'end',gap:12,marginBottom:10}}><div><div style={label}>Preview / export parity</div><h3 style={{margin:'5px 0'}}>Two evaluation paths, one canonical graph</h3></div><span style={badge}>graph parity {evidence.parity.ok?'PASS':'FAIL'} · browser audit compares text pixels</span></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,justifyItems:'center'}}><div><div style={{...label,marginBottom:6}}>prepared preview</div><TextSurface frame={previewText} kind="preview"/></div><div><div style={{...label,marginBottom:6}}>one-shot export projection</div><TextSurface frame={exportText} kind="export"/></div></div></section>
    <footer style={{maxWidth:1480,margin:'14px auto 0',...panel,fontSize:12,color:'#a7adb8'}}>V1.5 keeps one Motion Graph, one exact 1,440,000-tick clock, one Library registry and one transaction/Undo authority. Performance measurements, stress fixtures and bridge inspections are evidence/adapters only.</footer>
  </main>
}
