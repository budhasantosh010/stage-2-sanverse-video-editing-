import { describe,expect,it } from 'vitest'
import { createPromotionCandidateV1,createPromotionWorkspaceV1,applyPromotionTransactionV1,discardPromotionWorkspaceV1,parsePromotionCandidateV1,serializePromotionCandidateV1 } from './contracts.ts'
import { promotionSource } from './test-fixtures.ts'

describe('Promotion V1 contracts and isolation',()=>{
  it('creates a promotion candidate only from the exact approved, QA-passed, visually evidenced source revision',()=>{
    const result=createPromotionCandidateV1(promotionSource(),['scene','motion-recipe'],'candidate:project-a')
    expect(result).toMatchObject({ok:true,value:{schemaVersion:'sanverse.promotion-candidate/v1',sourceProjectId:'project:a',sourceSceneId:'motion-draft:project-a',sourceSceneRevision:1,sourceOwnerApprovalId:'approval:motion:r1',requestedTargetKinds:['scene','motion-recipe'],status:'draft',revision:1,origin:'generated',reuseStatus:'promotion-candidate'}})
  })

  it('refuses unapproved, stale, failed-QA, incomplete-evidence and invalid-graph sources with typed promotion codes',()=>{
    expect(createPromotionCandidateV1(promotionSource({motionApproval:undefined as never}),['scene'],'c')).toMatchObject({ok:false,refusal:{code:'PROMOTION_SOURCE_NOT_APPROVED'}})
    expect(createPromotionCandidateV1(promotionSource({sourceSceneRevision:2}),['scene'],'c')).toMatchObject({ok:false,refusal:{code:'PROMOTION_SOURCE_APPROVAL_STALE'}})
    expect(createPromotionCandidateV1(promotionSource({structuralQaPassed:false}),['scene'],'c')).toMatchObject({ok:false,refusal:{code:'PROMOTION_SOURCE_QA_FAILED'}})
    expect(createPromotionCandidateV1(promotionSource({visualReviewEvidence:{canonicalReviewRef:'',posterRef:'',criticalFrameRefs:[]}}),['scene'],'c')).toMatchObject({ok:false,refusal:{code:'PROMOTION_SOURCE_VISUAL_EVIDENCE_REQUIRED'}})
    const source=promotionSource();const invalid={...source,scene:{...source.scene,rootNodeId:'missing'}} as never
    expect(createPromotionCandidateV1(invalid,['scene'],'c')).toMatchObject({ok:false,refusal:{code:'PROMOTION_SOURCE_GRAPH_INVALID'}})
  })

  it('runs atomic stale-safe idempotent reversible promotion-workspace transactions without mutating source',()=>{
    const source=promotionSource();const candidate=createPromotionCandidateV1(source,['scene','motion-recipe'],'candidate:a');if(!candidate.ok)throw new Error('candidate')
    const workspace=createPromotionWorkspaceV1('promotion-workspace:a',candidate.value)
    const before=JSON.stringify(source.scene)
    const applied=applyPromotionTransactionV1(workspace,{schemaVersion:'sanverse.promotion-transaction/v1',id:'tx:1',idempotencyKey:'idem:1',baseRevision:1,operations:[{type:'promotion.set-target-kind',targetKind:'scene'},{type:'promotion.set-status',status:'review'}]})
    expect(applied).toMatchObject({ok:true,value:{workspace:{revision:2,targetKind:'scene',status:'review'}}})
    if(!applied.ok)throw new Error('apply')
    const duplicate=applyPromotionTransactionV1(applied.value.workspace,{schemaVersion:'sanverse.promotion-transaction/v1',id:'tx:retry',idempotencyKey:'idem:1',baseRevision:1,operations:[{type:'promotion.set-status',status:'validated'}]})
    expect(duplicate).toMatchObject({ok:true,revision:2,value:{workspace:{revision:2,status:'review'}}})
    expect(applyPromotionTransactionV1(applied.value.workspace,{schemaVersion:'sanverse.promotion-transaction/v1',id:'tx:stale',idempotencyKey:'idem:2',baseRevision:1,operations:[{type:'promotion.set-status',status:'validated'}]})).toMatchObject({ok:false,refusal:{code:'STALE_PROMOTION_REVISION'}})
    expect(applied.value.inverseWorkspace).toEqual(workspace)
    expect(discardPromotionWorkspaceV1(source,applied.value.workspace)).toEqual(source.scene)
    expect(JSON.stringify(source.scene)).toBe(before)
  })

  it('round-trips the persistent candidate contract and refuses unsupported versions',()=>{
    const created=createPromotionCandidateV1(promotionSource(),['scene'],'candidate:a');if(!created.ok)throw new Error('candidate')
    const json=serializePromotionCandidateV1(created.value)
    expect(parsePromotionCandidateV1(json)).toEqual({ok:true,value:created.value})
    expect(parsePromotionCandidateV1(JSON.stringify({...created.value,schemaVersion:'sanverse.promotion-candidate/v2'}))).toMatchObject({ok:false,refusal:{code:'UNSUPPORTED_PROMOTION_CANDIDATE_VERSION'}})
  })
})
