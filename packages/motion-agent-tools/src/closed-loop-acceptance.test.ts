import { describe,expect,it } from 'vitest'
import { constant,createMotionScene,deriveNodeGraphProjection,nodeBase,projectMotionCurves,projectMotionDopeSheet,projectMotionLayers } from '@sanverse/motion-graph'
import { createStoryboardV1 } from '@sanverse/motion-storyboard'
import { CLOSED_LOOP_TOOL_IDS_V1,createClosedLoopEngineV1,createClosedLoopToolRegistryV1 } from './index.ts'

const baseScene=()=>createMotionScene({componentId:'sanverse.closed-loop-proof',componentVersion:1,rootNodeId:'root',nodes:Object.freeze({root:Object.freeze({...nodeBase('root','Root',null),type:'group' as const,childIds:Object.freeze(['hero'])}),hero:Object.freeze({...nodeBase('hero','Hero','root'),type:'group' as const,childIds:Object.freeze([])})}),semanticParts:Object.freeze([{id:'part:hero',label:'Hero',role:'content-group' as const,nodeIds:Object.freeze(['hero'])}]),exposures:Object.freeze([]),layout:Object.freeze({mode:'responsive' as const,ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9'])})
const storyboard=()=>createStoryboardV1({id:'storyboard:closed-loop',sourceRevision:1,setup:{schemaVersion:'sanverse.storyboard-presentation-setup/v1',sourceRegion:{startTick:0,endTick:1_440_000},communicationGoal:'Explain the hero clearly',presentationMode:'overlay',sourceTreatment:'normal',backgroundTreatment:'source-video',preserveSourceAudio:true,preserveSourceVideo:true,requiredCapabilities:Object.freeze([])},states:Object.freeze([{schemaVersion:'sanverse.key-visual-state/v1',id:'state:a',semanticPurpose:'opening',approximateTick:0,presentationMode:'overlay',sourceTreatment:'normal',backgroundTreatment:'source-video',focusNodeIds:Object.freeze(['hero']),graphState:baseScene()},{schemaVersion:'sanverse.key-visual-state/v1',id:'state:b',semanticPurpose:'payoff',approximateTick:720_000,presentationMode:'overlay',sourceTreatment:'normal',backgroundTreatment:'source-video',focusNodeIds:Object.freeze(['hero']),graphState:baseScene()}]),status:'draft',revision:1})
const approval=(scope:'storyboard'|'animatic'|'motion',subjectId:string,subjectRevision:number,id:string)=>({schemaVersion:'sanverse.owner-approval/v1' as const,id,scope,subjectId,subjectRevision,status:'owner-approved' as const,approvedAt:'2026-08-26T00:00:00.000Z'})
const expectOk=<T extends {ok:boolean}>(value:T)=>expect(value).toMatchObject({ok:true})

describe('Closed-Loop V1 acceptance matrix',()=>{
  it('executes the complete registry-driven loop, refuses forged approval, preserves C3/C4/C5/C6 semantic identity, merges atomically and undoes once',async()=>{
    const original=baseScene()
    const engine=createClosedLoopEngineV1(Object.freeze({id:'project:1',revision:7,scene:original}),{renderMotionReview:(_draft,request)=>Object.freeze({canonicalReviewRef:`review://${request.subjectId}/r${request.subjectRevision}/1x`,posterRef:'frame://poster',criticalFrameRefs:Object.freeze(['frame://critical']),kvsAnchorFrameRefs:Object.freeze(['frame://kvs-a','frame://kvs-b']),entrancePayoffExitFrameRefs:Object.freeze(['frame://enter','frame://payoff','frame://exit']),sourceCompositeFrameRefs:Object.freeze(['frame://source-composite'])})})
    const registry=createClosedLoopToolRegistryV1(engine)
    expect(registry.list().map(tool=>tool.id).sort()).toEqual([...CLOSED_LOOP_TOOL_IDS_V1].sort())
    expect(registry.list().some(tool=>tool.level==='T0')).toBe(true);expect(registry.list().some(tool=>tool.level==='T1')).toBe(true);expect(registry.list().some(tool=>tool.level==='T2')).toBe(true)
    expectOk(await registry.invoke('get_project_context',{}))
    expect(await registry.invoke('revise_storyboard',{},{})).toMatchObject({ok:false,refusal:{code:'SANDBOX_CONTEXT_REQUIRED'}})

    expectOk(await registry.invoke('create_storyboard_sandbox',{sandboxId:'sandbox:1',storyboard:storyboard()}))
    const ctx={sandboxId:'sandbox:1'} as const
    expectOk(await registry.invoke('revise_storyboard',{transactionId:'tx:storyboard:1',expectedSandboxRevision:1,stateId:'state:b',operations:[{operationId:'op:state-b-x',type:'set-property',target:{nodeId:'hero',property:'transform.positionX'},value:constant(.1)}]},ctx))
    expectOk(await registry.invoke('revise_storyboard',{transactionId:'tx:storyboard:baseline',expectedSandboxRevision:2,stateId:'state:a',operations:[{operationId:'op:approved-structure',type:'rename-node',nodeId:'hero',name:'Approved Hero Structure'}]},ctx))
    expectOk(await registry.invoke('validate_storyboard',{availableCapabilities:[],requiredRatio:'16:9'},ctx))
    const storyboardReview=await registry.invoke('request_owner_review',{stage:'storyboard'},ctx);expectOk(storyboardReview);expect(engine.getState().storyboardSandbox?.storyboard.status).toBe('draft')
    expect(await registry.invoke('record_owner_approval',{approval:approval('storyboard','storyboard:closed-loop',999,'approval:forged')},ctx)).toMatchObject({ok:false,refusal:{code:'APPROVAL_REVISION_MISMATCH'}})
    const storyboardRevision=engine.getState().storyboardSandbox!.storyboard.revision
    expectOk(await registry.invoke('record_owner_approval',{approval:approval('storyboard','storyboard:closed-loop',storyboardRevision,'approval:storyboard')},ctx));expect(engine.getState().storyboardSandbox?.storyboard.status).toBe('owner-approved')

    expectOk(await registry.invoke('build_animatic',{id:'animatic:1',timings:[{stateId:'state:a',startTick:0,endTick:720_000},{stateId:'state:b',startTick:720_000,endTick:1_440_000}],sourceAudioRef:{sourceId:'source:1'}},ctx))
    expectOk(await registry.invoke('revise_animatic',{transactionId:'tx:animatic:1',expectedRevision:1,operations:[{type:'animatic.set-state-timing',stateId:'state:b',startTick:720_000,endTick:1_440_000}]},ctx))
    expectOk(await registry.invoke('validate_animatic',{minimumReadableHoldTicks:100_000,sourceRegion:{startTick:0,endTick:1_440_000},ticksPerSecond:1_440_000},ctx))
    const animaticRevision=engine.getState().animatic!.revision
    expectOk(await registry.invoke('record_owner_approval',{approval:approval('animatic','animatic:1',animaticRevision,'approval:animatic')},ctx));expect(engine.getState().animatic?.status).toBe('owner-approved')

    expectOk(await registry.invoke('build_motion_plan',{id:'motion-plan:1'},ctx))
    expectOk(await registry.invoke('revise_motion',{action:'build',id:'motion-draft:1'},ctx))
    expect(engine.getState().motionDraft?.scene.nodes.hero?.name).toBe('Approved Hero Structure')
    expectOk(await registry.invoke('validate_motion',{durationTicks:1_440_000,ticksPerSecond:1_440_000,composition:{width:1920,height:1080,fpsNumerator:30,fpsDenominator:1},sampleTicks:[0,360_000,720_000,1_080_000,1_440_000],expectedSemanticNodeIds:['root','hero'],requiredCapabilities:[],availableCapabilities:[]},ctx))
    const motionRevision=engine.getState().motionDraft!.revision
    expectOk(await registry.invoke('render_review',{stage:'motion',subjectId:'motion-draft:1',subjectRevision:motionRevision,startTick:0,endTick:1_440_000,criticalTicks:[0,720_000,1_440_000]},ctx))
    expectOk(await registry.invoke('set_visual_findings',{findings:[]},ctx))
    const motionReview=await registry.invoke('request_owner_review',{stage:'motion'},ctx);expectOk(motionReview);if(motionReview.ok)expect(motionReview.value).toMatchObject({subjectRevision:motionRevision,qaPassed:true,evidence:{canonicalReviewRef:'review://motion-draft:1/r1/1x'}})
    expect(await registry.invoke('record_owner_approval',{approval:approval('motion','motion-draft:1',motionRevision+1,'approval:forged-motion')},ctx)).toMatchObject({ok:false,refusal:{code:'APPROVAL_REVISION_MISMATCH'}})
    expect(engine.getState().motionDraft?.status).toBe('draft')
    expectOk(await registry.invoke('record_owner_approval',{approval:approval('motion','motion-draft:1',motionRevision,'approval:motion')},ctx));expect(engine.getState().motionDraft?.status).toBe('owner-approved')

    const merged=await registry.invoke('apply_approved_sandbox',{},ctx);expectOk(merged);expect(engine.getState().acceptedProject.revision).toBe(8)
    const scene=engine.getState().acceptedProject.scene
    expect(projectMotionLayers({scene}).layersById.hero?.nodeId).toBe('hero')
    expect(projectMotionDopeSheet(scene).layers.some(layer=>layer.nodeId==='hero'&&layer.tracks.length>0)).toBe(true)
    expect(projectMotionCurves(scene).tracks.some(track=>track.nodeId==='hero')).toBe(true)
    expect(deriveNodeGraphProjection(scene).nodes.some(node=>node.nodeId==='hero')).toBe(true)
    expect(JSON.stringify(scene)).not.toBe(JSON.stringify(original))

    const undone=await registry.invoke('undo_last_creative_merge',{});expectOk(undone);expect(engine.getState().acceptedProject.revision).toBe(9);expect(engine.getState().acceptedProject.scene).toEqual(original)
  })
})
