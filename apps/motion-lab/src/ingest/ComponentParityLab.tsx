import { useEffect, useMemo, useRef, useState } from 'react'
import type { MotionAspectRatio, MotionRenderContextV1 } from '@sanverse/motion-contract'
import {
  FrostedIconRailModule, ProgressiveChoiceStackModule, KineticPhraseModule, ExplainerBoardModule,
  MilestoneStageModule, FeatureMatrixModule, MediaCutawayModule, StatBurstModule,
  FloatingValueCloudModule, CtaPillModule, MOTION_REFERENCE_COMPOSITIONS,
} from '@sanverse/motion-library'
import { MotionComponentHost, MotionCompositionFrame } from '@sanverse/motion-native-runtime'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import approvedRuntime from '../../../../motion/component-intake/sanverse.icon-rail/original/shared/components.js?raw'
import approvedStyles from '../../../../motion/component-intake/sanverse.icon-rail/original/shared/styles.css?raw'

const ratios=Object.freeze(['9:16','16:9','1:1','4:5'] as const)
const viewerWidths:Record<MotionAspectRatio,number>={'9:16':360,'16:9':620,'1:1':480,'4:5':420}
const checker='repeating-conic-gradient(#e9e9e9 0 25%, #ffffff 0 50%) 50% / 18px 18px'
interface ParityConfig { readonly componentId:string; readonly sourceId:string; readonly sourceHash:string; readonly module:any; readonly registered:boolean }
const configs=Object.freeze([
  {componentId:'sanverse.icon-rail',sourceId:'icon-rail',sourceHash:'428e6e328f366417f3e13fb8dcbca388238e1d196f78ec5243fa97a3e374ce39',module:FrostedIconRailModule,registered:true},
  {componentId:'sanverse.progressive-choice-stack',sourceId:'progressive-choice-stack',sourceHash:'697b21bba018860150dbd572d6650c2d12339352e719c306dcdd6b18ddada62d',module:ProgressiveChoiceStackModule,registered:true},
  {componentId:'sanverse.kinetic-phrase',sourceId:'kinetic-phrase',sourceHash:'264cab44f47019327ce89c7d68e8a31aede6022340568d459db5d69232523c72',module:KineticPhraseModule,registered:true},
  {componentId:'sanverse.explainer-board',sourceId:'explainer-board',sourceHash:'a327f01bb1872e4dbcf65e73392d05fd4557f2f6ce466ab1006a366c6cdda4a5',module:ExplainerBoardModule,registered:true},
  {componentId:'sanverse.milestone-stage',sourceId:'milestone-stage',sourceHash:'3f28fcd25d666c550d804502a68be49984c3f9e2b40036c59aec3446b31d7be3',module:MilestoneStageModule,registered:true},
  {componentId:'sanverse.feature-matrix',sourceId:'feature-matrix',sourceHash:'f9f9bab8dce98eac0ae4d3149d11c06966aef47ec93db656eb0a891af3a34703',module:FeatureMatrixModule,registered:true},
  {componentId:'sanverse.media-cutaway',sourceId:'media-cutaway',sourceHash:'8fed16b8aabe33e78db84150e721717b171ddc77ce9560ef6b0d8e142b75bee4',module:MediaCutawayModule,registered:true},
  {componentId:'sanverse.stat-burst',sourceId:'stat-burst',sourceHash:'12e2c7adf5a74c3340712e2c91fb973b2eb51c26692a6f594696bf18b6335ce0',module:StatBurstModule,registered:true},
  {componentId:'sanverse.floating-value-cloud',sourceId:'floating-value-cloud',sourceHash:'8e929b9ab61a3a1c70558450f1db88a084f74f6d1157d727d4ba9ec4a1dca1d3',module:FloatingValueCloudModule,registered:true},
  {componentId:'sanverse.cta-pill',sourceId:'cta-pill',sourceHash:'cc209d131f6d71434a0a7aaeb2242748e81f27bfd1f125cfa4594a0f4f93a68e',module:CtaPillModule,registered:true},
] satisfies readonly ParityConfig[])
const configById=new Map(configs.map(config=>[config.componentId,config]))
const currentComponentId=()=>decodeURIComponent(window.location.pathname.slice('/ingest/parity/'.length))
const clampTick=(value:number,durationTicks:number)=>Math.max(0,Math.min(durationTicks,Number.isFinite(value)?Math.round(value):0))
const approvedStyle=(config:ParityConfig,reducedMotion:boolean)=>Object.freeze({...config.module.defaultStyle,reducedMotion})
const sourceShape=(ratio:MotionAspectRatio)=>ratio==='9:16'?'portrait':ratio==='16:9'?'landscape':'balanced'

