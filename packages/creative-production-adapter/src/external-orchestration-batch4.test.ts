import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { acceptChangeSetAtomic, createProject, redoChangeSet, undoChangeSet, type ChangeSet, type EditProject } from '@sanverse/edit-domain'
import { mediaTime } from '@sanverse/edit-domain/time'
import { createCreativeProductionExternalOrchestrationSessionV1, type ExternalCreativeArtifactRefV1 } from './external-orchestration.ts'
import { canonicalCreativeArtifactJsonV1, type CreativeSceneArtifactV1 } from './creative-artifact.ts'

const baseProject = (): EditProject => {
  const projectId = 'project_1234567890abcdef'
  const made = createProject({
    projectId,
    asset: Object.freeze({ schemaVersion:'sanverse.asset/media/v1' as const, mediaKind:'video' as const, assetId:'asset_1234567890ab', storageRef:`project:${projectId}/source`, sha256:'a'.repeat(64), byteLength:4096, duration:mediaTime(28_800_000), width:1920, height:1080, frameRate:Object.freeze({numerator:30,denominator:1}), hasAudio:true, durationResidualSeconds:0 }),
    compositionId:'composition_1234567890ab', trackId:'track_1234567890ab', clipId:'clip_1234567890ab',
  })
  if (!made.ok) throw new Error(JSON.stringify(made.error))
  return made.value
}

const sha256 = async (text: string) => createHash('sha256').update(text).digest('hex')
const invoke = async (session: Awaited<ReturnType<typeof createCreativeProductionExternalOrchestrationSessionV1>>, id: string, input: unknown = {}) => session.registry.invoke(id, input)

const approval = (request: Readonly<{ requestRef:string; scope:'storyboard'|'animatic'|'motion'; subjectId:string; subjectRevision:number }>) => Object.freeze({
  schemaVersion:'sanverse.owner-approval/v1' as const,
  id:`approval:${request.requestRef}`,
  scope:request.scope,
  subjectId:request.subjectId,
  subjectRevision:request.subjectRevision,
  status:'owner-approved' as const,
  approvedAt:'2026-08-29T14:00:00.000Z',
})

