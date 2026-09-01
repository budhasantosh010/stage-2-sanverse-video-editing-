import { describe, expect, it } from 'vitest'
import { createProject, mediaTime, type EditProject } from '@sanverse/edit-domain'
import { createCreativeProductionExternalOrchestrationSessionV1 } from './external-orchestration.ts'

const project = (): EditProject => {
  const projectId='project_7777777777777777'
  const made=createProject({projectId,asset:Object.freeze({schemaVersion:'sanverse.asset/media/v1' as const,mediaKind:'video' as const,assetId:'asset_777777777777',storageRef:`project:${projectId}/source`,sha256:'a'.repeat(64),byteLength:4096,duration:mediaTime(11_520_000),width:1920,height:1080,frameRate:Object.freeze({numerator:30,denominator:1}),hasAudio:true,durationResidualSeconds:0}),compositionId:'composition_777777777777',trackId:'track_777777777777',clipId:'clip_777777777777'})
  if(!made.ok)throw new Error(JSON.stringify(made.error));return made.value
}
const srt=`1\n00:00:00,000 --> 00:00:06,000\nThis plan costs $29 per month and saves time.\n`
const invoke=async(session:Awaited<ReturnType<typeof createCreativeProductionExternalOrchestrationSessionV1>>,id:string,input:unknown={})=>session.registry.invoke(id,input)
const value=<T=any>(result:any):T=>{expect(result.ok,result.refusal?.message).toBe(true);return result.value as T}
const constantText=(node:any):string|null=>node?.type==='text'&&node.text?.kind==='constant'&&typeof node.text.value==='string'?node.text.value:null

describe('general Storyboard authoring MCP surface',()=>{
  it('publishes discriminated canonical schemas and applies $→£ plus shape changes through general graph operations',async()=>{
    const p=project();const session=await createCreativeProductionExternalOrchestrationSessionV1({sessionLabel:'authoring',listProjects:async()=>Object.freeze([{id:p.projectId}]),readProject:async()=>p,importSourceVideo:async()=>{throw new Error('unused')},sha256Text:async(text)=>`sha256:${text.length}`})
    const authoring=value<any>(await invoke(session,'creative.get_storyboard_authoring_schema'))
    expect(authoring.operationTypes).toEqual(expect.arrayContaining(['set-property','set-node-static-property','replace-node','replace-subtree','add-semantic-part']))
    expect(authoring.motionGraphOperationSchema.oneOf.length).toBe(authoring.operationTypes.length)
    value(await invoke(session,'production.select_project',{projectId:p.projectId}))
    const transcript=value<any>(await invoke(session,'source.attach_transcript',{format:'srt',contents:srt,transactionId:'authoring_transcript_0001'}))
    const packet=value<any>(await invoke(session,'source.analyze_video',{transcriptRef:transcript.transcriptRef}))
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
