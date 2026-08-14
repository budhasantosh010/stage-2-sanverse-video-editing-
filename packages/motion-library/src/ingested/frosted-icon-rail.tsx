import type { CSSProperties } from 'react'
import type { MotionAspectRatio, MotionComponentRenderPropsV1, MotionRenderContextV1, MotionValidationResultV1 } from '@sanverse/motion-contract'
import type { Animatable, MotionExposureV1, MotionGraphBackedComponentModuleV1, MotionSceneV1, ResolvedMotionNodeV1 } from '@sanverse/motion-graph'
import { constant, createMotionScene, keyframed } from '@sanverse/motion-graph'
import { easeInCubic, easeOutBack, easeOutCubic, lerp, normalizedProgress, SANVERSE_TICKS_PER_SECOND, sequenceProgress } from '@sanverse/motion-primitives'
import { mergeMotionGraphNodeDecorationStyle, mergeMotionGraphNodeStyle, useMotionGraphPresentation } from '@sanverse/motion-native-runtime'
import { FULL_NATIVE_GRAPH_CAPABILITIES, graphGroup, graphShape, graphText, responsiveGraphLayout } from '../graph-common.ts'
import { mBackOut, mConst, mEase, mLerp, mNumber, mProgress, mReduced, mSequence } from '../graph-motion.ts'
import { isRecord, unknownFieldIssues, validationFailure, validationSuccess, valueIssue } from '../validation.ts'

export const FROSTED_ICON_RAIL_SOURCE = Object.freeze({
  visualWorkspace: 'Component CH1',
  sourceComponent: '01-icon-rail',
  approvedAt: '2026-08-14',
  integrationStrategy: 'foreign-adapter/lossless-normalization',
  renderer: 'renderIconRail',
} as const)

export const FROSTED_ICON_RAIL_AI_EDIT_PLAN = Object.freeze([
  { command:'Change the icons.', exposureId:'rail.glyphs', operation:'set-component-property' },
  { command:'Make the rail vertical.', exposureId:'rail.direction', operation:'set-component-property' },
  { command:'Change the accent to blue.', exposureId:'rail.accent', operation:'set-component-property' },
  { command:'Move the rail lower.', exposureId:'rail.position-y', operation:'set-node-property' },
  { command:'Make the rail larger.', exposureId:'rail.scale-x', operation:'set-node-property' },
  { command:'Make the corners less round.', exposureId:'rail.radius', operation:'set-node-property' },
  { command:'Slow down the icon reveal.', exposureId:'rail.parts', operation:'retime-keyframes' },
] as const)

export const FROSTED_ICON_RAIL_PLACEMENTS = Object.freeze(['center','top-safe','bottom-safe','left-safe','right-safe'] as const)
export type FrostedIconRailPlacement = (typeof FROSTED_ICON_RAIL_PLACEMENTS)[number]
export const FROSTED_ICON_RAIL_ENTRANCES = Object.freeze(['rise-soft','pop','slide'] as const)
export type FrostedIconRailEntrance = (typeof FROSTED_ICON_RAIL_ENTRANCES)[number]
export const FROSTED_ICON_RAIL_EXITS = Object.freeze(['fade-drop','scale','slide','none'] as const)
export type FrostedIconRailExit = (typeof FROSTED_ICON_RAIL_EXITS)[number]

export interface FrostedIconRailProps {
  readonly labels: readonly string[]
  readonly glyphs: readonly string[]
  readonly direction: 'horizontal' | 'vertical'
}

export interface FrostedIconRailStyle {
  readonly backgroundColor: string
  readonly backgroundOpacity: number
  readonly positionPreset: FrostedIconRailPlacement
  readonly offsetX: number
  readonly offsetY: number
  readonly scale: number
  readonly rotation: number
  readonly opacity: number
  readonly fontFamily: string
  readonly typeScale: number
  readonly fontWeight: number
  readonly textColor: string
  readonly accentColor: string
  readonly surfaceColor: string
  readonly highlightColor: string
  readonly borderColor: string
  readonly borderWidth: number
  readonly surfaceOpacity: number
  readonly radius: number
  readonly padding: number
  readonly spacing: number
  readonly shadowStrength: number
  readonly blur: number
  readonly entranceStyle: FrostedIconRailEntrance
  readonly exitStyle: FrostedIconRailExit
  readonly motionIntensity: number
  readonly stagger: number
}

export interface FrostedIconRailLayoutV1 {
  readonly designWidth: number
  readonly designScale: number
  readonly tileSize: number
  readonly glyphSize: number
  readonly glyphRadius: number
  readonly glyphFontSize: number
  readonly padding: number
  readonly spacing: number
  readonly railWidth: number
  readonly railHeight: number
  readonly radius: number
  readonly tileRadius: number
  readonly blur: number
  readonly borderWidth: number
}

