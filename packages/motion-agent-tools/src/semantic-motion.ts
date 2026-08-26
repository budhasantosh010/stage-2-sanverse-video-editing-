import { creativeOperationOk, creativeOperationRefusal, type CreativeOperationResultV1 } from '@sanverse/motion-contract'
import { type MotionIntentV1, type MotionPlanV1, validateMotionPlanV1 } from '@sanverse/creative-direction'
import { applyMotionOperations, keyframed, readMotionAnimatableTarget, type MotionGraphOperationV1, type MotionKeyframeInterpolationV1, type MotionNodePropertyNameV1, type MotionSceneV1 } from '@sanverse/motion-graph'

export interface CompiledSemanticMotionV1 { readonly scene:MotionSceneV1; readonly operations:readonly MotionGraphOperationV1[]; readonly intentIds:readonly string[] }

const num=(intent:MotionIntentV1,key:string,fallback:number):number=>{const value=intent.parameters?.[key];return typeof value==='number'&&Number.isFinite(value)?value:fallback}
const text=(intent:MotionIntentV1,key:string):string|null=>{const value=intent.parameters?.[key];return typeof value==='string'&&value.trim()?value:null}
const interpolation=(kind:'soft'|'snappy'|'hard'|'linear'):MotionKeyframeInterpolationV1=>kind==='linear'?'linear':'bezier'
const bezierFor=(kind:'soft'|'snappy'|'hard')=>kind==='soft'?{inX:.25,inY:.1,outX:.25,outY:1}:kind==='snappy'?{inX:.12,inY:0,outX:.2,outY:1}: {inX:0,inY:0,outX:1,outY:1}
const propertyTarget=(nodeId:string,property:MotionNodePropertyNameV1)=>({nodeId,property} as const)
const twoKey=(intent:MotionIntentV1,nodeId:string,property:MotionNodePropertyNameV1,from:number,to:number,kind:'soft'|'snappy'|'hard'|'linear'='soft'):MotionGraphOperationV1=>Object.freeze({operationId:`${intent.id}:${nodeId}:${property}`,type:'set-property',target:propertyTarget(nodeId,property),value:keyframed([{id:`${intent.id}:${nodeId}:k0`,tick:intent.startTick,value:from,interpolation:interpolation(kind),...(kind!=='linear'?{bezier:bezierFor(kind)}:{})},{id:`${intent.id}:${nodeId}:k1`,tick:intent.endTick,value:to,interpolation:interpolation(kind),...(kind!=='linear'?{bezier:bezierFor(kind)}:{})}])})
const threeKey=(intent:MotionIntentV1,nodeId:string,property:MotionNodePropertyNameV1,a:number,b:number,c:number):MotionGraphOperationV1=>{const mid=Math.round((intent.startTick+intent.endTick)/2);return Object.freeze({operationId:`${intent.id}:${nodeId}:${property}:3`,type:'set-property',target:propertyTarget(nodeId,property),value:keyframed([{id:`${intent.id}:${nodeId}:k0`,tick:intent.startTick,value:a,interpolation:'bezier',bezier:bezierFor('snappy')},{id:`${intent.id}:${nodeId}:k1`,tick:mid,value:b,interpolation:'bezier',bezier:{inX:.2,inY:0,outX:.2,outY:1.15}},{id:`${intent.id}:${nodeId}:k2`,tick:intent.endTick,value:c,interpolation:'bezier',bezier:bezierFor('soft')}])})}

const revealSequence=(intent:MotionIntentV1,mode:'sequence'|'stagger'|'cascade'|'parallel'):readonly MotionGraphOperationV1[]=>{const count=intent.nodeIds.length;const span=Math.max(1,intent.endTick-intent.startTick);return Object.freeze(intent.nodeIds.map((nodeId,index)=>{const fraction=mode==='parallel'?0:mode==='sequence'?index/Math.max(1,count):index/Math.max(1,count*1.5);const start=Math.min(intent.endTick-1,Math.round(intent.startTick+span*fraction));return twoKey({...intent,startTick:start} as MotionIntentV1,nodeId,'opacity',0,1,mode==='cascade'?'soft':'snappy')}))}