describe('raw-video external orchestration — immutable artifact + atomic production apply', () => {
  it('stages approved artifacts, accepts three scenes in one ChangeSet, deduplicates retry, and one Undo/Redo removes/restores all', async () => {
    let current = baseProject()
    const artifactShelf = new Map<string, Readonly<{ ref: ExternalCreativeArtifactRefV1; artifact: unknown; serialized: string }>>()
    const session = await createCreativeProductionExternalOrchestrationSessionV1({
      sessionLabel:'batch4-atomic',
      listProjects:async()=>Object.freeze([{id:current.projectId}]),
      readProject:async()=>current,
      importSourceVideo:async()=>{throw new Error('unused')},
      sha256Text:sha256,
      resolveOwnerApprovalRef:async ({approvalRef,request}) => approvalRef === `approvalref_${request.requestRef}` ? approval(request) : null,
      putCreativeArtifact:async ({serialized}) => {
        const digest = await sha256(serialized)
        const artifactId = `creativeart_${digest}`
        const existing = artifactShelf.get(artifactId)
        if (existing) return Object.freeze({ref:existing.ref,artifact:existing.artifact})
        const artifact = JSON.parse(serialized)
        const ref = Object.freeze({artifactId,sha256:digest,byteLength:Buffer.byteLength(serialized,'utf8')})
        artifactShelf.set(artifactId,Object.freeze({ref,artifact,serialized}))
        return Object.freeze({ref,artifact})
      },
      readCreativeArtifact:async ({artifactId}) => {
        const item = artifactShelf.get(artifactId); if(!item) throw new Error('not found')
        return Object.freeze({ref:item.ref,artifact:item.artifact})
      },
      acceptChangeSet:async ({changeSet}) => {
        const applied = acceptChangeSetAtomic(current,changeSet)
        if(applied.status!=='accepted') throw new Error(JSON.stringify(applied.refusal))
        current = applied.project
        return current
      },
      undoProject:async()=>{const result=undoChangeSet(current);if(!result.ok)throw new Error(JSON.stringify(result.error));current=result.value;return current},
      redoProject:async()=>{const result=redoChangeSet(current);if(!result.ok)throw new Error(JSON.stringify(result.error));current=result.value;return current},
    })

    expect((await invoke(session,'production.select_project',{projectId:current.projectId})).ok).toBe(true)
    const transcript = await invoke(session,'source.attach_transcript',{format:'plain',contents:'Revenue grew 82 percent. Compare both options. Then explain the final takeaway.',transactionId:'transcript_txn_batch4'}) as any
    const analyzed = await invoke(session,'source.analyze_video',{transcriptRef:transcript.value.transcriptRef}) as any
    const planned = await invoke(session,'motion.plan_opportunities',{sourcePacketRef:analyzed.value.id,transcriptRef:transcript.value.transcriptRef,targetCount:3}) as any
    const created = await invoke(session,'motion.create_scene_batch',{opportunityMapId:planned.value.id,transactionId:'scene_batch_txn_004'}) as any
    const batchId = created.value.id as string

    for (const scope of ['storyboard','animatic','motion'] as const) {
      if (scope === 'animatic') expect((await invoke(session,'motion.advance_scene_batch',{batchId,action:'advance',scope:'animatic'})).ok).toBe(true)
      if (scope === 'motion') expect((await invoke(session,'motion.advance_scene_batch',{batchId,action:'advance',scope:'motion'})).ok).toBe(true)
      const review = await invoke(session,'motion.advance_scene_batch',{batchId,action:'request-review',scope}) as any
      expect(review.ok).toBe(true)
      const requests = review.value.reviewRequests as Array<{requestRef:string}>
      expect(requests).toHaveLength(3)
      for (const request of requests) {
        const resolved = await invoke(session,'motion.advance_scene_batch',{batchId,action:'resolve-approval',requestRef:request.requestRef,approvalRef:`approvalref_${request.requestRef}`})
        expect(resolved).toMatchObject({ok:true,value:{approved:true}})
      }
    }

    const beforeApply = current
    const applied = await invoke(session,'production.apply_approved_scene_batch',{batchId,transactionId:'apply_batch_txn_0004'}) as any
    expect(applied).toMatchObject({ok:true,value:{batchId,projectRevision:beforeApply.revision+1,previouslyUsed:false,alreadyApplied:true}})
    expect(current.revision).toBe(beforeApply.revision+1)
    expect(current.changeSets).toHaveLength(1)
    expect(current.changeSets[0]!.changeSet.operations).toHaveLength(3)
    expect(current.changeSets[0]!.changeSet.operations.every((item)=>item.kind==='add-creative-scene')).toBe(true)
    expect(artifactShelf.size).toBe(3)
    for (const item of artifactShelf.values()) {
      expect(item.ref.artifactId).toBe(`creativeart_${item.ref.sha256}`)
      expect(item.serialized).toBe(canonicalCreativeArtifactJsonV1(item.artifact as CreativeSceneArtifactV1))
      expect((item.artifact as any).motion.scene.schemaVersion).toBe('sanverse.motion-scene/v1')
    }

    const retried = await invoke(session,'production.apply_approved_scene_batch',{batchId,transactionId:'apply_batch_txn_0004'}) as any
    expect(retried).toMatchObject({ok:true,value:{previouslyUsed:true,alreadyApplied:true,changeSetId:applied.value.changeSetId}})
    expect(current.changeSets).toHaveLength(1)

    const undone = await (async()=>{const r=undoChangeSet(current);if(!r.ok)throw new Error();current=r.value;return current})()
    expect(undone.changeSets).toHaveLength(0)
    expect(artifactShelf.size).toBe(3)
    const redone = await (async()=>{const r=redoChangeSet(current);if(!r.ok)throw new Error();current=r.value;return current})()
    expect(redone.changeSets).toHaveLength(1)
    expect(redone.changeSets[0]!.changeSet.operations).toHaveLength(3)
  })

  it('leaves accepted project unchanged when artifact staging fails before the one ChangeSet', async () => {
    let current=baseProject()
    const session=await createCreativeProductionExternalOrchestrationSessionV1({sessionLabel:'batch4-fail',listProjects:async()=>[{id:current.projectId}],readProject:async()=>current,importSourceVideo:async()=>{throw new Error('unused')},sha256Text:sha256,putCreativeArtifact:async()=>{throw new Error('disk failure')},acceptChangeSet:async({changeSet}:{projectId:string;changeSet:ChangeSet})=>{const r=acceptChangeSetAtomic(current,changeSet);if(r.status!=='accepted')throw new Error();current=r.project;return current}})
    expect(session.registry.list().some((item)=>item.id==='production.apply_approved_scene_batch')).toBe(true)
    expect(current.changeSets).toHaveLength(0)
  })
})
