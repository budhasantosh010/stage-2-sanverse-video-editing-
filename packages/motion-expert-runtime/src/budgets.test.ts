import { describe,expect,it } from 'vitest'
import type { MotionExpertSpecV1 } from '@sanverse/motion-graph'
import { assessMotionExpertPerformanceV15,evaluateMotionExpertWithinBudgetV15 } from './budgets.ts'

const particles:MotionExpertSpecV1=Object.freeze({schemaVersion:'sanverse.motion-expert-node/v1',kind:'particles',program:'radial-burst',seed:42,width:1280,height:720,maxPrimitives:256,parameters:Object.freeze({count:224,lifetimeTicks:1_440_000,radius:200,size:8,speed:1.2})})
const shader:MotionExpertSpecV1=Object.freeze({schemaVersion:'sanverse.motion-expert-node/v1',kind:'shader',program:'plasma-field',seed:9,width:1920,height:1080,maxPrimitives:1,parameters:Object.freeze({frequency:1.2,amplitude:.8,hueShift:12,scale:1})})

describe('V1.5 Expert Runtime budgets',()=>{
  it('classifies measured evidence without changing exact-tick expert state',()=>{
    expect(assessMotionExpertPerformanceV15({spec:particles})).toMatchObject({classification:'HEAVY',estimatedWorkUnits:224,activePrimitiveCeiling:256})
    const a=evaluateMotionExpertWithinBudgetV15({spec:particles,tick:720_000,budget:{maxClass:'HEAVY'}})
    const b=evaluateMotionExpertWithinBudgetV15({spec:particles,tick:720_000,budget:{maxClass:'HEAVY'}})
    expect(a.ok).toBe(true);expect(b).toEqual(a)
  })
  it('fails closed before host performance collapse when explicit budgets are exceeded',()=>{
    expect(evaluateMotionExpertWithinBudgetV15({spec:particles,tick:0,budget:{maxClass:'MEDIUM'}})).toMatchObject({ok:false,refusal:{code:'EXPERT_BUDGET_EXCEEDED'}})
    expect(evaluateMotionExpertWithinBudgetV15({spec:shader,tick:0,budget:{maxClass:'EXTREME',maxPixelCount:1_000_000}})).toMatchObject({ok:false,refusal:{code:'EXPERT_BUDGET_EXCEEDED'}})
    expect(evaluateMotionExpertWithinBudgetV15({spec:shader,tick:0,measuredEvaluationMs:25,budget:{maxClass:'EXTREME',maxEvaluationMs:16.67}})).toMatchObject({ok:false,refusal:{code:'EXPERT_BUDGET_EXCEEDED'}})
  })
})
