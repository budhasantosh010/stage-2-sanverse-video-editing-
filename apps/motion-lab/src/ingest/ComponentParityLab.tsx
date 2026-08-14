import { useEffect, useMemo, useRef, useState } from 'react'
import type { MotionAspectRatio, MotionRenderContextV1 } from '@sanverse/motion-contract'
import { DEFAULT_FROSTED_ICON_RAIL_PROPS, DEFAULT_FROSTED_ICON_RAIL_STYLE, FrostedIconRailModule, MOTION_REFERENCE_COMPOSITIONS } from '@sanverse/motion-library'
import { MotionComponentHost, MotionCompositionFrame } from '@sanverse/motion-native-runtime'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import approvedRuntime from '../../../../motion/component-intake/sanverse.icon-rail/original/shared/components.js?raw'
import approvedStyles from '../../../../motion/component-intake/sanverse.icon-rail/original/shared/styles.css?raw'

const ratios=Object.freeze(['9:16','16:9','1:1','4:5'] as const)
const viewerWidths:Record<MotionAspectRatio,number>={'9:16':360,'16:9':620,'1:1':480,'4:5':420}
const checker='repeating-conic-gradient(#e9e9e9 0 25%, #ffffff 0 50%) 50% / 18px 18px'
const clampTick=(value:number)=>Math.max(0,Math.min(SANVERSE_TICKS_PER_SECOND,Number.isFinite(value)?Math.round(value):0))

const approvedStyle=(reducedMotion:boolean)=>Object.freeze({...DEFAULT_FROSTED_ICON_RAIL_STYLE,reducedMotion})

function approvedSourceDocument(ratio:MotionAspectRatio,tick:number,reducedMotion:boolean):string {
  const runtime=approvedRuntime.replaceAll('</script>','<\\/script>')
  const ratioValue=ratio==='16:9'?16/9:ratio==='9:16'?9/16:ratio==='4:5'?4/5:1
  const style=JSON.stringify(approvedStyle(reducedMotion))
  return `<!doctype html><html><head><meta charset="utf-8"><style>${approvedStyles}\nhtml,body{margin:0;width:100%;height:100%;overflow:hidden;background:${checker}}#approved-viewport{position:relative;container-type:size;width:100%!important;height:100%!important;aspect-ratio:auto!important;overflow:hidden!important;border:0!important;border-radius:0!important;box-shadow:none!important}</style></head><body><div id="approved-viewport" class="component-viewport" data-ratio="${ratio}"><div id="approved-output"></div></div><script>${runtime}</script><script>(()=>{const api=window.CH1_COMPONENTS;const component=api.CATALOG.find(item=>item.id==='icon-rail');if(!component)throw new Error('Approved icon-rail source missing.');document.getElementById('approved-output').innerHTML=api.renderAt(component,component.defaults,${style},${tick},${SANVERSE_TICKS_PER_SECOND});document.documentElement.dataset.sourceReady='true';document.documentElement.dataset.ratio='${ratio}';document.documentElement.dataset.aspect='${ratioValue}';})();<\/script></body></html>`
}

function ApprovedSourceStage({ratio,tick,reducedMotion}:Readonly<{ratio:MotionAspectRatio;tick:number;reducedMotion:boolean}>) {
  const width=viewerWidths[ratio]
  const composition=MOTION_REFERENCE_COMPOSITIONS[ratio]
  const height=Math.round(width*composition.height/composition.width)
  const srcDoc=useMemo(()=>approvedSourceDocument(ratio,tick,reducedMotion),[ratio,tick,reducedMotion])
  return <iframe title="Owner-approved CH1 source" data-ingest-approved-source="sanverse.icon-rail" srcDoc={srcDoc} sandbox="allow-scripts" style={{display:'block',width,height,border:0,background:'transparent'}} />
}

function IntegratedStage({ratio,tick,reducedMotion}:Readonly<{ratio:MotionAspectRatio;tick:number;reducedMotion:boolean}>) {
  const composition=MOTION_REFERENCE_COMPOSITIONS[ratio]
  const width=viewerWidths[ratio]
  const displayScale=width/composition.width
  const context:MotionRenderContextV1={localTicks:tick,durationTicks:SANVERSE_TICKS_PER_SECOND,ticksPerSecond:SANVERSE_TICKS_PER_SECOND,composition,reducedMotion}
  return <div data-ingest-integrated="sanverse.icon-rail" style={{width:composition.width*displayScale,height:composition.height*displayScale,background:checker,overflow:'hidden'}}><MotionCompositionFrame composition={composition} displayScale={displayScale} background="transparent"><MotionComponentHost module={FrostedIconRailModule} props={DEFAULT_FROSTED_ICON_RAIL_PROPS} style={DEFAULT_FROSTED_ICON_RAIL_STYLE} context={context} /></MotionCompositionFrame></div>
}

