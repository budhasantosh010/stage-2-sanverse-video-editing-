import { creativeRefusal, creativeValidationOk, type CreativeValidationResultV1 } from '@sanverse/motion-contract'

export const MOTION_BEAT_PURPOSES_V1 = Object.freeze(['establish','build','reveal','emphasis','payoff','hold','exit'] as const)
export type MotionBeatPurposeV1 = (typeof MOTION_BEAT_PURPOSES_V1)[number]

export const SEMANTIC_MOTION_OPERATIONS_V1 = Object.freeze([
  'motion.enter','motion.exit','motion.move','motion.scale','motion.rotate','motion.fade','motion.draw','motion.wipe','motion.mask-reveal','motion.stagger','motion.cascade','motion.sequence','motion.parallel','motion.set-duration','motion.shift','motion.stretch','motion.compress','motion.insert-hold','motion.apply-ease','motion.match-ease','motion.soften','motion.make-snappier','motion.controlled-overshoot','motion.remove-overshoot','motion.soft-land','motion.hard-land','motion.settle',
] as const)
export type SemanticMotionOperationV1 = (typeof SEMANTIC_MOTION_OPERATIONS_V1)[number]

export interface MotionIntentV1 {
  readonly id:string
  readonly type:SemanticMotionOperationV1
  readonly nodeIds:readonly string[]
  readonly startTick:number
  readonly endTick:number
  readonly parameters?:Readonly<Record<string, string|number|boolean|readonly string[]|readonly number[]>>
}
export interface MotionBeatV1 { readonly id:string; readonly purpose:MotionBeatPurposeV1; readonly startTick:number; readonly endTick:number; readonly nodeIds:readonly string[]; readonly operationIntents:readonly MotionIntentV1[] }
export interface MotionPlanV1 { readonly id:string; readonly storyboardId:string; readonly storyboardApprovedRevision:number; readonly animaticId:string; readonly animaticApprovedRevision:number; readonly beats:readonly MotionBeatV1[]; readonly styleLockId?:string; readonly revision:number }

export interface StoryboardDiffPlanningInputV1 { readonly fromStateId:string; readonly toStateId:string; readonly addedNodeIds:readonly string[]; readonly removedNodeIds:readonly string[]; readonly changedNodes:readonly Readonly<{nodeId:string;changedProperties:readonly string[]}>[] }
export interface MotionForgeStateTimingInputV1 { readonly stateId:string; readonly startTick:number; readonly endTick:number; readonly nodeIds:readonly string[] }
export interface MotionForgePlanningInputV1 {
  readonly motionPlanId:string
  readonly storyboardId:string
  readonly storyboardApprovedRevision:number
  readonly storyboardStatus:'owner-approved'
  readonly animaticId:string
  readonly animaticApprovedRevision:number
  readonly animaticStatus:'owner-approved'
  readonly stateTimings:readonly MotionForgeStateTimingInputV1[]
  readonly storyboardDiffs:readonly StoryboardDiffPlanningInputV1[]
  readonly styleLockId?:string
}