export interface FrostedIconRailItemStateV1 {
  readonly opacity: number
  readonly translateY: number
  readonly scale: number
}

export interface FrostedIconRailStateV1 {
  readonly progress: number
  readonly opacity: number
  readonly positionX: number
  readonly positionY: number
  readonly scale: number
  readonly rotation: number
  readonly items: readonly FrostedIconRailItemStateV1[]
}

export const DEFAULT_FROSTED_ICON_RAIL_PROPS: FrostedIconRailProps = Object.freeze({
  labels: Object.freeze(['A','B','C']),
  glyphs: Object.freeze(['◆','✦','∞']),
  direction: 'horizontal',
})

/** Exact owner-approved CH1 visual defaults. Icon Rail adds top-safe + 0.92 scale to the shared CH1 default. */
export const DEFAULT_FROSTED_ICON_RAIL_STYLE: FrostedIconRailStyle = Object.freeze({
  backgroundColor: '#111111',
  backgroundOpacity: 0,
  positionPreset: 'top-safe',
  offsetX: 0,
  offsetY: 0,
  scale: 0.92,
  rotation: 0,
  opacity: 1,
  fontFamily: 'Arial, Helvetica, sans-serif',
  typeScale: 1,
  fontWeight: 900,
  textColor: '#111111',
  accentColor: '#275EFE',
  surfaceColor: '#FFFFFF',
  highlightColor: '#F7F7C6',
  borderColor: '#D8DCE5',
  borderWidth: 0,
  surfaceOpacity: 0.94,
  radius: 24,
  padding: 20,
  spacing: 12,
  shadowStrength: 0.72,
  blur: 14,
  entranceStyle: 'rise-soft',
  exitStyle: 'fade-drop',
  motionIntensity: 0.72,
  stagger: 0.55,
})

const propFields = ['labels','glyphs','direction'] as const
const styleFields = ['backgroundColor','backgroundOpacity','positionPreset','offsetX','offsetY','scale','rotation','opacity','fontFamily','typeScale','fontWeight','textColor','accentColor','surfaceColor','highlightColor','borderColor','borderWidth','surfaceOpacity','radius','padding','spacing','shadowStrength','blur','entranceStyle','exitStyle','motionIntensity','stagger'] as const
const finiteBetween = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum

export const validateFrostedIconRailProps = (input: unknown): MotionValidationResultV1<FrostedIconRailProps> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$','TYPE_INVALID','Frosted Icon Rail props must be an object.'))
  const issues = [...unknownFieldIssues(input, propFields)]
  if (!Array.isArray(input.labels) || input.labels.length < 1 || input.labels.length > 12 || input.labels.some((value) => typeof value !== 'string' || !value.trim() || value.length > 40)) issues.push(valueIssue('$.labels','VALUE_INVALID','labels must contain 1–12 non-empty strings up to 40 characters.'))
  if (!Array.isArray(input.glyphs) || input.glyphs.length > 12 || input.glyphs.some((value) => typeof value !== 'string' || value.length > 12)) issues.push(valueIssue('$.glyphs','VALUE_INVALID','glyphs must contain at most 12 strings up to 12 characters.'))
  if (input.direction !== 'horizontal' && input.direction !== 'vertical') issues.push(valueIssue('$.direction','VALUE_INVALID','direction must be horizontal or vertical.'))
  if (issues.length) return validationFailure(...issues)
  return validationSuccess(Object.freeze({ labels: Object.freeze([...(input.labels as string[])]), glyphs: Object.freeze([...(input.glyphs as string[])]), direction: input.direction as 'horizontal' | 'vertical' }))
}

export const validateFrostedIconRailStyle = (input: unknown): MotionValidationResultV1<FrostedIconRailStyle> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$','TYPE_INVALID','Frosted Icon Rail style must be an object.'))
  const issues = [...unknownFieldIssues(input, styleFields)]
  for (const key of ['backgroundColor','fontFamily','textColor','accentColor','surfaceColor','highlightColor','borderColor'] as const) if (typeof input[key] !== 'string' || !input[key].trim()) issues.push(valueIssue(`$.${key}`,'VALUE_INVALID',`${key} must be a non-empty string.`))
  const ranges = Object.freeze({ backgroundOpacity:[0,1], offsetX:[-2000,2000], offsetY:[-2000,2000], scale:[0.1,4], rotation:[-360,360], opacity:[0,1], typeScale:[0.25,4], fontWeight:[100,1000], borderWidth:[0,24], surfaceOpacity:[0,1], radius:[0,240], padding:[0,240], spacing:[0,240], shadowStrength:[0,2], blur:[0,120], motionIntensity:[0,1], stagger:[0,1] } as const)
  for (const [key,[minimum,maximum]] of Object.entries(ranges)) if (!finiteBetween(input[key], minimum, maximum)) issues.push(valueIssue(`$.${key}`,'VALUE_OUT_OF_RANGE',`${key} must be finite inside [${minimum},${maximum}].`))
  if (!FROSTED_ICON_RAIL_PLACEMENTS.includes(input.positionPreset as FrostedIconRailPlacement)) issues.push(valueIssue('$.positionPreset','VALUE_INVALID','positionPreset is unsupported.'))
  if (!FROSTED_ICON_RAIL_ENTRANCES.includes(input.entranceStyle as FrostedIconRailEntrance)) issues.push(valueIssue('$.entranceStyle','VALUE_INVALID','entranceStyle is unsupported.'))
  if (!FROSTED_ICON_RAIL_EXITS.includes(input.exitStyle as FrostedIconRailExit)) issues.push(valueIssue('$.exitStyle','VALUE_INVALID','exitStyle is unsupported.'))
  if (issues.length) return validationFailure(...issues)
  return validationSuccess(Object.freeze(input as unknown as FrostedIconRailStyle))
}

