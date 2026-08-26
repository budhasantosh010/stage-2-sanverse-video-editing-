import type { CapabilityCatalogItemV1 } from '@sanverse/creative-direction'
import type { RegisteredPromotedCapabilityV1 } from './qa-registry.ts'

export const promotedCapabilityToCapabilityCatalogItemV1=(entry:RegisteredPromotedCapabilityV1):CapabilityCatalogItemV1=>Object.freeze({
  id:entry.id,
  kind:entry.targetKind==='motion-recipe'?'motion-recipe':'generated-scene',
  title:entry.title,
  description:entry.description,
  semanticTags:Object.freeze([...entry.communicationGoals,...entry.styleTraits,...entry.motionTraits]),
  communicationGoals:Object.freeze([...entry.communicationGoals]),
  supportedPresentationModes:Object.freeze([...entry.supportedPresentationModes]),
  supportedRatios:Object.freeze([...entry.supportedRatios]),
  styleTraits:Object.freeze([...entry.styleTraits]),
  motionTraits:Object.freeze([...entry.motionTraits]),
  editability:'full',
  libraryScope:'generated',
  origin:entry.origin,
  reuseStatus:'promoted-reusable',
  requiredCapabilities:Object.freeze([...entry.requiredCapabilities]),
  qualityStatus:'passed',
  ownerApprovalStatus:'owner-approved',
  performanceClass:entry.performanceClass,
  provenance:entry.lineage,
})
