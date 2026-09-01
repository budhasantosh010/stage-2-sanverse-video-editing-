import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createProject, mediaTime, type EditProject } from '@sanverse/edit-domain'
import type { ToolExecutionContextV1 } from '@sanverse/motion-agent-tools'
import { createCreativeProductionExternalOrchestrationSessionV1 } from './external-orchestration.ts'
import type { CreativeReviewV1, CreativeRunV1 } from './creative-run.ts'
import type { HostApprovalRequestV1 } from './multi-scene-workflow.ts'

const project = (): EditProject => {
  const projectId='project_7777777777777777'
  const made=createProject({projectId,asset:Object.freeze({schemaVersion:'sanverse.asset/media/v1' as const,mediaKind:'video' as const,assetId:'asset_777777777777',storageRef:`project:${projectId}/source`,sha256:'a'.repeat(64),byteLength:4096,duration:mediaTime(11_520_000),width:1920,height:1080,frameRate:Object.freeze({numerator:30,denominator:1}),hasAudio:true,durationResidualSeconds:0}),compositionId:'composition_777777777777',trackId:'track_777777777777',clipId:'clip_777777777777'})
  if(!made.ok)throw new Error(JSON.stringify(made.error));return made.value
}
const srt=`1\n00:00:00,000 --> 00:00:06,000\nThis plan costs $29 per month and saves time.\n`
const invoke=async(session:Awaited<ReturnType<typeof createCreativeProductionExternalOrchestrationSessionV1>>,id:string,input:unknown={},context:ToolExecutionContextV1=Object.freeze({}))=>session.registry.invoke(id,input,context)
const value=<T=any>(result:any):T=>{expect(result.ok,result.refusal?.message).toBe(true);return result.value as T}
const hash=(text:string)=>createHash('sha256').update(text).digest('hex')
const materialize=async({review}:Readonly<{review:CreativeReviewV1}>):Promise<CreativeReviewV1>=>Object.freeze({...review,evidenceHash:hash(`${review.reviewId}:${review.subjectId}:${review.subjectRevision}`),artifacts:Object.freeze([Object.freeze({artifactId:`frame-${review.reviewId}.png`,kind:'image' as const,label:'Review evidence',mimeType:'image/png' as const,byteLength:12,sha256:hash('review-evidence')})])})
const constantText=(node:any):string|null=>node?.type==='text'&&node.text?.kind==='constant'&&typeof node.text.value==='string'?node.text.value:null