const validateContext = (context: MotionRenderContextV1): void => {
  if (!Number.isSafeInteger(context.localTicks) || context.localTicks < 0 || context.localTicks > context.durationTicks) throw new RangeError('Frosted Icon Rail localTicks must be an exact in-range tick.')
  if (!Number.isSafeInteger(context.durationTicks) || context.durationTicks <= 0) throw new RangeError('Frosted Icon Rail durationTicks must be positive.')
  if (context.ticksPerSecond !== SANVERSE_TICKS_PER_SECOND) throw new RangeError('Frosted Icon Rail requires the canonical Sanverse tick authority.')
}

const ratioFor = (context: MotionRenderContextV1): MotionAspectRatio => {
  const ratio = context.composition.width / context.composition.height
  if (Math.abs(ratio - 16/9) < 0.08) return '16:9'
  if (Math.abs(ratio - 9/16) < 0.08) return '9:16'
  if (Math.abs(ratio - 4/5) < 0.08) return '4:5'
  return '1:1'
}
const approvedViewerWidth: Record<MotionAspectRatio, number> = { '9:16':360, '16:9':620, '1:1':480, '4:5':420 }

export const layoutFrostedIconRail = (props: FrostedIconRailProps, style: FrostedIconRailStyle, context: MotionRenderContextV1): FrostedIconRailLayoutV1 => {
  const designWidth = approvedViewerWidth[ratioFor(context)]
  const designScale = context.composition.width / designWidth
  const tileSize = 64 * designScale * style.typeScale
  const glyphSize = 30 * designScale * style.typeScale
  const padding = style.padding * designScale
  const spacing = style.spacing * designScale
  const count = props.labels.length
  const horizontal = props.direction === 'horizontal'
  return Object.freeze({
    designWidth,
    designScale,
    tileSize,
    glyphSize,
    glyphRadius: 10 * designScale,
    glyphFontSize: 15 * designScale * style.typeScale,
    padding,
    spacing,
    railWidth: horizontal ? padding * 2 + tileSize * count + spacing * Math.max(0,count-1) : padding * 2 + tileSize,
    railHeight: horizontal ? padding * 2 + tileSize : padding * 2 + tileSize * count + spacing * Math.max(0,count-1),
    radius: style.radius * designScale,
    tileRadius: style.radius * 0.7 * designScale,
    blur: style.blur * designScale,
    borderWidth: style.borderWidth * designScale,
  })
}

const sourceItemWindow = (index: number, count: number, style: FrostedIconRailStyle, reducedMotion: boolean): Readonly<{ start:number; end:number }> => {
  if (reducedMotion) return Object.freeze({ start:0, end:0.16 })
  const start = 0.02
  const end = 0.58
  const window = Math.max(0.08, end - start)
  const startSpan = window * 0.9 * Math.max(0,Math.min(1,style.stagger))
  const step = count <= 1 ? 0 : startSpan / Math.max(1,count-1)
  const itemStart = start + index * step
  const itemDuration = Math.max(0.08, window * (0.75 - 0.5 * Math.max(0,Math.min(1,style.stagger))))
  return Object.freeze({ start:itemStart, end:Math.min(0.98,itemStart+itemDuration) })
}

const sourcePreset = (style: FrostedIconRailStyle, context: MotionRenderContextV1): Readonly<{ x:number; y:number }> => {
  const x = style.positionPreset === 'left-safe' ? -0.25*context.composition.width : style.positionPreset === 'right-safe' ? 0.25*context.composition.width : 0
  const y = style.positionPreset === 'top-safe' ? -0.27*context.composition.height : style.positionPreset === 'bottom-safe' ? 0.27*context.composition.height : 0
  const scale = context.composition.width / approvedViewerWidth[ratioFor(context)]
  return Object.freeze({ x:x+style.offsetX*scale, y:y+style.offsetY*scale })
}

