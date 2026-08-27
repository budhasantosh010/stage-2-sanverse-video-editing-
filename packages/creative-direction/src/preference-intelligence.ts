import { creativeOperationOk,creativeOperationRefusal,type CreativeOperationResultV1 } from '@sanverse/motion-contract'

export const CREATIVE_PREFERENCE_DIMENSIONS_V1=Object.freeze(['presentation-mode','motion-rhythm','density','camera-policy','easing','transition','surface-language'] as const)
export type CreativePreferenceDimensionV1=(typeof CREATIVE_PREFERENCE_DIMENSIONS_V1)[number]
export type CreativePreferenceEvidenceKindV1='owner-accepted'|'owner-repaired'|'owner-rejected'
export interface CreativePreferenceEvidenceV1 {
  readonly schemaVersion:'sanverse.creative-preference-evidence/v1'
  readonly id:string
  readonly projectId:string
  readonly kind:CreativePreferenceEvidenceKindV1
  readonly dimension:CreativePreferenceDimensionV1
  readonly value:string
  readonly contextTags:readonly string[]
}
export interface CreativeFailureEvidenceV1 {
  readonly schemaVersion:'sanverse.creative-failure-evidence/v1'
  readonly id:string
  readonly projectId:string
  readonly code:string
  readonly family:string
  readonly contextTags:readonly string[]
  readonly resolution?:string
}
export interface PromotedCreativePreferenceV1 {
  readonly dimension:CreativePreferenceDimensionV1
  readonly value:string
  readonly confidence:number
  readonly positiveCount:number
  readonly projectCount:number
  readonly evidenceIds:readonly string[]
  readonly reasons:readonly string[]
}
export interface CreativePreferenceCandidateV1 extends PromotedCreativePreferenceV1 { readonly blockedReasons:readonly string[] }
export interface CreativeFailureLessonV1 {
  readonly code:string
  readonly family:string
  readonly occurrenceCount:number
  readonly projectCount:number
  readonly evidenceIds:readonly string[]
  readonly resolutions:readonly string[]
  readonly recommendation:string
}
export interface CreativePreferenceIntelligenceV1 {
  readonly schemaVersion:'sanverse.creative-preference-intelligence/v1'
  readonly promoted:readonly PromotedCreativePreferenceV1[]
  readonly candidates:readonly CreativePreferenceCandidateV1[]
  readonly failureLessons:readonly CreativeFailureLessonV1[]
  readonly policy:Readonly<{minimumPositiveEvidence:3;minimumProjects:2;conflictsBlockPromotion:true;automaticMutation:false}>
}
const bounded=(value:unknown,max=240):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max
const tagsOk=(value:unknown):value is readonly string[]=>Array.isArray(value)&&value.length<=32&&value.every(tag=>bounded(tag,80))
const validatePreference=(e:CreativePreferenceEvidenceV1)=>e.schemaVersion==='sanverse.creative-preference-evidence/v1'&&bounded(e.id)&&bounded(e.projectId)&&['owner-accepted','owner-repaired','owner-rejected'].includes(e.kind)&&CREATIVE_PREFERENCE_DIMENSIONS_V1.includes(e.dimension)&&bounded(e.value,160)&&tagsOk(e.contextTags)
const validateFailure=(e:CreativeFailureEvidenceV1)=>e.schemaVersion==='sanverse.creative-failure-evidence/v1'&&bounded(e.id)&&bounded(e.projectId)&&bounded(e.code,120)&&bounded(e.family,120)&&tagsOk(e.contextTags)&&(e.resolution===undefined||bounded(e.resolution,500))
const key=(dimension:string,value:string)=>`${dimension}\u0000${value}`
export const buildCreativePreferenceIntelligenceV1=(preferenceEvidence:readonly CreativePreferenceEvidenceV1[],failureEvidence:readonly CreativeFailureEvidenceV1[]):CreativeOperationResultV1<CreativePreferenceIntelligenceV1>=>{
  if(!Array.isArray(preferenceEvidence)||!preferenceEvidence.every(validatePreference))return creativeOperationRefusal('PREFERENCE_EVIDENCE_INVALID','B8 preference evidence must be explicit, bounded, versioned owner evidence.')
  if(!Array.isArray(failureEvidence)||!failureEvidence.every(validateFailure))return creativeOperationRefusal('FAILURE_EVIDENCE_INVALID','B8 failure evidence must be bounded, versioned project evidence.')
  const ids=new Set<string>();for(const item of [...preferenceEvidence,...failureEvidence]){if(ids.has(item.id))return creativeOperationRefusal('INTELLIGENCE_EVIDENCE_DUPLICATE','B8 evidence ids must be globally unique.');ids.add(item.id)}
  const groups=new Map<string,CreativePreferenceEvidenceV1[]>();for(const item of preferenceEvidence){const group=groups.get(key(item.dimension,item.value))??[];group.push(item);groups.set(key(item.dimension,item.value),group)}
  const positiveByDimension=new Map<CreativePreferenceDimensionV1,Map<string,number>>();for(const [groupKey,items] of groups){const [dimension,value]=groupKey.split('\u0000') as [CreativePreferenceDimensionV1,string];const positives=items.filter(item=>item.kind!=='owner-rejected').length;const values=positiveByDimension.get(dimension)??new Map<string,number>();values.set(value,positives);positiveByDimension.set(dimension,values)}
  const promoted:PromotedCreativePreferenceV1[]=[],candidates:CreativePreferenceCandidateV1[]=[]
  for(const [groupKey,items] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){const [dimension,value]=groupKey.split('\u0000') as [CreativePreferenceDimensionV1,string];const positives=items.filter(item=>item.kind!=='owner-rejected'),negatives=items.filter(item=>item.kind==='owner-rejected'),projects=new Set(positives.map(item=>item.projectId));const competitors=[...(positiveByDimension.get(dimension)?.entries()??[])].filter(([other,count])=>other!==value&&count>=2);const blocked:string[]=[];if(positives.length<3)blocked.push('Fewer than three explicit positive owner signals.');if(projects.size<2)blocked.push('Evidence does not span at least two projects.');if(negatives.length>0)blocked.push('Conflicting owner rejection exists for this exact value.');if(competitors.length>0)blocked.push(`Competing repeated preference evidence exists: ${competitors.map(([other])=>other).join(', ')}.`);const confidence=Number((positives.length/Math.max(1,items.length)).toFixed(3));const base=Object.freeze({dimension,value,confidence,positiveCount:positives.length,projectCount:projects.size,evidenceIds:Object.freeze(items.map(item=>item.id).sort()),reasons:Object.freeze([`${positives.length} positive owner signals across ${projects.size} project(s).`,...(negatives.length?[`${negatives.length} explicit rejection(s) prevent silent overfitting.`]:[])])});if(blocked.length===0)promoted.push(base);else candidates.push(Object.freeze({...base,blockedReasons:Object.freeze(blocked)}))}
  const failureGroups=new Map<string,CreativeFailureEvidenceV1[]>();for(const item of failureEvidence){const failureKey=`${item.code}\u0000${item.family}`;const group=failureGroups.get(failureKey)??[];group.push(item);failureGroups.set(failureKey,group)}
  const lessons:CreativeFailureLessonV1[]=[];for(const [failureKey,items] of [...failureGroups.entries()].sort(([a],[b])=>a.localeCompare(b))){const projects=new Set(items.map(item=>item.projectId));if(items.length<2||projects.size<2)continue;const [code,family]=failureKey.split('\u0000');const resolutions=[...new Set(items.flatMap(item=>item.resolution?[item.resolution]:[]))].sort();lessons.push(Object.freeze({code:code!,family:family!,occurrenceCount:items.length,projectCount:projects.size,evidenceIds:Object.freeze(items.map(item=>item.id).sort()),resolutions:Object.freeze(resolutions),recommendation:`Avoid repeating ${family} pattern ${code}; it failed in ${projects.size} projects. ${resolutions.length?`Known repair: ${resolutions.join(' | ')}`:'Require explicit review before reuse.'}`}))}
  return creativeOperationOk(Object.freeze({schemaVersion:'sanverse.creative-preference-intelligence/v1',promoted:Object.freeze(promoted),candidates:Object.freeze(candidates),failureLessons:Object.freeze(lessons),policy:Object.freeze({minimumPositiveEvidence:3 as const,minimumProjects:2 as const,conflictsBlockPromotion:true as const,automaticMutation:false as const})}),1)
}
