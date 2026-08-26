import type { MotionSceneV1 } from './scene.ts'

export const MOTION_MATTE_MODES_V1 = Object.freeze(['alpha','alpha-inverted'] as const)
export type MotionMatteModeV1 = (typeof MOTION_MATTE_MODES_V1)[number]
export const MOTION_MATTE_ORDERS_V1 = Object.freeze(['source-before-target','source-after-target'] as const)
export type MotionMatteOrderV1 = (typeof MOTION_MATTE_ORDERS_V1)[number]

export interface MotionMatteRelationshipV1 {
  readonly id:string
  readonly sourceNodeId:string
  readonly targetNodeId:string
  readonly mode:MotionMatteModeV1
  readonly order:MotionMatteOrderV1
}
export interface MotionCompositingV1 { readonly schemaVersion:'sanverse.motion-compositing/v1'; readonly mattes:readonly MotionMatteRelationshipV1[] }

const bounded=(value:string):boolean=>value.trim().length>0&&value.length<=240
export const validateMotionMatteRelationshipV1=(scene:MotionSceneV1,relationship:MotionMatteRelationshipV1):string|null=>{
  if(!bounded(relationship.id)||!bounded(relationship.sourceNodeId)||!bounded(relationship.targetNodeId))return'Matte identity/source/target must be bounded non-empty IDs.'
  if(relationship.sourceNodeId===relationship.targetNodeId)return'Matte source and target must be different nodes.'
  if(!scene.nodes[relationship.sourceNodeId])return`Matte source node does not exist: ${relationship.sourceNodeId}`
  if(!scene.nodes[relationship.targetNodeId])return`Matte target node does not exist: ${relationship.targetNodeId}`
  if(!MOTION_MATTE_MODES_V1.includes(relationship.mode))return`Unsupported matte mode: ${String(relationship.mode)}`
  if(!MOTION_MATTE_ORDERS_V1.includes(relationship.order))return`Unsupported matte order: ${String(relationship.order)}`
  const existing=(scene.compositing?.mattes??[]).find((item)=>item.id!==relationship.id&&item.targetNodeId===relationship.targetNodeId)
  if(existing)return`Target node ${relationship.targetNodeId} already has matte ${existing.id}.`
  return null
}

export const setMotionMatteRelationshipV1=(scene:MotionSceneV1,relationship:MotionMatteRelationshipV1):MotionSceneV1=>{
  const issue=validateMotionMatteRelationshipV1(scene,relationship);if(issue)throw new RangeError(issue)
  const mattes=[...(scene.compositing?.mattes??[])];const index=mattes.findIndex((item)=>item.id===relationship.id);if(index>=0)mattes[index]=Object.freeze({...relationship});else mattes.push(Object.freeze({...relationship}))
  return Object.freeze({...scene,compositing:Object.freeze({schemaVersion:'sanverse.motion-compositing/v1' as const,mattes:Object.freeze(mattes)})})
}
export const removeMotionMatteRelationshipV1=(scene:MotionSceneV1,matteId:string):MotionSceneV1=>{
  const mattes=scene.compositing?.mattes??[];if(!mattes.some((item)=>item.id===matteId))throw new RangeError(`Unknown matte: ${matteId}`)
  return Object.freeze({...scene,compositing:Object.freeze({schemaVersion:'sanverse.motion-compositing/v1' as const,mattes:Object.freeze(mattes.filter((item)=>item.id!==matteId))})})
}