export const evaluateFrostedIconRailState = (props: FrostedIconRailProps, style: FrostedIconRailStyle, context: MotionRenderContextV1): FrostedIconRailStateV1 => {
  validateContext(context)
  const p = normalizedProgress(context.localTicks, context.durationTicks)
  const intensity = Math.max(0,Math.min(1,style.motionIntensity))
  const enter = easeOutCubic(sequenceProgress(p,0,context.reducedMotion ? 0.10 : 0.18))
  const exit = style.exitStyle === 'none' ? 0 : easeInCubic(sequenceProgress(p,0.84,1))
  let x=0, y=0, scale=1
  if (!context.reducedMotion) {
    if (style.entranceStyle === 'rise-soft') { y += lerp(28*intensity,0,enter); scale *= lerp(0.98,1,enter) }
    else if (style.entranceStyle === 'pop') scale *= lerp(0.86,1,easeOutBack(enter,0.8+intensity))
    else if (style.entranceStyle === 'slide') x += lerp(44*intensity,0,enter)
    if (style.exitStyle === 'fade-drop') y += 22*intensity*exit
    else if (style.exitStyle === 'scale') scale *= lerp(1,0.92,exit)
    else if (style.exitStyle === 'slide') x -= 52*intensity*exit
  }
  const layout = layoutFrostedIconRail(props,style,context)
  const preset = sourcePreset(style,context)
  const items = props.labels.map((_,index) => {
    const window = sourceItemWindow(index,props.labels.length,style,context.reducedMotion)
    const q = easeOutCubic(sequenceProgress(p,window.start,window.end))
    return Object.freeze({ opacity:q, translateY:context.reducedMotion?0:lerp(14*layout.designScale,0,q), scale:context.reducedMotion?1:lerp(0.72,1,easeOutBack(q,0.85)) })
  })
  return Object.freeze({ progress:p, opacity:enter*(1-exit)*style.opacity, positionX:preset.x+x*layout.designScale, positionY:preset.y+y*layout.designScale, scale:scale*style.scale, rotation:style.rotation, items:Object.freeze(items) })
}

const tickAt = (context: MotionRenderContextV1, progress: number): number => Math.round(context.durationTicks * progress)
const easeOutHandlesLeft = Object.freeze({ inX:0, inY:0, outX:1/3, outY:1 })
const easeOutHandlesRight = Object.freeze({ inX:2/3, inY:1, outX:1/3, outY:1/3 })
const easeInHandlesLeft = Object.freeze({ inX:2/3, inY:2/3, outX:1/3, outY:0 })
const easeInHandlesRight = Object.freeze({ inX:2/3, inY:0, outX:1, outY:1 })
const exactEaseOutTrack = (id:string, context:MotionRenderContextV1, start:number, end:number, from:number, to:number): Animatable<number> => {
  const startTick=tickAt(context,start), endTick=tickAt(context,end)
  if (startTick===0) return keyframed([{id:`${id}:start`,tick:0,value:from,interpolation:'bezier',bezier:easeOutHandlesLeft},{id:`${id}:end`,tick:endTick,value:to,interpolation:'linear',bezier:easeOutHandlesRight}])
  return keyframed([{id:`${id}:pre`,tick:0,value:from,interpolation:'hold'},{id:`${id}:start`,tick:startTick,value:from,interpolation:'bezier',bezier:easeOutHandlesLeft},{id:`${id}:end`,tick:endTick,value:to,interpolation:'linear',bezier:easeOutHandlesRight}])
}
const rootOpacityTrack = (context:MotionRenderContextV1, style:FrostedIconRailStyle): Animatable<number> => {
  const enterEnd=context.reducedMotion?0.10:0.18
  if (style.exitStyle==='none') return keyframed([{id:'rail.opacity:start',tick:0,value:0,interpolation:'bezier',bezier:easeOutHandlesLeft},{id:'rail.opacity:shown',tick:tickAt(context,enterEnd),value:style.opacity,interpolation:'linear',bezier:easeOutHandlesRight}])
  return keyframed([
    {id:'rail.opacity:start',tick:0,value:0,interpolation:'bezier',bezier:easeOutHandlesLeft},
    {id:'rail.opacity:shown',tick:tickAt(context,enterEnd),value:style.opacity,interpolation:'linear',bezier:easeOutHandlesRight},
    {id:'rail.opacity:exit',tick:tickAt(context,0.84),value:style.opacity,interpolation:'bezier',bezier:easeInHandlesLeft},
    {id:'rail.opacity:gone',tick:context.durationTicks,value:0,interpolation:'linear',bezier:easeInHandlesRight},
  ])
}
const rootPositionTrack = (axis:'x'|'y', context:MotionRenderContextV1, style:FrostedIconRailStyle, layout:FrostedIconRailLayoutV1): Animatable<number> => {
  const base=sourcePreset(style,context)[axis]
  if (context.reducedMotion) return constant(base)
  const intensity=style.motionIntensity*layout.designScale
  const enterAmount=axis==='y'&&style.entranceStyle==='rise-soft'?28*intensity:axis==='x'&&style.entranceStyle==='slide'?44*intensity:0
  const exitAmount=axis==='y'&&style.exitStyle==='fade-drop'?22*intensity:axis==='x'&&style.exitStyle==='slide'?-52*intensity:0
  if (enterAmount===0&&exitAmount===0) return constant(base)
  return keyframed([
    {id:`rail.${axis}:start`,tick:0,value:base+enterAmount,interpolation:'bezier',bezier:easeOutHandlesLeft},
    {id:`rail.${axis}:settled`,tick:tickAt(context,0.18),value:base,interpolation:'linear',bezier:easeOutHandlesRight},
    {id:`rail.${axis}:exit`,tick:tickAt(context,0.84),value:base,interpolation:'bezier',bezier:easeInHandlesLeft},
    {id:`rail.${axis}:end`,tick:context.durationTicks,value:base+exitAmount,interpolation:'linear',bezier:easeInHandlesRight},
  ])
}
const rootScaleTrack = (context:MotionRenderContextV1, style:FrostedIconRailStyle): Animatable<number> => {
  if (context.reducedMotion) return constant(style.scale)
  if (style.entranceStyle==='rise-soft' && style.exitStyle!=='scale') return exactEaseOutTrack('rail.scale',context,0,0.18,0.98*style.scale,style.scale)
  const enter = style.entranceStyle==='pop'
    ? mLerp(mConst(0.86),mConst(1),mBackOut(mEase('ease-out-cubic',mSequence(0,0.18,mProgress())),0.8+style.motionIntensity))
    : style.entranceStyle==='rise-soft' ? mLerp(mConst(0.98),mConst(1),mEase('ease-out-cubic',mSequence(0,0.18,mProgress()))) : mConst(1)
  const exit = style.exitStyle==='scale' ? mLerp(mConst(1),mConst(0.92),mEase('ease-in-cubic',mSequence(0.84,1,mProgress()))) : mConst(1)
  return mNumber(mLerp(mConst(0),mConst(style.scale),{kind:'multiply',values:[enter,exit]}))
}

