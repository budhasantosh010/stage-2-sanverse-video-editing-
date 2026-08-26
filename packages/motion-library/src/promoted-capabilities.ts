import type { MotionAspectRatio,MotionPerformanceClass,MotionPresentationModeV1 } from '@sanverse/motion-contract'
import { promotedCapabilityToCapabilityCatalogItemV1,type RegisteredPromotedCapabilityV1,type ReusableParameterDefinitionV1 } from '@sanverse/motion-promotion'

export interface PromotedMotionLibraryDetailV1 {
  readonly id:string
  readonly version:number
  readonly title:string
  readonly description:string
  readonly targetKind:RegisteredPromotedCapabilityV1['targetKind']
  readonly origin:'generated'
  readonly reuseStatus:'promoted-reusable'
  readonly libraryScope:'generated'
  readonly communicationGoals:readonly string[]
  readonly supportedPresentationModes:readonly MotionPresentationModeV1[]
  readonly supportedRatios:readonly MotionAspectRatio[]
  readonly styleTraits:readonly string[]
  readonly motionTraits:readonly string[]
  readonly editability:'full'
  readonly performanceClass:MotionPerformanceClass
  readonly parameters:readonly ReusableParameterDefinitionV1[]
  readonly lineage:RegisteredPromotedCapabilityV1['lineage']
  readonly qaStatus:'passed'
  readonly posterRef:string
  readonly reviewRef:string
  readonly externalDependencies:readonly Readonly<{id:string;attribution?:string;runtimeRestriction?:string}>[]
}

export const promotedCapabilityToLibraryDetailV1=(entry:RegisteredPromotedCapabilityV1):PromotedMotionLibraryDetailV1=>Object.freeze({
  id:entry.id,version:entry.version,title:entry.title,description:entry.description,targetKind:entry.targetKind,
  origin:'generated',reuseStatus:'promoted-reusable',libraryScope:'generated',communicationGoals:Object.freeze([...entry.communicationGoals]),
  supportedPresentationModes:Object.freeze([...entry.supportedPresentationModes]),supportedRatios:Object.freeze([...entry.supportedRatios]),
  styleTraits:Object.freeze([...entry.styleTraits]),motionTraits:Object.freeze([...entry.motionTraits]),editability:'full',performanceClass:entry.performanceClass,
  parameters:Object.freeze([...entry.template.parameters]),lineage:entry.lineage,qaStatus:'passed',posterRef:entry.reviewArtifacts.posterRef,reviewRef:entry.reviewArtifacts.reviewRef,
  externalDependencies:Object.freeze(entry.dependencies.filter(item=>item.origin==='external').map(item=>Object.freeze({id:item.id,...(item.attribution?{attribution:item.attribution}:{}),...(item.runtimeRestriction?{runtimeRestriction:item.runtimeRestriction}:{})}))),
})

export const promotedCapabilityToB2RecordV1=(entry:RegisteredPromotedCapabilityV1)=>promotedCapabilityToCapabilityCatalogItemV1(entry)

export const mergeMotionLibraryCapabilityRecordsV1=<T>(base:readonly T[],promoted:readonly RegisteredPromotedCapabilityV1[]):readonly (T|ReturnType<typeof promotedCapabilityToB2RecordV1>)[]=>Object.freeze([...base,...promoted.map(promotedCapabilityToB2RecordV1)])