const id=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=240
const tickRange=(start:unknown,end:unknown):boolean=>Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&Number(start)>=0&&Number(end)>Number(start)
export const validateMotionIntentV1=(input:unknown):CreativeValidationResultV1<MotionIntentV1>=>{
  if(!input||typeof input!=='object'||Array.isArray(input))return creativeRefusal('INVALID_MOTION_INTENT','Motion intent must be an object.')
  const value=input as Record<string,unknown>
  if(!id(value.id)||!SEMANTIC_MOTION_OPERATIONS_V1.includes(value.type as SemanticMotionOperationV1)||!Array.isArray(value.nodeIds)||value.nodeIds.length===0||!value.nodeIds.every(id)||!tickRange(value.startTick,value.endTick))return creativeRefusal('INVALID_MOTION_INTENT','Motion intent identity/type/nodes/ticks are invalid.')
  if(value.parameters!==undefined&&(typeof value.parameters!=='object'||value.parameters===null||Array.isArray(value.parameters)))return creativeRefusal('INVALID_MOTION_INTENT','Motion intent parameters must be a record when present.')
  return creativeValidationOk(input as MotionIntentV1)
}
export const validateMotionPlanV1=(input:unknown):CreativeValidationResultV1<MotionPlanV1>=>{
  if(!input||typeof input!=='object'||Array.isArray(input))return creativeRefusal('INVALID_MOTION_PLAN','Motion plan must be an object.')
  const value=input as Record<string,unknown>
  if(!id(value.id)||!id(value.storyboardId)||!id(value.animaticId)||!Number.isSafeInteger(value.storyboardApprovedRevision)||Number(value.storyboardApprovedRevision)<1||!Number.isSafeInteger(value.animaticApprovedRevision)||Number(value.animaticApprovedRevision)<1||!Number.isSafeInteger(value.revision)||Number(value.revision)<1||!Array.isArray(value.beats)||value.beats.length===0)return creativeRefusal('INVALID_MOTION_PLAN','Motion plan identity/revisions/beats are invalid.')
  let prior=-1; const beatIds=new Set<string>()
  for(const raw of value.beats){if(!raw||typeof raw!=='object'||Array.isArray(raw))return creativeRefusal('INVALID_MOTION_BEAT','Motion beat must be an object.');const beat=raw as Record<string,unknown>;if(!id(beat.id)||beatIds.has(beat.id)||!MOTION_BEAT_PURPOSES_V1.includes(beat.purpose as MotionBeatPurposeV1)||!tickRange(beat.startTick,beat.endTick)||Number(beat.startTick)<prior||!Array.isArray(beat.nodeIds)||!beat.nodeIds.every(id)||!Array.isArray(beat.operationIntents))return creativeRefusal('INVALID_MOTION_BEAT','Motion beat identity/order/range/nodes are invalid.');beatIds.add(beat.id);prior=Number(beat.startTick);for(const intent of beat.operationIntents){const valid=validateMotionIntentV1(intent);if(!valid.ok)return valid as CreativeValidationResultV1<MotionPlanV1>}}
  return creativeValidationOk(input as MotionPlanV1)
}

const purposeFor=(index:number,total:number):MotionBeatPurposeV1=>index===0?'establish':index===total-1?'payoff':'build'
const intentTypeFor=(input:MotionForgePlanningInputV1,index:number):SemanticMotionOperationV1=>{
  const timing=input.stateTimings[index]!;const previous=input.storyboardDiffs[index-1]
  if(index===0)return'motion.enter'
  if(previous?.addedNodeIds.length)return'motion.enter'
  if(previous?.removedNodeIds.length)return'motion.exit'
  if(previous?.changedNodes.some((item)=>item.changedProperties.some((property)=>property.includes('transform'))))return'motion.move'
  return'motion.fade'
}
export const planMotionForgeV1=(input:MotionForgePlanningInputV1):CreativeValidationResultV1<MotionPlanV1>=>{
  if(input.storyboardStatus!=='owner-approved'||input.animaticStatus!=='owner-approved')return creativeRefusal('MOTION_FORGE_REQUIRES_APPROVAL','Motion Forge requires exact approved Storyboard and Animatic revisions.')
  if(!id(input.motionPlanId)||!id(input.storyboardId)||!id(input.animaticId)||input.stateTimings.length===0)return creativeRefusal('INVALID_MOTION_FORGE_INPUT','Motion Forge input is incomplete.')
  const beats=input.stateTimings.map((timing,index):MotionBeatV1=>{
    const type=intentTypeFor(input,index);const intent:MotionIntentV1=Object.freeze({id:`${input.motionPlanId}:intent:${index}`,type,nodeIds:Object.freeze([...timing.nodeIds]),startTick:timing.startTick,endTick:timing.endTick,...(type==='motion.move'?{parameters:Object.freeze({fromX:-80,toX:0})}:{})})
    return Object.freeze({id:`${input.motionPlanId}:beat:${index}`,purpose:purposeFor(index,input.stateTimings.length),startTick:timing.startTick,endTick:timing.endTick,nodeIds:Object.freeze([...timing.nodeIds]),operationIntents:Object.freeze([intent])})
  })
  const plan:MotionPlanV1=Object.freeze({id:input.motionPlanId,storyboardId:input.storyboardId,storyboardApprovedRevision:input.storyboardApprovedRevision,animaticId:input.animaticId,animaticApprovedRevision:input.animaticApprovedRevision,beats:Object.freeze(beats),...(input.styleLockId?{styleLockId:input.styleLockId}:{}),revision:1})
  return validateMotionPlanV1(plan)
}