export const createFrostedIconRailScene = (props:FrostedIconRailProps, style:FrostedIconRailStyle, context:MotionRenderContextV1): MotionSceneV1 => {
  validateContext(context)
  const propsValidation=validateFrostedIconRailProps(props); if(!propsValidation.ok) throw new RangeError(propsValidation.issues[0]?.message??'Invalid Frosted Icon Rail props.')
  const styleValidation=validateFrostedIconRailStyle(style); if(!styleValidation.ok) throw new RangeError(styleValidation.issues[0]?.message??'Invalid Frosted Icon Rail style.')
  const layout=layoutFrostedIconRail(props,style,context)
  const ids={ componentRoot:'component.root', background:'component.background', root:'rail.root', surface:'rail.surface', items:'rail.items' } as const
  const itemIds=props.labels.map((_,index)=>`rail.item:${index}`)
  const itemSurfaceIds=props.labels.map((_,index)=>`rail.item:${index}.surface`)
  const iconIds=props.labels.map((_,index)=>`rail.icon:${index}`)
  const componentRoot=graphGroup(ids.componentRoot,'Frosted Icon Rail',null,[ids.background,ids.root])
  const backgroundBase=graphShape({id:ids.background,name:'Component Background',parentId:ids.componentRoot,width:context.composition.width,height:context.composition.height,fillColor:style.backgroundColor,strokeColor:'transparent',strokeWidth:0,radius:0})
  const background=Object.freeze({...backgroundBase,opacity:constant(style.backgroundOpacity)})
  const rootBase=graphGroup(ids.root,'Icon Rail',ids.componentRoot,[ids.surface,ids.items])
  const root=Object.freeze({...rootBase,opacity:rootOpacityTrack(context,style),transform:Object.freeze({...rootBase.transform,positionX:rootPositionTrack('x',context,style,layout),positionY:rootPositionTrack('y',context,style,layout),scaleX:rootScaleTrack(context,style),scaleY:rootScaleTrack(context,style),rotationDeg:constant(style.rotation)})})
  const surface=graphShape({id:ids.surface,name:'Frosted Surface',parentId:ids.root,width:layout.railWidth,height:layout.railHeight,fillColor:style.surfaceColor,strokeColor:style.borderColor,strokeWidth:layout.borderWidth,radius:layout.radius})
  const items=graphGroup(ids.items,'Items',ids.root,itemIds)
  const itemNodes:Record<string,ReturnType<typeof graphGroup>|ReturnType<typeof graphShape>|ReturnType<typeof graphText>>={}
  props.labels.forEach((label,index)=>{
    const itemId=itemIds[index]!, surfaceId=itemSurfaceIds[index]!, iconId=iconIds[index]!
    const itemBase=graphGroup(itemId,label,ids.items,[surfaceId,iconId])
    const window=sourceItemWindow(index,props.labels.length,style,context.reducedMotion)
    const opacity=exactEaseOutTrack(`${itemId}.opacity`,context,window.start,window.end,0,1)
    const y=context.reducedMotion?constant(0):exactEaseOutTrack(`${itemId}.y`,context,window.start,window.end,14*layout.designScale,0)
    const q=mEase('ease-out-cubic',mSequence(window.start,window.end,mProgress()))
    const scale=context.reducedMotion?constant(1):mNumber(mLerp(mConst(0.72),mConst(1),mBackOut(q,0.85)))
    itemNodes[itemId]=Object.freeze({...itemBase,opacity,transform:Object.freeze({...itemBase.transform,positionY:y,scaleX:scale,scaleY:scale})})
    itemNodes[surfaceId]=graphShape({id:surfaceId,name:`${label} Tile`,parentId:itemId,width:layout.tileSize,height:layout.tileSize,fillColor:'#FFFFFF',strokeColor:'transparent',strokeWidth:0,radius:layout.tileRadius})
    const glyph=props.glyphs[index]??label.slice(0,1)??'•'
    itemNodes[iconId]=graphText({id:iconId,name:`${label} Glyph`,parentId:itemId,text:glyph,color:'#FFFFFF',fontFamily:style.fontFamily,fontSize:layout.glyphFontSize,fontWeight:style.fontWeight,textAlign:'center'})
  })
  const exposures:MotionExposureV1[]=[
    {id:'rail.labels',label:'Item labels',group:'Content',level:'creator',target:{kind:'component',propertyId:'labels'},editor:{type:'textarea'},keyframeable:false},
    {id:'rail.glyphs',label:'Glyphs / emoji',group:'Content',level:'creator',target:{kind:'component',propertyId:'glyphs'},editor:{type:'textarea'},keyframeable:false},
    {id:'rail.direction',label:'Direction',group:'Layout',level:'creator',target:{kind:'component',propertyId:'direction'},editor:{type:'select',options:[{label:'Horizontal',value:'horizontal'},{label:'Vertical',value:'vertical'}]},keyframeable:false},
    {id:'rail.accent',label:'Accent',group:'Style',level:'creator',target:{kind:'component',propertyId:'accentColor'},editor:{type:'color'},keyframeable:false},
    {id:'rail.placement',label:'Placement',group:'Layout',level:'creator',target:{kind:'component',propertyId:'positionPreset'},editor:{type:'select',options:FROSTED_ICON_RAIL_PLACEMENTS.map(value=>({label:value,value}))},keyframeable:false},
    {id:'rail.surface-color',label:'Surface',group:'Style',level:'designer',target:{kind:'node',nodeId:ids.surface,property:'shape.fillColor'},editor:{type:'color'},keyframeable:false},
    {id:'rail.radius',label:'Roundness',group:'Surface',level:'designer',target:{kind:'node',nodeId:ids.surface,property:'shape.radius'},editor:{type:'slider'},keyframeable:true,constraints:{minimum:0,maximum:240,step:1}},
    {id:'rail.opacity',label:'Overall opacity',group:'Transform',level:'designer',target:{kind:'node',nodeId:ids.root,property:'opacity'},editor:{type:'slider'},keyframeable:true,constraints:{minimum:0,maximum:1,step:0.01}},
    {id:'rail.position-x',label:'Position X',group:'Transform',level:'designer',target:{kind:'node',nodeId:ids.root,property:'transform.positionX'},editor:{type:'slider'},keyframeable:true,constraints:{minimum:-2000,maximum:2000,step:1}},
    {id:'rail.position-y',label:'Position Y',group:'Transform',level:'designer',target:{kind:'node',nodeId:ids.root,property:'transform.positionY'},editor:{type:'slider'},keyframeable:true,constraints:{minimum:-2000,maximum:2000,step:1}},
    {id:'rail.scale-x',label:'Scale X',group:'Transform',level:'designer',target:{kind:'node',nodeId:ids.root,property:'transform.scaleX'},editor:{type:'slider'},keyframeable:true,constraints:{minimum:0.1,maximum:4,step:0.01}},
    {id:'rail.scale-y',label:'Scale Y',group:'Transform',level:'designer',target:{kind:'node',nodeId:ids.root,property:'transform.scaleY'},editor:{type:'slider'},keyframeable:true,constraints:{minimum:0.1,maximum:4,step:0.01}},
    {id:'rail.blur',label:'Frost blur',group:'Surface',level:'designer',target:{kind:'component',propertyId:'blur'},editor:{type:'slider'},keyframeable:false,constraints:{minimum:0,maximum:120,step:1}},
    {id:'rail.spacing',label:'Item spacing',group:'Layout',level:'designer',target:{kind:'component',propertyId:'spacing'},editor:{type:'slider'},keyframeable:false,constraints:{minimum:0,maximum:240,step:1}},
    {id:'rail.parts',label:'Semantic parts',group:'Parts',level:'advanced',target:{kind:'part',semanticPartId:'items',property:'opacity'},editor:{type:'readonly'},keyframeable:true},
  ]
  return createMotionScene({
    componentId:'sanverse.icon-rail',componentVersion:1,rootNodeId:ids.componentRoot,
    nodes:Object.freeze({[componentRoot.id]:componentRoot,[background.id]:background,[root.id]:root,[surface.id]:surface,[items.id]:items,...itemNodes}),
    semanticParts:Object.freeze([
      {id:'background',label:'Background',role:'surface',nodeIds:Object.freeze([ids.background])},
      {id:'rail',label:'Frosted Icon Rail',role:'content-group',nodeIds:Object.freeze([ids.root,ids.surface,ids.items])},
      {id:'items',label:'Items',role:'content-group',nodeIds:Object.freeze([...itemIds,...itemSurfaceIds])},
      {id:'icons',label:'Icons',role:'icon',nodeIds:Object.freeze([...iconIds])},
    ]),
    exposures:Object.freeze(exposures),layout:responsiveGraphLayout(),supportedAspectRatios:Object.freeze(['16:9','9:16','1:1','4:5']),
  })
}

