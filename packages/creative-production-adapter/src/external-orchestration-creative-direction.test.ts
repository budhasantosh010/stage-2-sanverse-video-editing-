import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createProject, mediaTime, type EditProject } from '@sanverse/edit-domain'
import type { ToolExecutionContextV1 } from '@sanverse/motion-agent-tools'
import { canonicalApprovedStyleContentV1 } from '@sanverse/creative-direction'
import { createCreativeProductionExternalOrchestrationSessionV1 } from './external-orchestration.ts'
import type { CreativeReviewV1, CreativeRunV1 } from './creative-run.ts'
import type { HostApprovalRequestV1 } from './multi-scene-workflow.ts'

const hash=(text:string)=>createHash('sha256').update(text).digest('hex')
const project=():EditProject=>{const projectId='project_5555555555555555';const made=createProject({projectId,asset:Object.freeze({schemaVersion:'sanverse.asset/media/v1' as const,mediaKind:'video' as const,assetId:'asset_555555555555',storageRef:`project:${projectId}/source`,sha256:'5'.repeat(64),byteLength:4096,duration:mediaTime(8_640_000),width:1920,height:1080,frameRate:Object.freeze({numerator:30,denominator:1}),hasAudio:true,durationResidualSeconds:0}),compositionId:'composition_555555555555',trackId:'track_555555555555',clipId:'clip_555555555555'});if(!made.ok)throw new Error(JSON.stringify(made.error));return made.value}
const materialize=async({review}:Readonly<{review:CreativeReviewV1}>):Promise<CreativeReviewV1>=>Object.freeze({...review,evidenceHash:hash(`${review.reviewId}:${review.subjectId}:${review.subjectRevision}:${JSON.stringify(review.context)}`),artifacts:Object.freeze([Object.freeze({artifactId:`frame-${review.reviewId}.png`,kind:'image' as const,label:review.scope==='creative-direction'?'Creative Direction Board':'Scene review',mimeType:'image/png' as const,byteLength:20,sha256:hash(`artifact:${review.reviewId}`)})])})
const invoke=async(session:Awaited<ReturnType<typeof createCreativeProductionExternalOrchestrationSessionV1>>,id:string,input:unknown={},context:ToolExecutionContextV1=Object.freeze({}))=>session.registry.invoke(id,input,context)
const ok=<T=any>(result:any):T=>{expect(result.ok,result.refusal?.message).toBe(true);return result.value as T}
const hostContext=(review:CreativeReviewV1,decision:'approve'|'revise'|'reject',confirmedAt='2026-09-01T13:00:00.000Z'):ToolExecutionContextV1=>Object.freeze({hostReviewDecision:Object.freeze({reviewId:review.reviewId,decision,evidenceHash:review.evidenceHash,subjectId:review.subjectId,subjectRevision:review.subjectRevision,confirmedAt})})

