import { creativeOperationOk,creativeOperationRefusal,type CreativeOperationResultV1,type MotionAspectRatio,type MotionExposureLevel,type MotionPresentationModeV1,type MotionPerformanceClass } from '@sanverse/motion-contract'
import { applyMotionOperations,constant,keyframed,validateMotionScene,type Animatable,type MotionGraphOperationV1,type MotionNodePropertyNameV1,type MotionNodeV1,type MotionSceneV1 } from '@sanverse/motion-graph'
import type { MotionPlanV1 } from '@sanverse/creative-direction'
import type { CapabilityOriginV1,CapabilityReuseStatusV1,PromotedCapabilityLineageV1,PromotionCandidateV1,PromotionSourceV1,PromotionTargetKindV1 } from './contracts.ts'
import type { ParameterCandidateV1,ParameterizationPlanV1,PromotionBindingV1,PromotionParameterValueTypeV1 } from './parameterization.ts'

export interface PromotionExtractionOpportunityV1 { readonly kind:PromotionTargetKindV1; readonly description:string }
export interface PromotionClassificationV1 { readonly recommendedKind:PromotionTargetKindV1; readonly alternativeKinds:readonly PromotionTargetKindV1[]; readonly reasons:readonly string[]; readonly extractionOpportunities:readonly PromotionExtractionOpportunityV1[] }
export interface ReusableParameterDefinitionV1 { readonly id:string; readonly publicPath:string; readonly category:ParameterCandidateV1['category']; readonly valueType:PromotionParameterValueTypeV1; readonly defaultValue:unknown; readonly bindings:readonly PromotionBindingV1[]; readonly constraints?:Readonly<Record<string,unknown>>; readonly exposureLevel:MotionExposureLevel }
export interface ReusableExposureMapV1 { readonly creator:readonly string[]; readonly designer:readonly string[]; readonly advanced:readonly string[]; readonly fullGraph:true }
export interface ReusableStyleRoleMapV1 { readonly accent:readonly PromotionBindingV1[]; readonly primaryText:readonly PromotionBindingV1[]; readonly secondaryText:readonly PromotionBindingV1[]; readonly surface:readonly PromotionBindingV1[]; readonly background:readonly PromotionBindingV1[] }
export interface ReusableMotionTemplateV1 {
  readonly schemaVersion:'sanverse.reusable-motion-template/v1'
  readonly id:string
  readonly version:number
  readonly targetKind:PromotionTargetKindV1
  readonly canonicalGraph:MotionSceneV1
  readonly parameters:readonly ReusableParameterDefinitionV1[]
  readonly frozenDesignProperties:readonly PromotionBindingV1[]
  readonly exposure:ReusableExposureMapV1
  readonly styleRoles:ReusableStyleRoleMapV1
  readonly defaultProps:Readonly<Record<string,unknown>>
  readonly supportedRatios:readonly MotionAspectRatio[]
  readonly supportedPresentationModes:readonly MotionPresentationModeV1[]
  readonly requiredCapabilities:readonly string[]
}
export interface PromotionCanonicalFixtureV1 { readonly schemaVersion:'sanverse.promotion-canonical-fixture/v1'; readonly id:string; readonly values:Readonly<Record<string,unknown>> }
export interface ProductizedPromotedCapabilityV1 {
  readonly schemaVersion:'sanverse.promoted-capability/v1'
  readonly id:string
  readonly version:number
  readonly title:string
  readonly description:string
  readonly targetKind:PromotionTargetKindV1
  readonly origin:CapabilityOriginV1
  readonly reuseStatus:CapabilityReuseStatusV1
  readonly communicationGoals:readonly string[]
  readonly supportedPresentationModes:readonly MotionPresentationModeV1[]
  readonly supportedRatios:readonly MotionAspectRatio[]
  readonly styleTraits:readonly string[]
  readonly motionTraits:readonly string[]
  readonly requiredCapabilities:readonly string[]
  readonly editability:'full'
  readonly performanceClass:MotionPerformanceClass
  readonly template:ReusableMotionTemplateV1
  readonly canonicalFixture:PromotionCanonicalFixtureV1
  readonly lineage:PromotedCapabilityLineageV1
  readonly dependencies:PromotionSourceV1['dependencies']
  readonly parameterizationPlanId:string
  readonly sourceSceneRevision:number
}
export interface ProductizePromotionInputV1 { readonly id:string; readonly title:string; readonly description:string; readonly candidate:PromotionCandidateV1; readonly source:PromotionSourceV1; readonly parameterization:ParameterizationPlanV1; readonly classification:PromotionClassificationV1; readonly targetKind:PromotionTargetKindV1; readonly registrationVersion:number }
export interface ReusableMotionInstanceV1 { readonly templateId:string; readonly templateVersion:number; readonly instanceId:string; readonly semanticNodeIds:readonly string[]; readonly scene:MotionSceneV1 }
export interface StyleLockV1 { readonly accent?:string; readonly background?:string; readonly surface?:string; readonly primaryText?:string; readonly secondaryText?:string }
export interface StyleAdaptationResultV1 { readonly scene:MotionSceneV1; readonly status:'applied'|'partial'; readonly warnings:readonly string[] }

