import type { MotionAspectRatio, MotionRenderContextV1 } from '@sanverse/motion-contract'
import type { MotionGraphBackedComponentModuleV1 } from '@sanverse/motion-graph'
import { evaluateScene, projectMotionCurves, projectMotionDopeSheet, projectMotionLayers, validateCompositorReadiness, validateMotionScene } from '@sanverse/motion-graph'

export interface ComponentSemanticMappingV1 { readonly sourcePart: string; readonly nodeIds: readonly string[] }
export interface ComponentAiEditIntentV1 { readonly command: string; readonly exposureId: string; readonly operation: string }
export interface ComponentProductizationDescriptorV1 {
  readonly componentId: `sanverse.${string}`
  readonly componentVersion: number
  readonly supportedRatios: readonly MotionAspectRatio[]
  readonly semanticMapping: readonly ComponentSemanticMappingV1[]
  readonly aiEditIntents: readonly ComponentAiEditIntentV1[]
}
export interface ComponentProductizationReportV1 {
  readonly componentId: `sanverse.${string}`
  readonly componentVersion: number
  readonly status: 'ready' | 'blocked'
  readonly determinism: 'passed' | 'failed'
  readonly directSeek: 'passed' | 'failed'
  readonly semanticMapping: 'passed' | 'failed'
  readonly c3: 'passed' | 'failed'
  readonly c4: 'passed' | 'failed'
  readonly c5: 'passed' | 'failed'
  readonly c6: 'not-yet-available'
  readonly aiEditability: 'passed' | 'failed'
  readonly ratios: Readonly<Record<MotionAspectRatio, 'passed' | 'failed' | 'not-requested'>>
  readonly semanticNodeCount: number
  readonly exposureCount: number
  readonly editableCurveTrackCount: number
  readonly blockingReasons: readonly string[]
}

const sameResolvedScene = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

export const validateProductizedMotionComponent = <Props,Style>(
  module: MotionGraphBackedComponentModuleV1<Props,Style>,
  descriptor: ComponentProductizationDescriptorV1,
  contexts: Readonly<Record<MotionAspectRatio, MotionRenderContextV1>>,
): ComponentProductizationReportV1 => {
  const blockers:string[]=[]
  if(module.definition.id!==descriptor.componentId) blockers.push('COMPONENT_ID_MISMATCH')
  if(module.definition.version!==descriptor.componentVersion) blockers.push('COMPONENT_VERSION_MISMATCH')
  if(!module.validateProps(module.defaultProps).ok) blockers.push('DEFAULT_PROPS_INVALID')
  if(!module.validateStyle(module.defaultStyle).ok) blockers.push('DEFAULT_STYLE_INVALID')
  const ratioStatus:Record<MotionAspectRatio,'passed'|'failed'|'not-requested'>={'16:9':'not-requested','9:16':'not-requested','1:1':'not-requested','4:5':'not-requested'}
  let determinism=true,directSeek=true,semantic=true,c3=true,c4=true,c5=true,ai=true
  let semanticNodeCount=0,exposureCount=0,editableCurveTrackCount=0
  let canonicalScene:ReturnType<typeof module.createScene>|null=null
  for(const ratio of descriptor.supportedRatios){
    const ctx=contexts[ratio]
    try{
      const scene=module.createScene(module.defaultProps,module.defaultStyle,ctx)
      canonicalScene??=scene
      const validation=validateMotionScene(scene)
      if(!validation.ok) throw new Error(validation.issues[0]?.message??'scene invalid')
      if(!validateCompositorReadiness(scene).ready) throw new Error('compositor readiness failed')
      const first=evaluateScene(scene,{...ctx,localTicks:Math.round(ctx.durationTicks*.37)})
      evaluateScene(scene,{...ctx,localTicks:Math.round(ctx.durationTicks*.91)})
      evaluateScene(scene,{...ctx,localTicks:Math.round(ctx.durationTicks*.04)})
      const second=evaluateScene(scene,{...ctx,localTicks:Math.round(ctx.durationTicks*.37)})
      if(!sameResolvedScene(first,second)){determinism=false;directSeek=false;throw new Error('direct seek parity failed')}
      const layers=projectMotionLayers({scene,resolvedScene:first})
      if(layers.preorderNodeIds.length!==Object.keys(scene.nodes).length){c3=false;throw new Error('C3 projection incomplete')}
      const dope=projectMotionDopeSheet(scene)
      if(dope.totalTracks===0){c4=false;throw new Error('C4 has no animation tracks')}
      const curves=projectMotionCurves(scene)
      const editable=curves.tracks.filter(track=>track.editable).length
      editableCurveTrackCount=Math.max(editableCurveTrackCount,editable)
      if(editable===0){c5=false;throw new Error('C5 has no editable numeric curve tracks')}
      ratioStatus[ratio]='passed'
      semanticNodeCount=Math.max(semanticNodeCount,Object.keys(scene.nodes).length)
      exposureCount=Math.max(exposureCount,scene.exposures.length)
    }catch(error){
      ratioStatus[ratio]='failed'
      blockers.push(`RATIO_${ratio}_${error instanceof Error?error.message:'FAILED'}`)
    }
  }
  if(canonicalScene){
    const nodeIds=new Set(Object.keys(canonicalScene.nodes))
    for(const mapping of descriptor.semanticMapping) for(const nodeId of mapping.nodeIds) if(!nodeIds.has(nodeId)){semantic=false;blockers.push(`SEMANTIC_NODE_MISSING:${mapping.sourcePart}->${nodeId}`)}
    const exposureIds=new Set(canonicalScene.exposures.map(exposure=>exposure.id))
    for(const intent of descriptor.aiEditIntents) if(!exposureIds.has(intent.exposureId)){ai=false;blockers.push(`AI_EXPOSURE_MISSING:${intent.exposureId}`)}
  }else{semantic=false;c3=false;c4=false;c5=false;ai=false;blockers.push('NO_CANONICAL_SCENE')}
  if(descriptor.supportedRatios.some(ratio=>ratioStatus[ratio]!=='passed')) blockers.push('RESPONSIVE_MINIMUM_FAILED')
  return Object.freeze({componentId:descriptor.componentId,componentVersion:descriptor.componentVersion,status:blockers.length?'blocked':'ready',determinism:determinism?'passed':'failed',directSeek:directSeek?'passed':'failed',semanticMapping:semantic?'passed':'failed',c3:c3?'passed':'failed',c4:c4?'passed':'failed',c5:c5?'passed':'failed',c6:'not-yet-available',aiEditability:ai?'passed':'failed',ratios:Object.freeze(ratioStatus),semanticNodeCount,exposureCount,editableCurveTrackCount,blockingReasons:Object.freeze(blockers)})
}
