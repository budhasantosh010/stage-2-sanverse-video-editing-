import { describe, expect, it } from 'vitest'
import { constant, createMotionScene, nodeBase } from '@sanverse/motion-graph'
import { createStoryboardV1, type KeyVisualStateV1, type OwnerApprovalV1 } from './contracts.ts'
import { createStoryboardSandboxV1, applyStoryboardSandboxTransactionV1 } from './sandbox.ts'
import { applyStoryboardDesignTransactionV1, applyStoryboardGraphOperationsV1, approveStoryboardSandboxV1, inspectStoryboardTransitionV1, refineStoryboardTransitionV1, reopenStoryboardSandboxV1, reviseStoryboardStateGraphV1, runStoryboardStructuralQaV1 } from './iteration.ts'

const scene = () => createMotionScene({
  componentId: 'sanverse.storyboard-iteration-proof', componentVersion: 1, rootNodeId: 'root', supportedAspectRatios: ['16:9'], semanticParts: Object.freeze([{ id: 'hero', label: 'Hero', role: 'content-group' as const, nodeIds: Object.freeze(['hero']) }]), exposures: Object.freeze([]),
  layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }),
  nodes: Object.freeze({
    root: Object.freeze({ ...nodeBase('root','Root',null), type: 'group' as const, childIds: Object.freeze(['hero']) }),
    hero: Object.freeze({ ...nodeBase('hero','Hero','root'), type: 'group' as const, childIds: Object.freeze([]), opacity: constant(1) }),
  }),
})
const state = (id: string, tick: number): KeyVisualStateV1 => Object.freeze({ schemaVersion:'sanverse.key-visual-state/v1', id, semanticPurpose: id.endsWith('a') ? 'opening' : 'payoff', approximateTick:tick, presentationMode:'overlay', sourceTreatment:'normal', backgroundTreatment:'source-video', focusNodeIds:Object.freeze(['hero']), graphState:scene(), sourceFrameRef:Object.freeze({schemaVersion:'sanverse.source-frame-reference/v1',sourceId:'source:1',exactTick:tick,assetRef:'asset:source-1'}) })
const storyboard = () => createStoryboardV1({ id:'storyboard:iteration', sourceRevision:7, setup:{schemaVersion:'sanverse.storyboard-presentation-setup/v1',sourceRegion:{startTick:0,endTick:2_880_000},communicationGoal:'Explain one change',presentationMode:'overlay',sourceTreatment:'normal',backgroundTreatment:'source-video',preserveSourceAudio:true,preserveSourceVideo:true,requiredCapabilities:Object.freeze([])}, states:Object.freeze([state('state:a',0),state('state:b',2_000_000)]), status:'draft', revision:1 })

const qa = (value = storyboard()) => runStoryboardStructuralQaV1(value,{availableCapabilities:Object.freeze([]),availableSourceIds:Object.freeze(['source:1']),availableAssetRefs:Object.freeze(['asset:source-1']),requiredRatio:'16:9',compositionBounds:{width:1920,height:1080}})