const resolvedNode = (scene:ReturnType<typeof useMotionGraphPresentation>['scene'], id:string):ResolvedMotionNodeV1|null => scene?.nodes[id]??null
const rgba = (color:string,alpha:number):string => {
  const match=/^#([0-9a-f]{6})$/iu.exec(color)
  if(!match) return color
  const hex=match[1]!
  return `rgba(${Number.parseInt(hex.slice(0,2),16)},${Number.parseInt(hex.slice(2,4),16)},${Number.parseInt(hex.slice(4,6),16)},${Math.max(0,Math.min(1,alpha))})`
}

export function FrostedIconRail({props,style,context}:MotionComponentRenderPropsV1<FrostedIconRailProps,FrostedIconRailStyle>) {
  const fallback=evaluateFrostedIconRailState(props,style,context)
  const layout=layoutFrostedIconRail(props,style,context)
  const graph=useMotionGraphPresentation()
  const root=resolvedNode(graph.scene,'rail.root')
  const surfaceNode=resolvedNode(graph.scene,'rail.surface')
  const surface=surfaceNode?.type==='shape'?surfaceNode:null
  const backgroundNode=resolvedNode(graph.scene,'component.background')
  const background=backgroundNode?.type==='shape'?backgroundNode:null
  const shadowAlpha=Math.max(0,Math.min(0.4,style.shadowStrength*0.18))
  const rootStyle=mergeMotionGraphNodeStyle({position:'absolute',inset:0,display:'grid',placeItems:'center',pointerEvents:'none',fontFamily:style.fontFamily},root,false)
  if(!graph.scene) rootStyle.transform=`translate3d(${fallback.positionX}px,${fallback.positionY}px,0) scale(${fallback.scale}) rotate(${fallback.rotation}deg)`
  if(!graph.scene) rootStyle.opacity=fallback.opacity
  const surfaceFill=surface?.fillColor??style.surfaceColor
  const surfaceAlpha=style.surfaceOpacity*0.84
  const panelBase:CSSProperties={
    position:'relative',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:props.direction==='vertical'?'column':'row',
    width:surface?.width??layout.railWidth,height:surface?.height??layout.railHeight,boxSizing:'border-box',padding:layout.padding,gap:layout.spacing,
    borderRadius:surface?.radius??layout.radius,borderStyle:'solid',borderWidth:surface?.strokeWidth??layout.borderWidth,borderColor:surface?.strokeColor??style.borderColor,
    background:`color-mix(in srgb, ${surfaceFill} ${Math.max(0,Math.min(100,surfaceAlpha*100))}%, transparent)`,
    boxShadow:`0 ${8*layout.designScale}px ${30*layout.designScale}px ${rgba('#000000',shadowAlpha)}`,
    backdropFilter:`blur(${layout.blur}px)`,WebkitBackdropFilter:`blur(${layout.blur}px)`,color:style.textColor,
  }
  const panelStyle=mergeMotionGraphNodeDecorationStyle(panelBase,surface,false)
  return <div data-motion-root="frosted-icon-rail" data-motion-node-id="component.root" style={{position:'absolute',inset:0,overflow:'hidden'}}>
    <div data-motion-node-id="component.background" data-semantic-id="component.background" style={{position:'absolute',inset:0,background:background?.fillColor??style.backgroundColor,opacity:background?.opacity??style.backgroundOpacity,pointerEvents:'none'}} />
    <div data-motion-node-id="rail.root" data-semantic-id="rail.root" style={rootStyle}>
      <div data-motion-node-id="rail.surface" data-semantic-id="rail.surface" style={panelStyle}>
        <div data-motion-node-id="rail.items" style={{display:'contents'}}>
          {props.labels.map((label,index)=>{
            const itemId=`rail.item:${index}`, itemSurfaceId=`${itemId}.surface`, iconId=`rail.icon:${index}`
            const item=resolvedNode(graph.scene,itemId)
            const itemSurfaceNode=resolvedNode(graph.scene,itemSurfaceId)
            const itemSurface=itemSurfaceNode?.type==='shape'?itemSurfaceNode:null
            const iconNode=resolvedNode(graph.scene,iconId)
            const icon=iconNode?.type==='text'?iconNode:null
            const itemFallback=fallback.items[index]!
            const itemBase:CSSProperties={position:'relative',width:itemSurface?.width??layout.tileSize,height:itemSurface?.height??layout.tileSize,borderRadius:itemSurface?.radius??layout.tileRadius,display:'grid',placeItems:'center',background:rgba(itemSurface?.fillColor??'#FFFFFF',0.94),boxShadow:`0 ${4*layout.designScale}px ${12*layout.designScale}px ${rgba('#000000',shadowAlpha)}`,fontWeight:style.fontWeight,fontSize:24*layout.designScale*style.typeScale}
            const itemStyle=mergeMotionGraphNodeStyle(itemBase,item,false)
            if(!graph.scene){itemStyle.opacity=itemFallback.opacity;itemStyle.transform=`translate3d(0,${itemFallback.translateY}px,0) scale(${itemFallback.scale})`}
            const glyphBase:CSSProperties={width:layout.glyphSize,height:layout.glyphSize,borderRadius:layout.glyphRadius,background:style.accentColor,color:icon?.fillColor??'#FFFFFF',display:'grid',placeItems:'center',fontSize:icon?.fontSize??layout.glyphFontSize,fontWeight:icon?.fontWeight??style.fontWeight,fontFamily:icon?.fontFamily??style.fontFamily,lineHeight:1}
            return <div key={itemId} title={label} data-motion-node-id={itemId} data-semantic-id={itemId} style={itemStyle}>
              <span data-motion-node-id={itemSurfaceId} aria-hidden="true" style={{position:'absolute',inset:0,borderRadius:itemSurface?.radius??layout.tileRadius,pointerEvents:'none'}} />
              <span data-motion-node-id={iconId} data-semantic-id={iconId} style={glyphBase}>{icon?.text??props.glyphs[index]??label.slice(0,1)??'•'}</span>
            </div>
          })}
        </div>
      </div>
    </div>
  </div>
}