const unique=<T>(values:readonly T[]):readonly T[]=>Object.freeze([...new Set(values)])
const binding=(nodeId:string,propertyPath:string,transform:PromotionBindingV1['transform']='identity'):PromotionBindingV1=>Object.freeze({nodeId,propertyPath,transform})
const isId=(value:string):boolean=>value.trim().length>0&&value.length<=240
const constantValue=(value:Animatable<unknown>):unknown=>value.kind==='constant'?value.value:undefined
const pathProperty=(path:string):path is MotionNodePropertyNameV1=>['visible','opacity','transform.positionX','transform.positionY','transform.scaleX','transform.scaleY','transform.rotationDeg','transform.anchorX','transform.anchorY','text.text','text.fillColor','text.fontSize','text.fontWeight','shape.width','shape.height','shape.fillColor','shape.strokeColor','shape.strokeWidth','shape.radius','path.fillColor','path.strokeColor','path.strokeWidth','path.trimProgress','image.width','image.height','image.opacity'].includes(path)
const valueMatches=(type:PromotionParameterValueTypeV1,value:unknown):boolean=>type==='number'||type==='duration'?typeof value==='number'&&Number.isFinite(value):type==='boolean'?typeof value==='boolean':type==='object'?Boolean(value)&&typeof value==='object':typeof value==='string'
const numericScale=(value:number,property:string):number=>property==='transform.scaleX'||property==='transform.scaleY'?1+(value-1):value
const scaleAnimatable=(source:Animatable<unknown>,factor:number,property:string):Animatable<number>=>{
  const scale=(value:number)=>property==='transform.scaleX'||property==='transform.scaleY'?1+(value-1)*factor:value*factor
  if(source.kind==='constant'&&typeof source.value==='number')return constant(scale(source.value))
  if(source.kind==='keyframes'&&source.keyframes.every(item=>typeof item.value==='number'))return keyframed(source.keyframes.map(item=>Object.freeze({...item,value:scale(item.value as number)})))
  throw new RangeError(`Motion intensity cannot scale non-numeric ${property}.`)
}
const nodeAnimatable=(node:MotionNodeV1,property:MotionNodePropertyNameV1):Animatable<unknown>=>{
  if(property==='visible')return node.visible;if(property==='opacity')return node.opacity;if(property.startsWith('transform.'))return node.transform[property.slice('transform.'.length) as keyof MotionNodeV1['transform']]
  if(node.type==='text'){if(property==='text.text')return node.text;if(property==='text.fillColor')return node.fillColor;if(property==='text.fontSize')return node.fontSize;if(property==='text.fontWeight')return node.fontWeight}
  if(node.type==='shape'){if(property==='shape.width')return node.width;if(property==='shape.height')return node.height;if(property==='shape.fillColor')return node.fillColor;if(property==='shape.strokeColor')return node.strokeColor;if(property==='shape.strokeWidth')return node.strokeWidth;if(property==='shape.radius')return node.radius}
  if(node.type==='path'){if(property==='path.fillColor')return node.fillColor;if(property==='path.strokeColor')return node.strokeColor;if(property==='path.strokeWidth')return node.strokeWidth;if(property==='path.trimProgress')return node.trimProgress}
  if(node.type==='image'){if(property==='image.width')return node.width;if(property==='image.height')return node.height;if(property==='image.opacity')return node.imageOpacity}
  throw new RangeError(`Unsupported property ${property} for node ${node.id}.`)
}

