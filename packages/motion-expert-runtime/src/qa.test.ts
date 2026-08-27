import { describe,expect,it } from 'vitest'
import { instantiateMotionExpertRecipeV1 } from './recipes.ts'
import { runMotionExpertQaV1 } from './qa.ts'

const spec=(recipeId:'expert.orbital-accent'|'expert.radial-payoff'|'expert.plasma-backdrop')=>{const result=instantiateMotionExpertRecipeV1({recipeId,width:960,height:540});if(!result.ok)throw new Error(result.refusal.message);return result.value}

describe('Expert Motion V1.4 resource/complexity QA',()=>{
  it('passes every supported expert family within its serialized resource budget',()=>{for(const id of ['expert.orbital-accent','expert.radial-payoff','expert.plasma-backdrop'] as const){const report=runMotionExpertQaV1(spec(id));expect(report.status,id).toBe('PASS');expect(report.maximumObservedPrimitives,id).toBeLessThanOrEqual(report.maximumAllowedPrimitives);expect(report.findings,id).toEqual([])}})
  it('checks shader tick/seed authority at multiple non-monotonic sample ticks',()=>{const report=runMotionExpertQaV1(spec('expert.plasma-backdrop'),[3_600_000,0,7_200_000,720_000,3_600_000]);expect(report).toMatchObject({status:'PASS',program:'plasma-field',sampleTicks:[3_600_000,0,7_200_000,720_000,3_600_000]})})
  it('fails closed on an invalid QA sampling request',()=>{expect(runMotionExpertQaV1(spec('expert.radial-payoff'),[])).toMatchObject({status:'FAIL',findings:[{code:'EXPERT_QA_TICKS_INVALID'}]})})
})
