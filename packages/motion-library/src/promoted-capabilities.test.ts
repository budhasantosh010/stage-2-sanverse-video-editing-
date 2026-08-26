import { describe,expect,it } from 'vitest'
import type { RegisteredPromotedCapabilityV1 } from '@sanverse/motion-promotion'
import { mergeMotionLibraryCapabilityRecordsV1,promotedCapabilityToB2RecordV1,promotedCapabilityToLibraryDetailV1 } from './promoted-capabilities.ts'

const promoted=():RegisteredPromotedCapabilityV1=>({
  schemaVersion:'sanverse.promoted-capability/v1',id:'promoted.metric-story',version:1,title:'Metric Story',description:'Reusable generated metric story',targetKind:'scene',origin:'generated',reuseStatus:'promoted-reusable',communicationGoals:['statistic'],supportedPresentationModes:['overlay','full-screen-motion'],supportedRatios:['16:9','9:16'],styleTraits:['structured'],motionTraits:['sequential'],requiredCapabilities:[],editability:'full',performanceClass:'light',
  template:{schemaVersion:'sanverse.reusable-motion-template/v1',id:'promoted.metric-story',version:1,targetKind:'scene',canonicalGraph:{} as never,parameters:[{id:'parameter:content.headline',publicPath:'content.headline',category:'content',valueType:'string',defaultValue:'Revenue grew',bindings:[{nodeId:'headline',propertyPath:'text.text',transform:'identity'}],exposureLevel:'creator'}],frozenDesignProperties:[],exposure:{creator:['content.headline'],designer:[],advanced:[],fullGraph:true},styleRoles:{accent:[],primaryText:[],secondaryText:[],surface:[],background:[]},defaultProps:{'content.headline':'Revenue grew'},supportedRatios:['16:9','9:16'],supportedPresentationModes:['overlay','full-screen-motion'],requiredCapabilities:[]},
  canonicalFixture:{schemaVersion:'sanverse.promotion-canonical-fixture/v1',id:'promoted.metric-story:default',values:{'content.headline':'Revenue grew'}},parameterizationPlanId:'params:1',sourceSceneRevision:1,
  lineage:{schemaVersion:'sanverse.promoted-capability-lineage/v1',sourceOrigin:'generated',sourceProjectId:'project:a',sourceProjectRevision:12,sourceSceneId:'motion:a',sourceSceneRevision:1,motionApprovalId:'approval:a',promotionCandidateId:'candidate:a',promotionRevision:1,parameterizationPlanId:'params:1',promotedAt:'2026-08-26T00:00:00.000Z',dependencyIds:[]},dependencies:[],qa:{schemaVersion:'sanverse.promotion-qa/v1',ok:true,findings:[],checkedAt:'2026-08-26T00:00:00.000Z'},registrationConfirmation:{schemaVersion:'sanverse.promotion-registration-confirmation/v1',id:'confirm:1',candidateId:'candidate:a',candidateRevision:1,authority:'owner',confirmedAt:'2026-08-26T00:00:00.000Z'},reviewArtifacts:{posterRef:'frame://poster',reviewRef:'review://1x'},
})

describe('Promoted capability Library adapter',()=>{
  it('keeps generated origin orthogonal to promoted reuse status and exposes lineage/parameters/review evidence',()=>{
    const detail=promotedCapabilityToLibraryDetailV1(promoted())
    expect(detail).toMatchObject({id:'promoted.metric-story',origin:'generated',reuseStatus:'promoted-reusable',libraryScope:'generated',qaStatus:'passed',posterRef:'frame://poster',reviewRef:'review://1x',lineage:{sourceProjectId:'project:a'}})
    expect(detail.parameters.map(item=>item.publicPath)).toEqual(['content.headline'])
  })
  it('feeds promoted entries into the normal B2-shaped capability catalog without mutating the static Library list',()=>{
    const record=promotedCapabilityToB2RecordV1(promoted())
    expect(record).toMatchObject({id:'promoted.metric-story',kind:'generated-scene',origin:'generated',reuseStatus:'promoted-reusable',libraryScope:'generated',qualityStatus:'passed',ownerApprovalStatus:'owner-approved'})
    const base=Object.freeze([{id:'sanverse.a'}]);const merged=mergeMotionLibraryCapabilityRecordsV1(base,[promoted()])
    expect(base).toEqual([{id:'sanverse.a'}]);expect(merged.map(item=>item.id)).toEqual(['sanverse.a','promoted.metric-story'])
  })
})