export const classifyPromotionCandidateV1=(candidate:PromotionCandidateV1,scene:MotionSceneV1,motionPlan?:MotionPlanV1):PromotionClassificationV1=>{
  const objectCount=Object.keys(scene.nodes).length-1,semanticPartCount=scene.semanticParts.length
  const sceneLike=objectCount>=4&&semanticPartCount>=2
  const recommended:PromotionTargetKindV1=sceneLike?'scene':'component'
  const alternatives:PromotionTargetKindV1[]=[recommended==='scene'?'component':'scene']
  const opportunities:PromotionExtractionOpportunityV1[]=[Object.freeze({kind:recommended,description:sceneLike?'Multi-object semantic composition is reusable as a complete visual moment.':'Coherent visual object has stable semantic structure and reusable content slots.'})]
  if(motionPlan&&motionPlan.beats.length>=2){alternatives.push('motion-recipe');opportunities.push(Object.freeze({kind:'motion-recipe',description:'Approved MotionPlan contains multi-beat choreography that can be generalized into semantic roles.'}))}
  if(candidate.requestedTargetKinds.includes('effect'))alternatives.push('effect');if(candidate.requestedTargetKinds.includes('preset'))alternatives.push('preset')
  return Object.freeze({recommendedKind:recommended,alternativeKinds:unique(alternatives),reasons:Object.freeze([sceneLike?`${objectCount} visual nodes across ${semanticPartCount} semantic parts form a reusable multi-object composition.`:'The approved graph is a compact coherent reusable object.','Classification uses canonical graph semantics, not screenshots.']),extractionOpportunities:Object.freeze(opportunities)})
}

const styleRoleMap=(scene:MotionSceneV1,parameters:readonly ReusableParameterDefinitionV1[]):ReusableStyleRoleMapV1=>{
  const accent=parameters.find(item=>item.publicPath==='style.accent')?.bindings??[]
  const accentNodeIds=new Set(accent.map(item=>item.nodeId))
  const primaryText:PromotionBindingV1[]=[],secondaryText:PromotionBindingV1[]=[],surface:PromotionBindingV1[]=[],background:PromotionBindingV1[]=[]
  for(const node of Object.values(scene.nodes)){
    const key=`${node.id} ${node.name}`.toLowerCase()
    if(node.type==='text'&&!accentNodeIds.has(node.id)){const target=key.includes('label')||key.includes('support')?secondaryText:primaryText;target.push(binding(node.id,'text.fillColor','semantic-color-role'))}
    if(node.type==='shape'){if(key.includes('surface')||key.includes('card'))surface.push(binding(node.id,'shape.fillColor','semantic-color-role'));if(key.includes('background'))background.push(binding(node.id,'shape.fillColor','semantic-color-role'))}
  }
  return Object.freeze({accent:Object.freeze([...accent]),primaryText:Object.freeze(primaryText),secondaryText:Object.freeze(secondaryText),surface:Object.freeze(surface),background:Object.freeze(background)})
}
const exposureMap=(parameters:readonly ReusableParameterDefinitionV1[]):ReusableExposureMapV1=>Object.freeze({creator:Object.freeze(parameters.filter(item=>item.exposureLevel==='creator').map(item=>item.publicPath)),designer:Object.freeze(parameters.filter(item=>item.exposureLevel==='designer').map(item=>item.publicPath)),advanced:Object.freeze(parameters.filter(item=>item.exposureLevel==='advanced').map(item=>item.publicPath)),fullGraph:true})
const lineage=(source:PromotionSourceV1,candidate:PromotionCandidateV1,planId:string):PromotedCapabilityLineageV1=>Object.freeze({schemaVersion:'sanverse.promoted-capability-lineage/v1',sourceOrigin:source.origin,sourceProjectId:source.sourceProjectId,sourceProjectRevision:source.sourceProjectRevision,sourceSceneId:source.sourceSceneId,sourceSceneRevision:source.sourceSceneRevision,...(source.sourceStoryboardId?{storyboardId:source.sourceStoryboardId}:{}),...(source.sourceStoryboardRevision?{storyboardRevision:source.sourceStoryboardRevision}:{}),...(source.sourceAnimaticId?{animaticId:source.sourceAnimaticId}:{}),...(source.sourceAnimaticRevision?{animaticRevision:source.sourceAnimaticRevision}:{}),...(source.sourceMotionPlanId?{motionPlanId:source.sourceMotionPlanId}:{}),...(source.sourceMotionPlanRevision?{motionPlanRevision:source.sourceMotionPlanRevision}:{}),motionApprovalId:source.motionApproval.id,promotionCandidateId:candidate.id,promotionRevision:candidate.revision,parameterizationPlanId:planId,promotedAt:source.motionApproval.approvedAt,dependencyIds:Object.freeze(source.dependencies.map(item=>item.id))})