export const FROSTED_ICON_RAIL_DEFINITION=Object.freeze({
  id:'sanverse.icon-rail',version:1,name:'Frosted Icon Rail',purpose:'Introduce a small set of tools, brands, platforms, people or categories as a compact floating frosted group.',category:'ui',performanceClass:'light',
  supportedAspectRatios:Object.freeze(['16:9','9:16','1:1','4:5'] as const),
  minDurationTicks:Math.round(SANVERSE_TICKS_PER_SECOND*0.5),defaultDurationTicks:SANVERSE_TICKS_PER_SECOND,maxDurationTicks:SANVERSE_TICKS_PER_SECOND*12,
  events:Object.freeze([{name:'enter-start',normalizedTime:0},{name:'items-start',normalizedTime:0.02},{name:'settled',normalizedTime:0.58},{name:'exit-start',normalizedTime:0.84},{name:'end',normalizedTime:1}]),
  contentLimits:Object.freeze([{field:'labels',description:'Visible/semantic rail items.',minimum:1,maximum:12,unit:'items' as const},{field:'glyphs',description:'Glyphs corresponding to rail items.',minimum:0,maximum:12,unit:'items' as const}]),capabilities:FULL_NATIVE_GRAPH_CAPABILITIES,
} as const)

export const FrostedIconRailModule:MotionGraphBackedComponentModuleV1<FrostedIconRailProps,FrostedIconRailStyle>=Object.freeze({definition:FROSTED_ICON_RAIL_DEFINITION,defaultProps:DEFAULT_FROSTED_ICON_RAIL_PROPS,defaultStyle:DEFAULT_FROSTED_ICON_RAIL_STYLE,validateProps:validateFrostedIconRailProps,validateStyle:validateFrostedIconRailStyle,Component:FrostedIconRail,createScene:createFrostedIconRailScene})
