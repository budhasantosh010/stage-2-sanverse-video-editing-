import { validateMotionExpertSpecV1, type MotionExpertSpecV1 } from '@sanverse/motion-graph'
import { evaluateMotionExpertAtTickV1, type MotionExpertRuntimeFrameV1 } from './runtime.ts'

export type MotionExpertQaSeverityV1 = 'error' | 'warning'
export interface MotionExpertQaFindingV1 { readonly code: string; readonly severity: MotionExpertQaSeverityV1; readonly message: string }
export interface MotionExpertQaReportV1 {
  readonly schemaVersion: 'sanverse.motion-expert-qa/v1'
  readonly status: 'PASS' | 'FAIL'
  readonly program: string
  readonly seed: number
  readonly sampleTicks: readonly number[]
  readonly maximumObservedPrimitives: number
  readonly maximumAllowedPrimitives: number
  readonly findings: readonly MotionExpertQaFindingV1[]
}

const finitePrimitive = (frame: MotionExpertRuntimeFrameV1): boolean => frame.primitives.every((primitive) => Object.values(primitive).every((value) => typeof value !== 'number' || Number.isFinite(value)))

export const runMotionExpertQaV1 = (spec: MotionExpertSpecV1, sampleTicks: readonly number[] = Object.freeze([0,720_000,1_440_000,3_600_000,7_200_000])): MotionExpertQaReportV1 => {
  const findings: MotionExpertQaFindingV1[] = []
  const validated = validateMotionExpertSpecV1(spec)
  if (!validated.ok) {
    findings.push(Object.freeze({code:'EXPERT_SPEC_INVALID',severity:'error',message:'Canonical expert specification failed Motion Graph validation.'}))
    return Object.freeze({schemaVersion:'sanverse.motion-expert-qa/v1',status:'FAIL',program:String((spec as MotionExpertSpecV1).program),seed:Number((spec as MotionExpertSpecV1).seed),sampleTicks:Object.freeze([...sampleTicks]),maximumObservedPrimitives:0,maximumAllowedPrimitives:Number((spec as MotionExpertSpecV1).maxPrimitives)||0,findings:Object.freeze(findings)})
  }
  if (!Array.isArray(sampleTicks) || sampleTicks.length === 0 || sampleTicks.length > 32 || sampleTicks.some((tick)=>!Number.isSafeInteger(tick)||tick<0)) findings.push(Object.freeze({code:'EXPERT_QA_TICKS_INVALID',severity:'error',message:'Expert QA requires 1–32 non-negative safe-integer sample ticks.'}))
  let maximumObservedPrimitives=0
  if (findings.length===0) for (const tick of sampleTicks) {
    const first=evaluateMotionExpertAtTickV1({spec:validated.value,tick}),second=evaluateMotionExpertAtTickV1({spec:validated.value,tick})
    if(!first.ok||!second.ok){findings.push(Object.freeze({code:'EXPERT_EVALUATION_FAILED',severity:'error',message:`Expert evaluation failed at tick ${tick}.`}));continue}
    maximumObservedPrimitives=Math.max(maximumObservedPrimitives,first.value.resourceUsage.primitiveCount)
    if(JSON.stringify(first.value)!==JSON.stringify(second.value))findings.push(Object.freeze({code:'EXPERT_NONDETERMINISTIC',severity:'error',message:`Repeated exact-tick evaluation differed at ${tick}.`}))
    if(first.value.resourceUsage.primitiveCount>validated.value.maxPrimitives)findings.push(Object.freeze({code:'EXPERT_RESOURCE_BUDGET_EXCEEDED',severity:'error',message:`Primitive budget exceeded at tick ${tick}.`}))
    if(!finitePrimitive(first.value))findings.push(Object.freeze({code:'EXPERT_NONFINITE_OUTPUT',severity:'error',message:`Expert output contained a non-finite primitive value at tick ${tick}.`}))
    if(first.value.shader&&(first.value.shader.uniforms.canonicalTick!==tick||first.value.shader.uniforms.seed!==validated.value.seed))findings.push(Object.freeze({code:'EXPERT_SHADER_UNIFORM_AUTHORITY',severity:'error',message:`Shader uniforms did not preserve canonical tick/seed at ${tick}.`}))
    if(first.value.shader&&first.value.shader.cssBackground.length>2048)findings.push(Object.freeze({code:'EXPERT_SHADER_PLAN_TOO_LARGE',severity:'error',message:'Shader preview plan exceeded its bounded serialized size.'}))
  }
  return Object.freeze({schemaVersion:'sanverse.motion-expert-qa/v1',status:findings.some((finding)=>finding.severity==='error')?'FAIL':'PASS',program:validated.value.program,seed:validated.value.seed,sampleTicks:Object.freeze([...sampleTicks]),maximumObservedPrimitives,maximumAllowedPrimitives:validated.value.maxPrimitives,findings:Object.freeze(findings)})
}