export const productizePromotionCandidateV1=(input:ProductizePromotionInputV1):CreativeOperationResultV1<ProductizedPromotedCapabilityV1>=>{
  if(!isId(input.id)||!isId(input.title)||!isId(input.description)||!Number.isSafeInteger(input.registrationVersion)||input.registrationVersion<1)return creativeOperationRefusal('PROMOTION_PRODUCTIZATION_INVALID','Productization identity/version is invalid.')
  if(input.parameterization.candidateId!==input.candidate.id||input.parameterization.sourceRevision!==input.candidate.sourceSceneRevision)return creativeOperationRefusal('PROMOTION_PARAMETERIZATION_STALE','Parameterization plan does not match the exact candidate/source revision.')
  if(!input.candidate.requestedTargetKinds.includes(input.targetKind)&&input.targetKind!==input.classification.recommendedKind)return creativeOperationRefusal('PROMOTION_TARGET_KIND_NOT_REQUESTED','Selected promotion target kind was not requested/classified for this candidate.')
  const graph=validateMotionScene(input.source.scene);if(!graph.ok)return creativeOperationRefusal('PROMOTION_SOURCE_GRAPH_INVALID','Cannot productize an invalid source graph.',graph.issues)
  const parameters:ReusableParameterDefinitionV1[]=input.parameterization.parameters.filter(item=>item.status!=='rejected').map(item=>Object.freeze({id:item.id,publicPath:item.proposedPublicPath,category:item.category,valueType:item.valueType,defaultValue:item.defaultValue,bindings:Object.freeze([...item.sourceBindings]),...(item.constraints?{constraints:item.constraints}:{}),exposureLevel:item.exposureLevel}))
  const defaults=Object.freeze(Object.fromEntries(parameters.map(item=>[item.publicPath,item.defaultValue])))
  const modes:readonly MotionPresentationModeV1[]=Object.freeze<MotionPresentationModeV1[]>(['full-screen-motion','overlay'])
  const template:ReusableMotionTemplateV1=Object.freeze({schemaVersion:'sanverse.reusable-motion-template/v1',id:input.id,version:input.registrationVersion,targetKind:input.targetKind,canonicalGraph:input.source.scene,parameters:Object.freeze(parameters),frozenDesignProperties:Object.freeze([...input.parameterization.frozenDesignProperties]),exposure:exposureMap(parameters),styleRoles:styleRoleMap(input.source.scene,parameters),defaultProps:defaults,supportedRatios:Object.freeze([...input.source.scene.supportedAspectRatios]),supportedPresentationModes:modes,requiredCapabilities:Object.freeze([])})
  const fixture:PromotionCanonicalFixtureV1=Object.freeze({schemaVersion:'sanverse.promotion-canonical-fixture/v1',id:`${input.id}:default`,values:defaults})
  const capability:ProductizedPromotedCapabilityV1=Object.freeze({schemaVersion:'sanverse.promoted-capability/v1',id:input.id,version:input.registrationVersion,title:input.title,description:input.description,targetKind:input.targetKind,origin:input.source.origin,reuseStatus:'promotion-candidate',communicationGoals:Object.freeze([input.source.motionPlan?.beats.some(beat=>beat.purpose==='payoff')?'metric-payoff':'custom']),supportedPresentationModes:modes,supportedRatios:Object.freeze([...input.source.scene.supportedAspectRatios]),styleTraits:Object.freeze(['structured','generated']),motionTraits:Object.freeze(input.source.motionPlan?['sequential','hold']:['fade']),requiredCapabilities:Object.freeze([]),editability:'full',performanceClass:Object.keys(input.source.scene.nodes).length>80?'heavy':Object.keys(input.source.scene.nodes).length>30?'medium':'light',template,canonicalFixture:fixture,lineage:lineage(input.source,input.candidate,input.parameterization.id),dependencies:Object.freeze([...input.source.dependencies]),parameterizationPlanId:input.parameterization.id,sourceSceneRevision:input.source.sourceSceneRevision})
  return creativeOperationOk(capability,capability.version)
}