describe('Pre-Storyboard Creative Direction + Approved Style Lock gate',()=>{
  it('blocks planning before exact approval, rejects stale evidence, derives Style Lock from approved content, and invalidates downstream state on reopen',async()=>{
    const current=project();const runs=new Map<string,CreativeRunV1>()
    const session=await createCreativeProductionExternalOrchestrationSessionV1({sessionLabel:'direction-gate',listProjects:async()=>Object.freeze([{id:current.projectId}]),readProject:async()=>current,importSourceVideo:async()=>{throw new Error('unused')},listCreativeRuns:async()=>Object.freeze([...runs.values()]),readCreativeRun:async({runId})=>runs.get(runId)??null,writeCreativeRun:async(run)=>{runs.set(run.runId,structuredClone(run))},materializeReviewEvidence:materialize as never,sha256Text:async(text)=>hash(text),issueOwnerApprovalRef:async(request:HostApprovalRequestV1)=>Object.freeze({approvalRef:`approvalref_${request.requestRef}`}),resolveOwnerApprovalRef:async({approvalRef,request})=>approvalRef===`approvalref_${request.requestRef}`?Object.freeze({schemaVersion:'sanverse.owner-approval/v1' as const,id:`approval:${request.requestRef}`,scope:request.scope,subjectId:request.subjectId,subjectRevision:request.subjectRevision,status:'owner-approved' as const,approvedAt:'2026-09-01T13:00:00.000Z'}):null})

    ok(await invoke(session,'production.select_project',{projectId:current.projectId}))
    const created=ok<any>(await invoke(session,'creative.create_run',{transactionId:'direction_gate_run_001'}));const runId=created.runId as string
    const transcript=ok<any>(await invoke(session,'source.attach_transcript',{format:'plain',contents:'Revenue is 82 percent higher. Compare the two plans and explain the takeaway.',transactionId:'direction_gate_transcript_001'}))
    const packet=ok<any>(await invoke(session,'source.analyze_video',{transcriptRef:transcript.transcriptRef}))
    expect(runs.get(runId)?.stage).toBe('creative-direction')
    expect(await invoke(session,'motion.plan_opportunities',{sourcePacketRef:packet.id,maxCount:2})).toMatchObject({ok:false,refusal:{code:'CREATIVE_DIRECTION_APPROVAL_REQUIRED'}})

    const proposed=ok<any>(await invoke(session,'creative.propose_direction',{sourcePacketRef:packet.id,brandContext:{ownerBrief:'Clean editorial graphics. Keep the speaker readable.',palette:['#101318','#35D0BA','#FFFFFF'],typeFamilies:['Inter'],traits:['clean','editorial']}}))
    const firstReview=proposed.review as CreativeReviewV1
    expect(firstReview).toMatchObject({scope:'creative-direction',status:'pending',context:{kind:'creative-direction',revision:1}})
    expect(firstReview.sceneId).toBeUndefined()
    expect(firstReview.artifacts[0]?.label).toBe('Creative Direction Board')

    const revised=ok<any>(await invoke(session,'creative.revise_direction',{proposalId:proposed.proposal.proposalId,expectedRevision:1,changes:{paletteRoles:{accent:'#8B5CF6'},baseTiming:'calm'},reason:'Use the approved purple accent and calmer rhythm.'}))
    const secondReview=revised.review as CreativeReviewV1
    expect(secondReview.subjectRevision).toBe(2)
    expect(await invoke(session,'creative.decide_review',{reviewId:firstReview.reviewId,decision:'approve'},hostContext(firstReview,'approve'))).toMatchObject({ok:false,refusal:{code:'CREATIVE_DIRECTION_STALE'}})
    expect(await invoke(session,'motion.plan_opportunities',{sourcePacketRef:packet.id,maxCount:2})).toMatchObject({ok:false,refusal:{code:'CREATIVE_DIRECTION_APPROVAL_REQUIRED'}})

    const approved=ok<any>(await invoke(session,'creative.decide_review',{reviewId:secondReview.reviewId,decision:'approve'},hostContext(secondReview,'approve')))
    const lock=approved.approvedStyleLock
    expect(lock).toMatchObject({locked:true,proposalRevision:2,proposalId:revised.proposal.proposalId,projectId:current.projectId,sourcePacketId:packet.id})
    expect(lock.contentHash).toBe(hash(canonicalApprovedStyleContentV1(revised.proposal)))
    expect(lock.styleLockId).toBe(`stylelock_${lock.contentHash.slice(0,16)}`)
    expect(lock.creativeLanguage.styleLockId).toBe(lock.styleLockId)

    const map=ok<any>(await invoke(session,'motion.plan_opportunities',{sourcePacketRef:packet.id,maxCount:2}))
    expect(map.styleLockRef).toEqual({styleLockId:lock.styleLockId,proposalId:lock.proposalId,proposalRevision:2,contentHash:lock.contentHash})
    const batch=ok<any>(await invoke(session,'motion.create_scene_batch',{opportunityMapId:map.id,transactionId:'direction_gate_batch_001'}))
    expect(batch.scenes.length).toBeGreaterThan(0)
    const beforeRevision=current.revision

    const reopened=ok<any>(await invoke(session,'creative.reopen_direction',{proposalId:lock.proposalId,expectedRevision:2}))
    expect(reopened.proposal).toMatchObject({revision:3,status:'awaiting-owner'})
    expect(reopened.invalidated).toEqual(expect.arrayContaining(['opportunity-map','storyboard','animatic','motion']))
    const run=ok<any>(await invoke(session,'creative.get_run',{runId}))
    expect(run).toMatchObject({stage:'creative-direction-review',sceneIds:[]})
    expect(run.approvedStyleLock).toBeUndefined()
    expect(run.opportunityMap).toBeUndefined()
    expect(run.sceneBatch).toBeUndefined()
    expect(await invoke(session,'motion.get_opportunity_map',{opportunityMapId:map.id})).toMatchObject({ok:false,refusal:{code:'OPPORTUNITY_MAP_STALE'}})
    expect(await invoke(session,'motion.create_scene_batch',{opportunityMapId:map.id,transactionId:'direction_gate_batch_stale'})).toMatchObject({ok:false,refusal:{code:'CREATIVE_DIRECTION_APPROVAL_REQUIRED'}})
    expect(current.revision).toBe(beforeRevision)
  })
})