describe('general Storyboard authoring MCP surface',()=>{
  it('publishes discriminated canonical schemas and applies $→£ plus shape changes through general graph operations',async()=>{
    const p=project();const runs=new Map<string,CreativeRunV1>();const session=await createCreativeProductionExternalOrchestrationSessionV1({sessionLabel:'authoring',listProjects:async()=>Object.freeze([{id:p.projectId}]),readProject:async()=>p,importSourceVideo:async()=>{throw new Error('unused')},listCreativeRuns:async()=>Object.freeze([...runs.values()]),readCreativeRun:async({runId})=>runs.get(runId)??null,writeCreativeRun:async(run)=>{runs.set(run.runId,structuredClone(run))},materializeReviewEvidence:materialize as never,sha256Text:async(text)=>hash(text),issueOwnerApprovalRef:async(request:HostApprovalRequestV1)=>Object.freeze({approvalRef:`approvalref_${request.requestRef}`}),resolveOwnerApprovalRef:async({approvalRef,request})=>approvalRef===`approvalref_${request.requestRef}`?Object.freeze({schemaVersion:'sanverse.owner-approval/v1' as const,id:`approval:${request.requestRef}`,scope:request.scope,subjectId:request.subjectId,subjectRevision:request.subjectRevision,status:'owner-approved' as const,approvedAt:'2026-09-01T12:00:00.000Z'}):null})
    const authoring=value<any>(await invoke(session,'creative.get_storyboard_authoring_schema'))
    expect(authoring.operationTypes).toEqual(expect.arrayContaining(['set-property','set-node-static-property','replace-node','replace-subtree','add-semantic-part']))
    expect(authoring.motionGraphOperationSchema.oneOf.length).toBe(authoring.operationTypes.length)
    value(await invoke(session,'production.select_project',{projectId:p.projectId}))
    value(await invoke(session,'creative.create_run',{transactionId:'authoring_run_0001'}))
    const transcript=value<any>(await invoke(session,'source.attach_transcript',{format:'srt',contents:srt,transactionId:'authoring_transcript_0001'}))
    const packet=value<any>(await invoke(session,'source.analyze_video',{transcriptRef:transcript.transcriptRef}))
    expect(await invoke(session,'motion.plan_opportunities',{sourcePacketRef:packet.id,targetCount:1})).toMatchObject({ok:false,refusal:{code:'CREATIVE_DIRECTION_APPROVAL_REQUIRED'}})
    const proposed=value<any>(await invoke(session,'creative.propose_direction',{sourcePacketRef:packet.id}))
    const directionReview=proposed.review as CreativeReviewV1
    value(await invoke(session,'creative.decide_review',{reviewId:directionReview.reviewId,decision:'approve'},Object.freeze({hostReviewDecision:Object.freeze({reviewId:directionReview.reviewId,decision:'approve' as const,evidenceHash:directionReview.evidenceHash,subjectId:directionReview.subjectId,subjectRevision:directionReview.subjectRevision,confirmedAt:'2026-09-01T12:00:00.000Z'})})))
    const map=value<any>(await invoke(session,'motion.plan_opportunities',{sourcePacketRef:packet.id,transcriptRef:transcript.transcriptRef,targetCount:1}))
    const batch=value<any>(await invoke(session,'motion.create_scene_batch',{opportunityMapId:map.id,transactionId:'authoring_batch_0001'}))
    const sceneId=batch.scenes[0].sceneId as string
    const before=value<any>(await invoke(session,'creative.inspect_storyboard',{batchId:batch.id,sceneId}))
    const first=before.storyboard.states[0]
    const textNode=Object.values(first.graphState.nodes).find((node:any)=>node.type==='text') as any
    expect(textNode).toBeTruthy()
    const shapeNode=Object.values(first.graphState.nodes).find((node:any)=>node.type==='shape') as any
    expect(shapeNode).toBeTruthy()
    const edited=value<any>(await invoke(session,'creative.apply_storyboard_graph_operations',{batchId:batch.id,sceneId,transactionId:'authoring_graph_0001',expectedSandboxRevision:before.sandboxRevision,targets:{mode:'all-states-containing-node',nodeId:textNode.id},operations:[{operationId:'authoring:text-pound',type:'set-property',target:{nodeId:textNode.id,property:'text.text'},value:{kind:'constant',value:'This plan costs £29 per month and saves time.'}}]}))
    expect(edited.sandboxRevision).toBe(before.sandboxRevision+1)
    expect(edited.affectedStateIds.length).toBeGreaterThan(0)
    expect(edited.affectedNodeIds).toContain(textNode.id)
    const afterText=value<any>(await invoke(session,'creative.inspect_storyboard',{batchId:batch.id,sceneId}))
    for(const state of afterText.storyboard.states.filter((item:any)=>item.graphState.nodes[textNode.id]))expect(constantText(state.graphState.nodes[textNode.id])).toContain('£29')
    const shapeEdited=value<any>(await invoke(session,'creative.apply_storyboard_graph_operations',{batchId:batch.id,sceneId,transactionId:'authoring_graph_0002',expectedSandboxRevision:afterText.sandboxRevision,targets:{mode:'all-states-containing-node',nodeId:shapeNode.id},operations:[{operationId:'authoring:shape-ellipse',type:'set-node-static-property',nodeId:shapeNode.id,change:{property:'shape.shape',value:'ellipse'}}]}))
    expect(shapeEdited.sandboxRevision).toBe(afterText.sandboxRevision+1)
    const afterShape=value<any>(await invoke(session,'creative.inspect_storyboard',{batchId:batch.id,sceneId}))
    for(const state of afterShape.storyboard.states.filter((item:any)=>item.graphState.nodes[shapeNode.id]))expect(state.graphState.nodes[shapeNode.id].shape).toBe('ellipse')
    expect(afterShape.storyboard.revision).toBe(before.storyboard.revision+2)
  })
})