const applyImageSource=(scene:MotionSceneV1,nodeId:string,value:string):CreativeOperationResultV1<MotionSceneV1>=>{const node=scene.nodes[nodeId];if(!node||node.type!=='image')return creativeOperationRefusal('PROMOTION_BINDING_BROKEN',`Image binding node ${nodeId} does not exist or is not an image.`);const nodes=Object.freeze({...scene.nodes,[nodeId]:Object.freeze({...node,source:value})});const next=Object.freeze({...scene,nodes});const valid=validateMotionScene(next);return valid.ok?creativeOperationOk(next,1):creativeOperationRefusal('PROMOTION_BINDING_BROKEN','Media replacement produced an invalid graph.',valid.issues)}
const applyDefinition=(template:ReusableMotionTemplateV1,scene:MotionSceneV1,definition:ReusableParameterDefinitionV1,value:unknown):CreativeOperationResultV1<MotionSceneV1>=>{
  if(!valueMatches(definition.valueType,value))return creativeOperationRefusal('PROMOTION_PARAMETER_TYPE_MISMATCH',`${definition.publicPath} expects ${definition.valueType}.`)
  if(definition.valueType==='number'&&definition.constraints){const number=value as number,min=definition.constraints.minimum,max=definition.constraints.maximum;if(typeof min==='number'&&number<min||typeof max==='number'&&number>max)return creativeOperationRefusal('PROMOTION_PARAMETER_CONSTRAINT_VIOLATION',`${definition.publicPath} violates numeric constraints.`)}
  let next=scene
  for(const [index,b] of definition.bindings.entries()){
    const node=next.nodes[b.nodeId];if(!node)return creativeOperationRefusal('PROMOTION_BINDING_BROKEN',`Binding node ${b.nodeId} does not exist.`)
    if(b.propertyPath==='image.source'){if(typeof value!=='string')return creativeOperationRefusal('PROMOTION_PARAMETER_TYPE_MISMATCH',`${definition.publicPath} expects media reference string.`);const applied=applyImageSource(next,b.nodeId,value);if(!applied.ok)return applied;next=applied.value;continue}
    if(!pathProperty(b.propertyPath))return creativeOperationRefusal('PROMOTION_BINDING_BROKEN',`Binding property ${b.propertyPath} is not supported by the canonical Motion Graph.`)
    let animatable:Animatable<string|number|boolean>
    if(b.transform==='numeric-scale'){
      if(typeof value!=='number')return creativeOperationRefusal('PROMOTION_PARAMETER_TYPE_MISMATCH',`${definition.publicPath} expects a numeric intensity.`)
      const baseNode=template.canonicalGraph.nodes[b.nodeId];if(!baseNode)return creativeOperationRefusal('PROMOTION_BINDING_BROKEN',`Template source node ${b.nodeId} is missing.`)
      try{animatable=scaleAnimatable(nodeAnimatable(baseNode,b.propertyPath),value,b.propertyPath) as Animatable<number>}catch(error){return creativeOperationRefusal('PROMOTION_BINDING_BROKEN',error instanceof Error?error.message:'Cannot scale binding.')}
    }else animatable=constant(value as string|number|boolean)
    const operation:MotionGraphOperationV1={operationId:`promotion:${definition.id}:${index}`,type:'set-property',target:{nodeId:b.nodeId,property:b.propertyPath},value:animatable};const applied=applyMotionOperations(next,[operation]);if(!applied.ok)return creativeOperationRefusal('PROMOTION_PARAMETER_APPLY_FAILED',applied.error.message,applied.error);next=applied.scene
  }
  return creativeOperationOk(next,1)
}

