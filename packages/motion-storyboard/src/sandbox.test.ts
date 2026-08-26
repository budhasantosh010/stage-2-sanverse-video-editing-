import { describe, expect, it } from 'vitest'
import { constant, createMotionScene, nodeBase } from '@sanverse/motion-graph'
import type { MotionSceneV1 } from '@sanverse/motion-graph'
import { createStoryboardV1, type KeyVisualStateV1, type StoryboardV1 } from './contracts.ts'
import { applyStoryboardSandboxTransactionV1, createStoryboardSandboxV1, findStoryboardStateAtTickV1, type StoryboardSandboxOperationV1 } from './sandbox.ts'

const scene = (suffix='a'): MotionSceneV1 => createMotionScene({ componentId: `sanverse.story-${suffix}`, componentVersion: 1, rootNodeId: `root:${suffix}`, nodes: { [`root:${suffix}`]: { ...nodeBase(`root:${suffix}`,'Root',null), type:'group', childIds:[`title:${suffix}`] }, [`title:${suffix}`]: { ...nodeBase(`title:${suffix}`,'Title',`root:${suffix}`), type:'text', text:constant(`Title ${suffix}`), fillColor:constant('#fff'), fontFamily:'Inter', fontSize:constant(56), fontWeight:constant(700), textAlign:'center' } }, semanticParts:[{ id:`part:${suffix}`, label:'Title', role:'primary-text', nodeIds:[`title:${suffix}`] }], exposures:[], layout:{ mode:'responsive', ownership:[], formatOverrides:[] }, supportedAspectRatios:['16:9','9:16','1:1','4:5'] })
const state = (id:string,tick:number,suffix=id):KeyVisualStateV1 => ({ schemaVersion:'sanverse.key-visual-state/v1', id, semanticPurpose:'explain', approximateTick:tick, presentationMode:'overlay', sourceTreatment:'normal', backgroundTreatment:'source-video', focusNodeIds:[`title:${suffix}`], graphState:scene(suffix), sourceFrameRef:{ schemaVersion:'sanverse.source-frame-reference/v1', sourceId:'source:1', exactTick:tick } })
const storyboard = ():StoryboardV1 => createStoryboardV1({ id:'story:1', sourceRevision:'project-r7', setup:{ schemaVersion:'sanverse.storyboard-presentation-setup/v1', sourceRegion:{startTick:0,endTick:14_400_000}, communicationGoal:'Explain result', presentationMode:'overlay', sourceTreatment:'normal', backgroundTreatment:'source-video', preserveSourceAudio:true, preserveSourceVideo:true, requiredCapabilities:[] }, states:[state('kvs:1',1_440_000,'kvs:1'),state('kvs:2',7_200_000,'kvs:2')], status:'draft', revision:1 })

describe('Storyboard sandbox V1', () => {
  it('applies a revisioned edit only to sandbox state and returns an inverse transaction', () => {
    const live = storyboard()
    const sandbox = createStoryboardSandboxV1('sandbox:1', 7, live)
    const replacement = { ...state('kvs:2',8_640_000,'kvs:2'), notes:'move payoff later' }
    const result = applyStoryboardSandboxTransactionV1(sandbox,{ transactionId:'tx:1', expectedSandboxRevision:1, operations:[{ type:'replace-state', stateId:'kvs:2', state:replacement }] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.sandbox.storyboard.states[1]?.approximateTick).toBe(8_640_000)
    expect(live.states[1]?.approximateTick).toBe(7_200_000)
    expect(result.value.inverse.operations[0]).toMatchObject({ type:'replace-state', stateId:'kvs:2' })
  })

  it('refuses stale revisions and storyboard locks without mutation', () => {
    const base = createStoryboardSandboxV1('sandbox:1',7,storyboard())
    const op:StoryboardSandboxOperationV1={ type:'remove-state', stateId:'kvs:2' }
    expect(applyStoryboardSandboxTransactionV1(base,{transactionId:'stale',expectedSandboxRevision:99,operations:[op]})).toMatchObject({ok:false,refusal:{code:'STALE_SANDBOX_REVISION'}})
    const locked={...base,locks:{...base.locks,storyboard:true}}
    expect(applyStoryboardSandboxTransactionV1(locked,{transactionId:'locked',expectedSandboxRevision:1,operations:[op]})).toMatchObject({ok:false,refusal:{code:'STORYBOARD_LOCKED'}})
    expect(base.storyboard.states).toHaveLength(2)
  })

  it('retrieves the closest source-aware KVS at an exact tick without changing it', () => {
    const story=storyboard()
    expect(findStoryboardStateAtTickV1(story,6_900_000,'source:1')?.id).toBe('kvs:2')
    expect(findStoryboardStateAtTickV1(story,1_500_000,'other-source')).toBeNull()
  })

  it('rejects an atomic transaction if any operation would make the storyboard invalid', () => {
    const base=createStoryboardSandboxV1('sandbox:1',7,storyboard())
    const result=applyStoryboardSandboxTransactionV1(base,{transactionId:'bad',expectedSandboxRevision:1,operations:[{type:'remove-state',stateId:'kvs:1'},{type:'remove-state',stateId:'kvs:2'}]})
    expect(result).toMatchObject({ok:false,refusal:{code:'SANDBOX_TRANSACTION_FAILED'}})
    expect(base.storyboard.states).toHaveLength(2)
  })
})