describe('Batch 3 Storyboard Iteration V1', () => {
  it('targets exact semantic nodes through canonical graph operations and returns one reversible sandbox transaction', () => {
    const sandbox = createStoryboardSandboxV1('sandbox:iteration',7,storyboard())
    const edited = reviseStoryboardStateGraphV1(sandbox,{transactionId:'tx:rename',expectedSandboxRevision:1,stateId:'state:a',operations:Object.freeze([{operationId:'op:rename',type:'rename-node' as const,nodeId:'hero',name:'Exact Hero'}])})
    expect(edited.ok).toBe(true)
    if(!edited.ok)return
    expect(edited.value.sandbox.storyboard.states[0]?.graphState.nodes.hero?.name).toBe('Exact Hero')
    const undone = applyStoryboardSandboxTransactionV1(edited.value.sandbox,edited.value.inverse)
    expect(undone.ok).toBe(true)
    if(!undone.ok)return
    expect(undone.value.sandbox.storyboard.states[0]?.graphState.nodes.hero?.name).toBe('Hero')
  })

  it('inspects then refines one transition by inserting exactly one KVS between existing states', () => {
    const sandbox = createStoryboardSandboxV1('sandbox:iteration',7,storyboard())
    const inspection = inspectStoryboardTransitionV1(sandbox.storyboard,'state:a','state:b')
    expect(inspection.ok).toBe(true)
    const refined = refineStoryboardTransitionV1(sandbox,{transactionId:'tx:refine',expectedSandboxRevision:1,fromStateId:'state:a',toStateId:'state:b',stateId:'state:mid',approximateTick:1_000_000,operations:Object.freeze([{operationId:'op:mid',type:'rename-node' as const,nodeId:'hero',name:'Middle Hero'}])})
    expect(refined.ok).toBe(true)
    if(!refined.ok)return
    expect(refined.value.sandbox.storyboard.states.map((item)=>item.id)).toEqual(['state:a','state:mid','state:b'])
    expect(refined.value.sandbox.storyboard.states[1]?.graphState.nodes.hero?.name).toBe('Middle Hero')
  })

  it('applies one canonical graph batch across every KVS containing a semantic node with one Storyboard/sandbox revision', () => {
    const sandbox=createStoryboardSandboxV1('sandbox:iteration',7,storyboard())
    const result=applyStoryboardGraphOperationsV1(sandbox,{transactionId:'tx:all-states',expectedSandboxRevision:1,targets:{mode:'all-states-containing-node',nodeId:'hero'},operations:Object.freeze([{operationId:'op:hero-name',type:'rename-node' as const,nodeId:'hero',name:'Approved Hero'}])})
    expect(result.ok).toBe(true)
    if(!result.ok)return
    expect(result.value.sandbox.sandboxRevision).toBe(2)
    expect(result.value.sandbox.storyboard.revision).toBe(2)
    expect(result.value.sandbox.storyboard.states.map((item)=>item.graphState.nodes.hero?.name)).toEqual(['Approved Hero','Approved Hero'])
    expect(result.value.sandbox.transactions.at(-1)?.operationTypes).toEqual(['replace-state','replace-state'])
  })

  it('combines graph and setup/state edits into one atomic design transaction', () => {
    const sandbox=createStoryboardSandboxV1('sandbox:iteration',7,storyboard())
    const setup={...sandbox.storyboard.setup,backgroundTreatment:'graphical' as const}
    const result=applyStoryboardDesignTransactionV1(sandbox,{transactionId:'tx:design',expectedSandboxRevision:1,graphEdits:Object.freeze([{stateId:'state:a',operations:Object.freeze([{operationId:'op:design-name',type:'rename-node' as const,nodeId:'hero',name:'Designed Hero'}])}]),sandboxOperations:Object.freeze([{type:'set-setup' as const,setup}])})
    expect(result.ok).toBe(true)
    if(!result.ok)return
    expect(result.value.sandbox.sandboxRevision).toBe(2)
    expect(result.value.sandbox.storyboard.revision).toBe(2)
    expect(result.value.sandbox.storyboard.states[0]?.graphState.nodes.hero?.name).toBe('Designed Hero')
    expect(result.value.sandbox.storyboard.setup.backgroundTreatment).toBe('graphical')
  })

  it('runs deterministic structural QA and refuses missing media/capabilities rather than machine-approving', () => {
    expect(qa()).toEqual({ok:true,findings:[]})
    const base=storyboard(); const broken=createStoryboardV1({...base,states:Object.freeze([{...base.states[0]!,presentationMode:'tracked-attached' as const},base.states[1]!]),revision:2})
    const report=runStoryboardStructuralQaV1(broken,{availableCapabilities:Object.freeze([]),availableSourceIds:Object.freeze([]),availableAssetRefs:Object.freeze([]),requiredRatio:'16:9'})
    expect(report.ok).toBe(false)
    expect(report.findings.some((item)=>item.code==='UNSUPPORTED_PRESENTATION_CAPABILITY')).toBe(true)
    expect(report.findings.some((item)=>item.code==='MISSING_MEDIA')).toBe(true)
  })

  it('requires explicit exact-revision owner approval, locks it, and invalidates approval by creating a new revision before later edits', () => {
    const sandbox=createStoryboardSandboxV1('sandbox:iteration',7,storyboard())
    const approval:OwnerApprovalV1=Object.freeze({schemaVersion:'sanverse.owner-approval/v1',id:'approval:storyboard:1',scope:'storyboard',subjectId:sandbox.storyboard.id,subjectRevision:sandbox.storyboard.revision,status:'owner-approved',approvedAt:'2026-08-26T07:00:00.000Z'})
    const approved=approveStoryboardSandboxV1(sandbox,approval,qa(sandbox.storyboard))
    expect(approved.ok).toBe(true)
    if(!approved.ok)return
    expect(approved.value.locks.storyboard).toBe(true)
    expect(approved.value.storyboard.ownerApprovalId).toBe(approval.id)
    const blocked=reviseStoryboardStateGraphV1(approved.value,{transactionId:'tx:blocked',expectedSandboxRevision:approved.revision,stateId:'state:a',operations:Object.freeze([{operationId:'op:x',type:'rename-node' as const,nodeId:'hero',name:'Should Refuse'}])})
    expect(blocked).toMatchObject({ok:false,refusal:{code:'STORYBOARD_LOCKED'}})
    const reopened=reopenStoryboardSandboxV1(approved.value,approved.revision)
    expect(reopened.ok).toBe(true)
    if(!reopened.ok)return
    expect(reopened.value.storyboard.revision).toBe(sandbox.storyboard.revision+1)
    expect(reopened.value.storyboard.ownerApprovalId).toBeUndefined()
    expect(reopened.value.approvals).toHaveLength(0)
  })
})