export function ComponentParityLab() {
  const params=new URLSearchParams(window.location.search)
  const requestedRatio=params.get('ratio') as MotionAspectRatio|null
  const capture=params.get('capture')
  const fixedTick=params.has('tick')?clampTick(Number(params.get('tick'))):null
  const [ratio,setRatio]=useState<MotionAspectRatio>(requestedRatio&&ratios.includes(requestedRatio)?requestedRatio:'9:16')
  const [tick,setTick]=useState(fixedTick??0)
  const [playing,setPlaying]=useState(false)
  const [reducedMotion,setReducedMotion]=useState(false)
  const playback=useRef({startTime:0,startTick:0})
  useEffect(()=>{
    if(!playing||fixedTick!==null)return
    playback.current={startTime:performance.now(),startTick:tick}
    let frame=0
    const animate=(now:number)=>{
      const next=clampTick(playback.current.startTick+(now-playback.current.startTime)/1000*SANVERSE_TICKS_PER_SECOND)
      setTick(next)
      if(next>=SANVERSE_TICKS_PER_SECOND){setPlaying(false);return}
      frame=requestAnimationFrame(animate)
    }
    frame=requestAnimationFrame(animate)
    return()=>cancelAnimationFrame(frame)
  },[playing,fixedTick])
  if(capture==='source') return <div data-parity-capture="source" style={{position:'fixed',inset:0,display:'grid',placeItems:'center',background:checker}}><ApprovedSourceStage ratio={ratio} tick={tick} reducedMotion={reducedMotion} /></div>
  if(capture==='integrated') return <div data-parity-capture="integrated" style={{position:'fixed',inset:0,display:'grid',placeItems:'center',background:checker}}><IntegratedStage ratio={ratio} tick={tick} reducedMotion={reducedMotion} /></div>
  const progress=tick/SANVERSE_TICKS_PER_SECOND
  return <main data-component-parity-lab="sanverse.icon-rail" style={{minHeight:'100vh',padding:24,boxSizing:'border-box',background:'#0d0f12',color:'#f5f7fb',fontFamily:'Inter,system-ui,sans-serif'}}>
    <header style={{display:'flex',justifyContent:'space-between',gap:24,alignItems:'end',marginBottom:18}}><div><div style={{fontSize:11,letterSpacing:'.14em',color:'#8c96a8'}}>SANVERSE COMPONENT INGEST V1 · VISUAL PARITY</div><h1 style={{margin:'6px 0 4px',fontSize:28}}>Frosted Icon Rail</h1><div style={{color:'#9ba5b5',fontSize:13}}>Approved CH1 snapshot <code>428e6e32…</code> → canonical Motion Graph integration</div></div><div style={{textAlign:'right',fontSize:12,color:'#9ba5b5'}}>PUBLIC REGISTRY<br/><strong style={{color:'#f5f7fb'}}>NOT REGISTERED</strong></div></header>
    <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,alignItems:'start'}}>
      <div><div style={{marginBottom:8,fontSize:12,fontWeight:800,letterSpacing:'.08em'}}>APPROVED ORIGINAL</div><div style={{minHeight:700,display:'grid',placeItems:'center',border:'1px solid #272c35',borderRadius:12,background:'#171a20',overflow:'auto',padding:16}}><ApprovedSourceStage ratio={ratio} tick={tick} reducedMotion={reducedMotion}/></div></div>
      <div><div style={{marginBottom:8,fontSize:12,fontWeight:800,letterSpacing:'.08em'}}>SANVERSE INTEGRATED</div><div style={{minHeight:700,display:'grid',placeItems:'center',border:'1px solid #272c35',borderRadius:12,background:'#171a20',overflow:'auto',padding:16}}><IntegratedStage ratio={ratio} tick={tick} reducedMotion={reducedMotion}/></div></div>
    </section>
    <section style={{marginTop:18,padding:16,border:'1px solid #272c35',borderRadius:12,background:'#13161b'}}>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}><button onClick={()=>{setPlaying(false);setTick(0)}}>↻ Restart</button><button onClick={()=>setPlaying(value=>!value)}>{playing?'❚❚ Pause':'▶ Play 1×'}</button>{ratios.map(value=><button key={value} onClick={()=>setRatio(value)} disabled={ratio===value}>{value}</button>)}<label style={{marginLeft:8}}><input type="checkbox" checked={reducedMotion} onChange={event=>setReducedMotion(event.target.checked)}/> Reduced motion</label></div>
      <input aria-label="Shared parity playhead" type="range" min={0} max={SANVERSE_TICKS_PER_SECOND} step={1} value={tick} onChange={event=>{setPlaying(false);setTick(clampTick(Number(event.target.value)))}} style={{width:'100%',marginTop:14}}/>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontFamily:'ui-monospace,monospace',fontSize:12,color:'#9ba5b5'}}><span>tick {tick.toLocaleString()} · {(progress*100).toFixed(2)}%</span><span>{(tick/SANVERSE_TICKS_PER_SECOND).toFixed(3)} / 1.000s · exact tick authority 1,440,000 t/s</span></div>
    </section>
  </main>
}
