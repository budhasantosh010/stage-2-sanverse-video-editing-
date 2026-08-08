import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { MotionAspectRatio, MotionComponentDefinitionV1, MotionComponentModuleV1, MotionCompositionV1, MotionFixtureV1, MotionRenderContextV1 } from '@sanverse/motion-contract'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives/frame'

export const RATIO_COMPOSITIONS: Readonly<Record<MotionAspectRatio, MotionCompositionV1>> = Object.freeze({
  '16:9':Object.freeze({width:1920,height:1080,fpsNumerator:30,fpsDenominator:1}),
  '9:16':Object.freeze({width:1080,height:1920,fpsNumerator:30,fpsDenominator:1}),
  '1:1':Object.freeze({width:1080,height:1080,fpsNumerator:30,fpsDenominator:1}),
  '4:5':Object.freeze({width:1080,height:1350,fpsNumerator:30,fpsDenominator:1}),
})
export const randomSeekSequence=Object.freeze([0,250,40,700,0,315,250])
const canonicalize=(value:unknown):unknown=>Array.isArray(value)?value.map(canonicalize):value&&typeof value==='object'?Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonicalize(v)])):value
export const stableSnapshot=(value:unknown):string=>JSON.stringify(canonicalize(value))
export interface DeterminismReport { readonly ok:boolean; readonly repeatedTicks:readonly number[]; readonly mismatches:readonly {readonly tick:number;readonly first:string;readonly repeated:string}[] }
export const evaluateDeterminism=<State>(evaluate:(tick:number)=>State,ticks:readonly number[]=randomSeekSequence):DeterminismReport=>{
  const seen=new Map<number,string>(),repeatedTicks:number[]=[],mismatches:{tick:number;first:string;repeated:string}[]=[]
  for(const tick of ticks){ const snapshot=stableSnapshot(evaluate(tick)); const first=seen.get(tick); if(first===undefined) seen.set(tick,snapshot); else { repeatedTicks.push(tick); if(first!==snapshot) mismatches.push({tick,first,repeated:snapshot}) } }
  return {ok:mismatches.length===0,repeatedTicks,mismatches}
}
export const renderComponentMarkup=<Props,Style>(module:MotionComponentModuleV1<Props,Style>,props:Props,style:Style,context:MotionRenderContextV1):string=>renderToStaticMarkup(createElement(module.Component,{props,style,context}))
export const evaluateMarkupDeterminism=<Props,Style>(module:MotionComponentModuleV1<Props,Style>,props:Props,style:Style,baseContext:Omit<MotionRenderContextV1,'localTicks'>,ticks:readonly number[]=randomSeekSequence):DeterminismReport=>evaluateDeterminism((localTicks)=>renderComponentMarkup(module,props,style,{...baseContext,localTicks}),ticks)
export const ratioMatrix=<T>(evaluate:(ratio:MotionAspectRatio,composition:MotionCompositionV1)=>T):Readonly<Record<MotionAspectRatio,T>>=>({ '16:9':evaluate('16:9',RATIO_COMPOSITIONS['16:9']), '9:16':evaluate('9:16',RATIO_COMPOSITIONS['9:16']), '1:1':evaluate('1:1',RATIO_COMPOSITIONS['1:1']), '4:5':evaluate('4:5',RATIO_COMPOSITIONS['4:5']) })
export const validateDefinition=(definition:MotionComponentDefinitionV1):readonly string[]=>{
  const issues:string[]=[]
  if(!definition.id.startsWith('sanverse.')) issues.push('id must use sanverse.* namespace')
  if(!Number.isSafeInteger(definition.version)||definition.version<=0) issues.push('version must be a positive integer')
  if(!(definition.minDurationTicks>0&&definition.minDurationTicks<=definition.defaultDurationTicks&&definition.defaultDurationTicks<=definition.maxDurationTicks)) issues.push('duration bounds must satisfy 0 < min <= default <= max')
  const names=new Set<string>()
  for(const event of definition.events){ if(!event.name.trim()) issues.push('event name cannot be empty'); if(event.normalizedTime<0||event.normalizedTime>1||!Number.isFinite(event.normalizedTime)) issues.push(`event ${event.name} must be inside [0, 1]`); if(names.has(event.name)) issues.push(`event ${event.name} is duplicated`); names.add(event.name) }
  return issues
}
export const validateFixture=<Props,Style>(fixture:MotionFixtureV1<Props,Style>):readonly string[]=>{
  const issues:string[]=[]; if(!fixture.id.trim()) issues.push('fixture id cannot be empty'); if(fixture.durationTicks<=0||!Number.isSafeInteger(fixture.durationTicks)) issues.push('durationTicks must be a positive safe integer'); for(const tick of fixture.sampleTicks) if(!Number.isSafeInteger(tick)||tick<0||tick>fixture.durationTicks) issues.push(`sample tick ${tick} is outside fixture duration`); return issues
}
export interface OverflowIssue { readonly element:HTMLElement; readonly horizontalOverflow:number; readonly verticalOverflow:number }
export const detectTextOverflow=(root:HTMLElement):readonly OverflowIssue[]=>[root,...Array.from(root.querySelectorAll<HTMLElement>('[data-motion-text]'))].map(element=>({element,horizontalOverflow:Math.max(0,element.scrollWidth-element.clientWidth),verticalOverflow:Math.max(0,element.scrollHeight-element.clientHeight)})).filter(issue=>issue.horizontalOverflow>0||issue.verticalOverflow>0)
const patterns=[/\bDate\.now\s*\(/,/\bperformance\.now\s*\(/,/\bMath\.random\s*\(/,/\bsetInterval\s*\(/,/\bsetTimeout\s*\(/,/@keyframes\b/,/\.animate\s*\(/] as const
export const findForbiddenAnimationAuthorities=(source:string):readonly string[]=>{ const names=['Date.now','performance.now','Math.random','setInterval','setTimeout','@keyframes','Element.animate']; return patterns.flatMap((pattern,index)=>pattern.test(source)?[names[index]!]:[]) }
export const defaultRenderContext=(composition:MotionCompositionV1,durationTicks=SANVERSE_TICKS_PER_SECOND*3):MotionRenderContextV1=>({localTicks:0,durationTicks,ticksPerSecond:SANVERSE_TICKS_PER_SECOND,composition,reducedMotion:false})