export const instantiateReusableMotionTemplateV1=(template:ReusableMotionTemplateV1,values:Readonly<Record<string,unknown>>,options:Readonly<{instanceId:string}>):CreativeOperationResultV1<ReusableMotionInstanceV1>=>{
  if(!isId(options.instanceId))return creativeOperationRefusal('PROMOTION_INSTANCE_INVALID','Reusable instance id is required.')
  let scene:MotionSceneV1=template.canonicalGraph
  const merged={...template.defaultProps,...values}
  for(const definition of template.parameters){const result=applyDefinition(template,scene,definition,merged[definition.publicPath]);if(!result.ok)return result as CreativeOperationResultV1<ReusableMotionInstanceV1>;scene=result.value}
  const root=scene.nodes[scene.rootNodeId];if(root?.type==='group')scene=Object.freeze({...scene,componentId:template.id,componentVersion:template.version,nodes:Object.freeze({...scene.nodes,[root.id]:Object.freeze({...root,componentInstance:Object.freeze({componentId:template.id,version:template.version,instanceId:options.instanceId})})})})
  return creativeOperationOk(Object.freeze({templateId:template.id,templateVersion:template.version,instanceId:options.instanceId,semanticNodeIds:Object.freeze(Object.keys(scene.nodes)),scene}),template.version)
}

export const applyTemplateParameterV1=(template:ReusableMotionTemplateV1,scene:MotionSceneV1,publicPath:string,value:unknown):CreativeOperationResultV1<MotionSceneV1>=>{const definition=template.parameters.find(item=>item.publicPath===publicPath);return definition?applyDefinition(template,scene,definition,value):creativeOperationRefusal('PROMOTION_PARAMETER_UNKNOWN',`Unknown reusable parameter ${publicPath}.`)}

const applyColorBindings=(scene:MotionSceneV1,bindings:readonly PromotionBindingV1[],color:string,prefix:string):CreativeOperationResultV1<MotionSceneV1>=>{let next=scene;for(const [index,b] of bindings.entries()){if(!pathProperty(b.propertyPath))continue;const applied=applyMotionOperations(next,[{operationId:`style:${prefix}:${index}`,type:'set-property',target:{nodeId:b.nodeId,property:b.propertyPath},value:constant(color)}]);if(!applied.ok)return creativeOperationRefusal('STYLE_ADAPTATION_PARTIAL',applied.error.message,applied.error);next=applied.scene}return creativeOperationOk(next,1)}
export const applyStyleLockV1=(template:ReusableMotionTemplateV1,scene:MotionSceneV1,lock:StyleLockV1):CreativeOperationResultV1<StyleAdaptationResultV1>=>{
  let next=scene;const warnings:string[]=[]
  for(const [role,color] of Object.entries(lock) as [keyof StyleLockV1,string|undefined][])if(color){const bindings=template.styleRoles[role]??[];if(bindings.length===0){warnings.push(`STYLE_ADAPTATION_PARTIAL: no compatible ${role} role is exposed.`);continue}const applied=applyColorBindings(next,bindings,color,role);if(!applied.ok){warnings.push(applied.refusal.message);continue}next=applied.value}
  return creativeOperationOk(Object.freeze({scene:next,status:warnings.length?'partial':'applied',warnings:Object.freeze(warnings)}),1)
}