const transformExistingTrack=(scene:MotionSceneV1,intent:MotionIntentV1,nodeId:string):CreativeOperationResultV1<MotionGraphOperationV1>=>{
  const property=text(intent,'property') as MotionNodePropertyNameV1|null
  if(!property)return creativeOperationRefusal('MOTION_INTENT_PARAMETERS_REQUIRED',`${intent.type} requires parameters.property.`)
  let record:ReturnType<typeof readMotionAnimatableTarget>
  try{record=readMotionAnimatableTarget(scene,{kind:'node',nodeId,property})}catch(error){return creativeOperationRefusal('MOTION_INTENT_TARGET_INVALID',error instanceof Error?error.message:'Motion target is invalid.')}
  if(record.animatable.kind!=='keyframes')return creativeOperationRefusal('MOTION_INTENT_REQUIRES_KEYFRAMES',`${intent.type} requires an existing canonical keyframed track.`)
  const keys=record.animatable.keyframes
  const first=keys[0]?.tick??0,last=keys.at(-1)?.tick??first,duration=Math.max(1,last-first)
  const delta=Math.round(num(intent,'deltaTicks',intent.endTick-intent.startTick))
  const factor=Math.max(.01,num(intent,'factor',1))
  const style=intent.type==='motion.make-snappier'||intent.type==='motion.hard-land'?'snappy':intent.type==='motion.soften'||intent.type==='motion.soft-land'||intent.type==='motion.settle'?'soft':'hard'
  const mapped=keys.map((key,index)=>{
    let tick=key.tick,interp=key.interpolation,bezier=key.bezier
    if(intent.type==='motion.shift')tick=key.tick+delta
    else if(intent.type==='motion.set-duration'){const targetDuration=Math.max(1,delta);tick=first+Math.round(((key.tick-first)/duration)*targetDuration)}
    else if(intent.type==='motion.stretch')tick=first+Math.round((key.tick-first)*factor)
    else if(intent.type==='motion.compress')tick=first+Math.round((key.tick-first)/factor)
    else if(intent.type==='motion.insert-hold'&&index>0)tick=key.tick+Math.max(1,delta)
    else if(['motion.apply-ease','motion.match-ease','motion.soften','motion.make-snappier','motion.soft-land','motion.hard-land','motion.settle'].includes(intent.type)){interp='bezier';bezier=bezierFor(style)}
    else if(intent.type==='motion.remove-overshoot'){interp='bezier';bezier=bezierFor('soft')}
    return Object.freeze({...key,tick,interpolation:interp,...(bezier?{bezier}:{})})
  }).sort((a,b)=>a.tick-b.tick)
  if(mapped.some((key,index)=>key.tick<0||(index>0&&key.tick<=mapped[index-1]!.tick)))return creativeOperationRefusal('MOTION_INTENT_TIMING_INVALID',`${intent.type} would produce invalid keyframe timing.`)
  return creativeOperationOk(Object.freeze({operationId:`${intent.id}:${nodeId}:${property}:retime`,type:'set-property' as const,target:propertyTarget(nodeId,property),value:keyframed(mapped)}),1)
}

