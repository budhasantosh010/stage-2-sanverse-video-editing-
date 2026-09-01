import { describe, expect, it } from 'vitest'
import { applyCreativeDirectionChangesV1, buildVideoCreativeLanguageDraftV1, canonicalApprovedStyleContentV1, compileVideoCreativeLanguageV1, type CreativeDirectionProposalV1 } from './creative-direction-gate.ts'
import type { StyleLockRecommendationV1 } from './style-cohesion.ts'

const recommendation:StyleLockRecommendationV1=Object.freeze({
  schemaVersion:'sanverse.style-lock-recommendation/v1',
  visual:Object.freeze({paletteRoles:Object.freeze({background:'#0B0C10',surface:'#0B0C10',text:'#FFFFFF',accent:'#FF7A1A'}),typeFamily:'Inter',radius:16,stroke:1,shadow:.2,depth:.18,texture:'none'}),
  motion:Object.freeze({baseTiming:'balanced',primaryEase:'soft',secondaryEase:'soft',overshootAllowance:.12,travelDistance:48,staggerRhythm:.12,holdDiscipline:'balanced',cameraAggressiveness:.2,effectIntensity:.3}),
  composition:Object.freeze({density:'low',alignment:'adaptive',safeArea:.1,negativeSpacePreference:'preserve',subjectPriority:'high'}),
  reasons:Object.freeze(['Source is information-dense, so graphics stay restrained.']),
})
const proposal:CreativeDirectionProposalV1=Object.freeze({schemaVersion:'sanverse.creative-direction-proposal/v1',proposalId:'direction_12345678',projectId:'project_1234567890abcdef',projectRevision:0,sourcePacketId:'sourcepkt_12345678',revision:1,status:'awaiting-owner',styleRecommendation:recommendation,creativeLanguageDraft:buildVideoCreativeLanguageDraftV1(recommendation),reasons:recommendation.reasons})

describe('pre-Storyboard Creative Direction contracts',()=>{
  it('revises one exact proposal revision without creating Style authority and compiles language only from an explicit Style Lock id',()=>{
    const revised=applyCreativeDirectionChangesV1(proposal,{paletteRoles:{accent:'#21C7A8'},baseTiming:'calm',transitionVocabulary:['cut','fade']})
    expect(revised.revision).toBe(2)
    expect(revised.status).toBe('awaiting-owner')
    expect(revised.ownerApprovalId).toBeUndefined()
    expect(revised.styleRecommendation.visual.paletteRoles.accent).toBe('#21C7A8')
    expect(revised.creativeLanguageDraft.motionRhythm).toBe('calm')
    const language=compileVideoCreativeLanguageV1({styleLockId:'stylelock_abcdef1234567890',proposalRevision:revised.revision,draft:revised.creativeLanguageDraft})
    expect(language.styleLockId).toBe('stylelock_abcdef1234567890')
    expect(language.version).toBe(2)
    expect(language.transitionVocabulary).toEqual(['cut','fade'])
  })

  it('serializes approved content deterministically and changes the canonical content when the approved proposal revision changes',()=>{
    const first=canonicalApprovedStyleContentV1(proposal)
    expect(canonicalApprovedStyleContentV1(proposal)).toBe(first)
    const revised=applyCreativeDirectionChangesV1(proposal,{radius:24})
    expect(canonicalApprovedStyleContentV1(revised)).not.toBe(first)
  })

  it('rejects malformed MCP-style revisions instead of trusting TypeScript-only types',()=>{
    expect(()=>applyCreativeDirectionChangesV1(proposal,{safeArea:.8})).toThrow(/safeArea/u)
    expect(()=>applyCreativeDirectionChangesV1(proposal,{paletteRoles:{accent:'orange'} as never})).toThrow(/six-digit hex/u)
    expect(()=>applyCreativeDirectionChangesV1(proposal,{transitionVocabulary:['cut','cut'] as never})).toThrow(/unique supported transitions/u)
  })
})
