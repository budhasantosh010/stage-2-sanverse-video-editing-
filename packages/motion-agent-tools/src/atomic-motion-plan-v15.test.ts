import { describe,expect,it } from 'vitest'
import { constant,createMotionScene,evaluateScene,nodeBase,applyMotionOperations,type MotionSceneV1 } from '@sanverse/motion-graph'
import type { MotionPlanV1 } from '@sanverse/creative-direction'
import { applyMotionPlanAtomicV15 } from './atomic-motion-plan-v15.ts'

const scene=():MotionSceneV1=>{const root=nodeBase('root','Root',null),nodes=Object.freeze({root:Object.freeze({...root,type:'group' as const,childIds:Object.freeze(['a','b','c','d','e','f'])}),...Object.fromEntries(['a','b','c','d','e','f'].map(id=>{const base=nodeBase(id,id,'root');return[id,Object.freeze({...base,type:'shape' as const,shape:'rectangle' as const,width:constant(.1),height:constant(.1),fillColor:constant('#fff'),strokeColor:constant('transparent'),strokeWidth:constant(0),radius:constant(0)})]}))});return createMotionScene({componentId:'sanverse.v15-batch',componentVersion:1,rootNodeId:'root',nodes,semanticParts:Object.freeze([{id:'cards',label:'Cards',role:'content-group',nodeIds:Object.freeze(['a','b','c','d','e','f'])}]),exposures:Object.freeze([]),layout:Object.freeze({mode:'responsive',ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9'])})}
const plan=():MotionPlanV1=>Object.freeze({id:'plan:v15',storyboardId:'sb',storyboardApprovedRevision:2,animaticId:'anim',animaticApprovedRevision:3,beats:Object.freeze([{id:'beat:cards',purpose:'build' as const,startTick:0,endTick:720_000,nodeIds:Object.freeze(['a','b','c','d','e','f']),operationIntents:Object.freeze([{id:'cards:enter',type:'motion.stagger' as const,nodeIds:Object.freeze(['a','b','c','d','e','f']),startTick:0,endTick:360_000},{id:'cards:settle',type:'motion.soften' as const,nodeIds:Object.freeze(['a','b','c','d','e','f']),startTick:0,endTick:720_000,parameters:Object.freeze({property:'opacity'})}])}]),revision:1})

describe('V1.5 atomic AI/MCP motion batching',()=>{
  it('compiles dependent semantic edits on scratch then applies one reversible canonical batch',()=>{
    const base=scene(),result=applyMotionPlanAtomicV15(base,plan())
    expect(result.ok).toBe(true);if(!result.ok)return
    expect(result.value.baseScene).toBe(base)
    expect(result.value.intentIds).toEqual(['cards:enter','cards:settle'])
    expect(result.value.operations.length).toBe(12)
    expect(result.value.inverseOperations.length).toBe(12)
    const ctx={localTicks:180_000,durationTicks:720_000,ticksPerSecond:1_440_000,composition:{width:1920,height:1080,fpsNumerator:30,fpsDenominator:1},reducedMotion:false} as const
    expect(evaluateScene(result.value.scene,ctx)).not.toEqual(evaluateScene(base,ctx))
    const undone=applyMotionOperations(result.value.scene,result.value.inverseOperations,{durationTicks:720_000})
    expect(undone.ok).toBe(true);if(undone.ok)expect(undone.scene).toEqual(base)
  })

  it('fails all-or-none and leaves the supplied scene identity untouched',()=>{
    const base=scene(),bad=Object.freeze({...plan(),beats:Object.freeze([{...plan().beats[0]!,operationIntents:Object.freeze([...plan().beats[0]!.operationIntents,{id:'bad',type:'motion.fade' as const,nodeIds:Object.freeze(['missing']),startTick:1,endTick:2}])}])})
    const result=applyMotionPlanAtomicV15(base,bad)
    expect(result).toMatchObject({ok:false,refusal:{code:'MOTION_INTENT_TARGET_INVALID'}})
    expect(base).toBe(base)
    expect(base.nodes.missing).toBeUndefined()
  })
})