export const compileMotionIntentV1=(scene:MotionSceneV1,intent:MotionIntentV1):CreativeOperationResultV1<readonly MotionGraphOperationV1[]>=>{
  const missing=intent.nodeIds.filter((id)=>!scene.nodes[id]);if(missing.length)return creativeOperationRefusal('MOTION_INTENT_TARGET_INVALID',`Motion intent references missing nodes: ${missing.join(', ')}.`)
  const operations:MotionGraphOperationV1[]=[]
  if(intent.type==='motion.sequence'||intent.type==='motion.stagger'||intent.type==='motion.cascade'||intent.type==='motion.parallel')return creativeOperationOk(revealSequence(intent,intent.type.slice('motion.'.length) as 'sequence'|'stagger'|'cascade'|'parallel'),1)
  for(const nodeId of intent.nodeIds){
    if(intent.type==='motion.enter'||intent.type==='motion.fade')operations.push(twoKey(intent,nodeId,'opacity',num(intent,'from',0),num(intent,'to',1),'soft'))
    else if(intent.type==='motion.exit')operations.push(twoKey(intent,nodeId,'opacity',num(intent,'from',1),num(intent,'to',0),'soft'))
    else if(intent.type==='motion.move'){operations.push(twoKey(intent,nodeId,'transform.positionX',num(intent,'fromX',-80),num(intent,'toX',0),'soft'));operations.push(twoKey(intent,nodeId,'transform.positionY',num(intent,'fromY',0),num(intent,'toY',0),'soft'))}
    else if(intent.type==='motion.scale'){operations.push(twoKey(intent,nodeId,'transform.scaleX',num(intent,'from',.8),num(intent,'to',1),'soft'));operations.push(twoKey(intent,nodeId,'transform.scaleY',num(intent,'from',.8),num(intent,'to',1),'soft'))}
    else if(intent.type==='motion.rotate')operations.push(twoKey(intent,nodeId,'transform.rotationDeg',num(intent,'from',-8),num(intent,'to',0),'soft'))
    else if(intent.type==='motion.draw')operations.push(twoKey(intent,nodeId,'path.trimProgress',num(intent,'from',0),num(intent,'to',1),'linear'))
    else if(intent.type==='motion.wipe'||intent.type==='motion.mask-reveal'){const maskId=text(intent,'maskId');if(!maskId)return creativeOperationRefusal('MOTION_INTENT_PARAMETERS_REQUIRED',`${intent.type} requires parameters.maskId.`);operations.push(Object.freeze({operationId:`${intent.id}:${nodeId}:mask`,type:'set-mask-property',nodeId,maskId,property:'opacity',value:keyframed([{id:`${intent.id}:${nodeId}:m0`,tick:intent.startTick,value:0,interpolation:'linear'},{id:`${intent.id}:${nodeId}:m1`,tick:intent.endTick,value:1,interpolation:'linear'}])}))}
    else if(intent.type==='motion.controlled-overshoot')operations.push(threeKey(intent,nodeId,'transform.scaleX',num(intent,'from',.9),num(intent,'overshoot',1.06),num(intent,'to',1)))
    else {const transformed=transformExistingTrack(scene,intent,nodeId);if(!transformed.ok)return transformed as CreativeOperationResultV1<readonly MotionGraphOperationV1[]>;operations.push(transformed.value)}
  }
  return creativeOperationOk(Object.freeze(operations),1)
}

export const applyMotionPlanV1=(scene:MotionSceneV1,plan:MotionPlanV1):CreativeOperationResultV1<CompiledSemanticMotionV1>=>{
  const valid=validateMotionPlanV1(plan);if(!valid.ok)return creativeOperationRefusal(valid.refusal.code,valid.refusal.message,valid.refusal.details)
  let current=scene;const all:MotionGraphOperationV1[]=[];const intentIds:string[]=[]
  for(const beat of plan.beats)for(const intent of beat.operationIntents){const compiled=compileMotionIntentV1(current,intent);if(!compiled.ok)return creativeOperationRefusal(compiled.refusal.code,compiled.refusal.message,compiled.refusal.details);const applied=applyMotionOperations(current,compiled.value,{durationTicks:Math.max(plan.beats.at(-1)?.endTick??intent.endTick,intent.endTick)});if(!applied.ok)return creativeOperationRefusal('MOTION_PLAN_COMPILE_FAILED',applied.error.message,applied.error);current=applied.scene;all.push(...compiled.value);intentIds.push(intent.id)}
  return creativeOperationOk(Object.freeze({scene:current,operations:Object.freeze(all),intentIds:Object.freeze(intentIds)}),plan.revision)
}
