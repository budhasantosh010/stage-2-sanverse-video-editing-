import { describe, expect, it } from 'vitest'
import { migrateCreativeRunV1ToV2, validateCreativeRunV1 } from './creative-run.ts'

const legacyRun = () => ({
  schemaVersion:'sanverse.creative-run/v1',
  runId:'run_12345678',
  projectId:'project_1234567890abcdef',
  baseProjectRevision:0,
  sourceAssetId:'asset_1234567890ab',
  stage:'storyboard',
  createdAt:'2026-08-31T00:00:00.000Z',
  updatedAt:'2026-08-31T00:01:00.000Z',
  sourceUnderstanding:{schemaVersion:'sanverse.source-understanding-packet/v1',id:'sourcepkt_12345678',projectId:'project_1234567890abcdef',projectRevision:0,sourceAssetId:'asset_1234567890ab',sourceDurationTicks:1440000,sourceSegments:[],observations:[],capabilities:[],limitations:[],evidenceHash:'a'.repeat(64)},
  opportunityMap:{
    schemaVersion:'sanverse.motion-opportunity-map/v1',id:'opmap_12345678',projectId:'project_1234567890abcdef',projectRevision:0,sourcePacketId:'sourcepkt_12345678',targetCount:1,requestedMax:1,selectedCount:0,rejectedCandidates:[],styleLockId:'legacy_style_lock',
    styleRecommendation:{schemaVersion:'sanverse.style-lock-recommendation/v1',visual:{paletteRoles:{background:'#000000',surface:'#111111',text:'#FFFFFF',accent:'#FF7A1A'},radius:16,stroke:1,shadow:.2,depth:.18,texture:'none'},motion:{baseTiming:'balanced',primaryEase:'soft',secondaryEase:'soft',overshootAllowance:.12,travelDistance:48,staggerRhythm:.12,holdDiscipline:'balanced',cameraAggressiveness:.2,effectIntensity:.3},composition:{density:'low',alignment:'adaptive',safeArea:.1,negativeSpacePreference:'preserve',subjectPriority:'high'},reasons:['legacy automatic recommendation']},
    creativeLanguage:{schemaVersion:'sanverse.video-creative-language/v1',id:'language_legacy',version:1,styleLockId:'legacy_style_lock',preferredPresentationModes:['overlay'],typographyLanguage:'editorial',surfaceLanguage:'soft-depth',motionRhythm:'balanced',transitionVocabulary:['cut'],densityPolicy:'low',cameraPolicy:'restrained',paletteRoles:['background','surface','text','accent'],easingFamily:['soft'],overshootMax:.12,allowedExceptions:[]},
    opportunities:[],planningRules:{minimumOpportunityTicks:1440000,overlapPolicy:'non-overlapping-half-open',capabilityCatalogSource:'b2-motion-library',recipeCatalogSource:'edit-domain-component-recipes',agentCandidatesValidated:false},
  },
  sceneBatch:{schemaVersion:'sanverse.persisted-creative-scene-batch/v1',id:'scenebatch_12345678',projectId:'project_1234567890abcdef',projectRevision:0,opportunityMapId:'opmap_12345678',workflows:[],pendingApprovalRequests:[]},
  sceneIds:['creative_scene_12345678'],
  reviews:[],
  extensions:{},
})

describe('Creative Run V1 to V2 migration',()=>{
  it('turns legacy automatic style into an unapproved direction and archives downstream authority instead of grandfathering it',()=>{
    const migrated=migrateCreativeRunV1ToV2(legacyRun())
    expect(migrated).not.toBeNull()
    expect(migrated).toMatchObject({schemaVersion:'sanverse.creative-run/v2',stage:'creative-direction-review',creativeDirectionProposal:{status:'awaiting-owner',revision:1},sceneIds:[],reviews:[]})
    expect(migrated?.approvedStyleLock).toBeUndefined()
    expect(migrated?.opportunityMap).toBeUndefined()
    expect(migrated?.sceneBatch).toBeUndefined()
    expect((migrated?.extensions.legacyPreDirectionState as any)?.opportunityMap.id).toBe('opmap_12345678')
    expect((migrated?.extensions.legacyPreDirectionState as any)?.sceneIds).toEqual(['creative_scene_12345678'])
    expect(validateCreativeRunV1(legacyRun())).toMatchObject({ok:true,value:{stage:'creative-direction-review',approvedStyleLock:undefined,sceneIds:[]}})
  })
})