function approvedSourceDocument(config:ParityConfig,ratio:MotionAspectRatio,tick:number,reducedMotion:boolean):string {
  const runtime=approvedRuntime.replaceAll('</script>','<\\/script>')
  const style=JSON.stringify(approvedStyle(config,reducedMotion))
  const durationTicks=config.module.definition.defaultDurationTicks
  return `<!doctype html><html><head><meta charset="utf-8"><style>${approvedStyles}\nhtml,body{margin:0;width:100%;height:100%;overflow:hidden;background:${checker}}#approved-viewport{position:relative;container-type:size;width:100%!important;height:100%!important;aspect-ratio:auto!important;overflow:hidden!important;border:0!important;border-radius:0!important;box-shadow:none!important}</style></head><body><div id="approved-viewport" class="component-viewport" data-ratio="${ratio}" data-shape="${sourceShape(ratio)}"><div id="approved-output"></div></div><script>${runtime}</script><script>(()=>{const api=window.CH1_COMPONENTS;const component=api.CATALOG.find(item=>item.id==='${config.sourceId}');if(!component)throw new Error('Approved ${config.sourceId} source missing.');document.getElementById('approved-output').innerHTML=api.renderAt(component,component.defaults,${style},${tick},${durationTicks});document.documentElement.dataset.sourceReady='true';})();<\/script></body></html>`
}
function ApprovedSourceStage({config,ratio,tick,reducedMotion}:Readonly<{config:ParityConfig;ratio:MotionAspectRatio;tick:number;reducedMotion:boolean}>) {
  const width=viewerWidths[ratio],composition=MOTION_REFERENCE_COMPOSITIONS[ratio],height=Math.round(width*composition.height/composition.width)
  const srcDoc=useMemo(()=>approvedSourceDocument(config,ratio,tick,reducedMotion),[config,ratio,tick,reducedMotion])
  return <iframe title={`Owner-approved ${config.module.definition.name} source`} data-ingest-approved-source={config.componentId} srcDoc={srcDoc} sandbox="allow-scripts" style={{display:'block',width,height,border:0,background:'transparent'}} />
}
function IntegratedStage({config,ratio,tick,reducedMotion}:Readonly<{config:ParityConfig;ratio:MotionAspectRatio;tick:number;reducedMotion:boolean}>) {
  const composition=MOTION_REFERENCE_COMPOSITIONS[ratio],width=viewerWidths[ratio],displayScale=width/composition.width,durationTicks=config.module.definition.defaultDurationTicks
  const context:MotionRenderContextV1={localTicks:tick,durationTicks,ticksPerSecond:SANVERSE_TICKS_PER_SECOND,composition,reducedMotion}
  return <div data-ingest-integrated={config.componentId} style={{width:composition.width*displayScale,height:composition.height*displayScale,background:checker,overflow:'hidden'}}><MotionCompositionFrame composition={composition} displayScale={displayScale} background="transparent"><MotionComponentHost module={config.module} props={config.module.defaultProps} style={config.module.defaultStyle} context={context} /></MotionCompositionFrame></div>
}

export function ComponentParityLab() {
  const config=configById.get(currentComponentId())
  if(!config) return <main style={{padding:32,fontFamily:'system-ui',background:'#0d0f12',color:'#fff',minHeight:'100vh'}}><h1>Unknown ingest component</h1><p>{currentComponentId()}</p></main>
  const durationTicks=config.module.definition.defaultDurationTicks,params=new URLSearchParams(window.location.search),requestedRatio=params.get('ratio') as MotionAspectRatio|null,capture=params.get('capture'),fixedTick=params.has('tick')?clampTick(Number(params.get('tick')),durationTicks):null
  const [ratio,setRatio]=useState<MotionAspectRatio>(requestedRatio&&ratios.includes(requestedRatio)?requestedRatio:'9:16'),[tick,setTick]=useState(fixedTick??0),[playing,setPlaying]=useState(false),[reducedMotion,setReducedMotion]=useState(false),playback=useRef({startTime:0,startTick:0})
  useEffect(()=>{if(!playing||fixedTick!==null)return;playback.current={startTime:performance.now(),startTick:tick};let frame=0;const animate=(now:number)=>{const next=clampTick(playback.current.startTick+(now-playback.current.startTime)/1000*SANVERSE_TICKS_PER_SECOND,durationTicks);setTick(next);if(next>=durationTicks){setPlaying(false);return}frame=requestAnimationFrame(animate)};frame=requestAnimationFrame(animate);return()=>cancelAnimationFrame(frame)},[playing,fixedTick,durationTicks,tick])
  if(capture==='source') return <div data-parity-capture="source" style={{position:'fixed',inset:0,display:'grid',placeItems:'center',background:checker}}><ApprovedSourceStage config={config} ratio={ratio} tick={tick} reducedMotion={reducedMotion} /></div>
  if(capture==='integrated') return <div data-parity-capture="integrated" style={{position:'fixed',inset:0,display:'grid',placeItems:'center',background:checker}}><IntegratedStage config={config} ratio={ratio} tick={tick} reducedMotion={reducedMotion} /></div>
  const progress=tick/durationTicks
  return <main data-component-parity-lab={config.componentId} style={{minHeight:'100vh',padding:24,boxSizing:'border-box',background:'#0d0f12',color:'#f5f7fb',fontFamily:'Inter,system-ui,sans-serif'}}>
    <nav style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>{configs.map((item,index)=><a key={item.componentId} href={`/ingest/parity/${encodeURIComponent(item.componentId)}`} style={{padding:'6px 9px',borderRadius:7,textDecoration:'none',fontSize:11,fontWeight:800,background:item.componentId===config.componentId?'#2f67ff':'#1a1e26',color:'#fff',border:'1px solid #2b313c'}}>{String(index+1).padStart(2,'0')} · {item.module.definition.name}</a>)}</nav>
    <header style={{display:'flex',justifyContent:'space-between',gap:24,alignItems:'end',marginBottom:18}}><div><div style={{fontSize:11,letterSpacing:'.14em',color:'#8c96a8'}}>SANVERSE COMPONENT INGEST V1 · VISUAL PARITY</div><h1 style={{margin:'6px 0 4px',fontSize:28}}>{config.module.definition.name}</h1><div style={{color:'#9ba5b5',fontSize:13}}>Approved CH1 snapshot <code>{config.sourceHash.slice(0,8)}…</code> → canonical Motion Graph integration</div></div><div style={{textAlign:'right',fontSize:12,color:'#9ba5b5'}}>PUBLIC REGISTRY<br/><strong style={{color:config.registered?'#71e69a':'#f5f7fb'}}>{config.registered?'REGISTERED':'PARITY GATE'}</strong></div></header>
    <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,alignItems:'start'}}><div><div style={{marginBottom:8,fontSize:12,fontWeight:800,letterSpacing:'.08em'}}>APPROVED ORIGINAL</div><div style={{minHeight:700,display:'grid',placeItems:'center',border:'1px solid #272c35',borderRadius:12,background:'#171a20',overflow:'auto',padding:16}}><ApprovedSourceStage config={config} ratio={ratio} tick={tick} reducedMotion={reducedMotion}/></div></div><div><div style={{marginBottom:8,fontSize:12,fontWeight:800,letterSpacing:'.08em'}}>SANVERSE INTEGRATED</div><div style={{minHeight:700,display:'grid',placeItems:'center',border:'1px solid #272c35',borderRadius:12,background:'#171a20',overflow:'auto',padding:16}}><IntegratedStage config={config} ratio={ratio} tick={tick} reducedMotion={reducedMotion}/></div></div></section>
    <section style={{marginTop:18,padding:16,border:'1px solid #272c35',borderRadius:12,background:'#13161b'}}><div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}><button onClick={()=>{setPlaying(false);setTick(0)}}>↻ Restart</button><button onClick={()=>setPlaying(value=>!value)}>{playing?'❚❚ Pause':'▶ Play 1×'}</button>{ratios.map(value=><button key={value} onClick={()=>setRatio(value)} disabled={ratio===value}>{value}</button>)}<label style={{marginLeft:8}}><input type="checkbox" checked={reducedMotion} onChange={event=>setReducedMotion(event.target.checked)}/> Reduced motion</label></div><input aria-label="Shared parity playhead" type="range" min={0} max={durationTicks} step={1} value={tick} onChange={event=>{setPlaying(false);setTick(clampTick(Number(event.target.value),durationTicks))}} style={{width:'100%',marginTop:14}}/><div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontFamily:'ui-monospace,monospace',fontSize:12,color:'#9ba5b5'}}><span>tick {tick.toLocaleString()} · {(progress*100).toFixed(2)}%</span><span>{(tick/SANVERSE_TICKS_PER_SECOND).toFixed(3)} / {(durationTicks/SANVERSE_TICKS_PER_SECOND).toFixed(3)}s · exact tick authority 1,440,000 t/s</span></div></section>
  </main>
}
