import { describe, expect, it } from 'vitest'
import { evaluateMotionExpertAtTickV1 } from './runtime.ts'
import { instantiateMotionExpertRecipeV1, MOTION_EXPERT_RECIPE_IDS_V1 } from './recipes.ts'

const get = <T,>(result: { ok: true; value: T } | { ok: false }): T => { if (!result.ok) throw new Error('expected success'); return result.value }

describe('C11/C12 deterministic Expert Runtime V1', () => {
  it('instantiates every bounded expert recipe through the canonical validator', () => {
    for (const recipeId of MOTION_EXPERT_RECIPE_IDS_V1) expect(instantiateMotionExpertRecipeV1({ recipeId, width:960, height:540 })).toMatchObject({ ok:true })
  })

  it('proves render-at-N equals direct, backward and random access for analytic particles', () => {
    const spec = get(instantiateMotionExpertRecipeV1({ recipeId:'expert.radial-payoff', width:960, height:540, seed:77 }))
    const target = 3_456_789
    const direct = get(evaluateMotionExpertAtTickV1({ spec, tick:target }))
    for (const tick of [0,1_440_000,5_200_000,target,900_000,target]) get(evaluateMotionExpertAtTickV1({ spec, tick }))
    const backward = get(evaluateMotionExpertAtTickV1({ spec, tick:target }))
    const random = get(evaluateMotionExpertAtTickV1({ spec, tick:target }))
    expect(backward).toEqual(direct)
    expect(random).toEqual(direct)
    expect(direct.primitives).toHaveLength(72)
    expect(direct.resourceUsage.primitiveCount).toBeLessThanOrEqual(spec.maxPrimitives)
  })

  it('reconstructs particles from tick and seed with no retained simulation state', () => {
    const spec = get(instantiateMotionExpertRecipeV1({ recipeId:'expert.radial-payoff', width:1280, height:720, seed:909 }))
    const a = get(evaluateMotionExpertAtTickV1({ spec, tick:2_160_000 }))
    const b = get(evaluateMotionExpertAtTickV1({ spec:Object.freeze({ ...spec, parameters:Object.freeze({ ...spec.parameters }) }) as typeof spec, tick:2_160_000 }))
    expect(b).toEqual(a)
    expect(a.primitives[0]).toMatchObject({ kind:'particle' })
  })

  it('binds shader time and seed to canonical uniforms instead of autonomous shader time', () => {
    const spec = get(instantiateMotionExpertRecipeV1({ recipeId:'expert.plasma-backdrop', width:960, height:540, seed:404 }))
    const frame = get(evaluateMotionExpertAtTickV1({ spec, tick:2_880_000 }))
    expect(frame.shader).toMatchObject({ program:'plasma-field', uniforms:{ canonicalTick:2_880_000, seconds:2, seed:404 } })
    expect(frame.shader?.cssBackground).toContain('radial-gradient')
    expect(frame.resourceUsage).toEqual({ primitiveCount:1, referencedAssetCount:0, workUnits:1 })
  })

  it('evaluates bounded orbital procedural output without hidden elapsed-time state', () => {
    const spec = get(instantiateMotionExpertRecipeV1({ recipeId:'expert.orbital-accent', width:960, height:540, seed:12 }))
    const a = get(evaluateMotionExpertAtTickV1({ spec, tick:720_000 }))
    const b = get(evaluateMotionExpertAtTickV1({ spec, tick:4_000_000 }))
    const aAgain = get(evaluateMotionExpertAtTickV1({ spec, tick:720_000 }))
    expect(aAgain).toEqual(a)
    expect(a.primitives).toHaveLength(8)
    expect(b.primitives).not.toEqual(a.primitives)
  })

  it('fails closed for noncanonical clocks and invalid ticks', () => {
    const spec = get(instantiateMotionExpertRecipeV1({ recipeId:'expert.orbital-accent', width:960, height:540 }))
    expect(evaluateMotionExpertAtTickV1({ spec, tick:-1 })).toMatchObject({ ok:false, refusal:{ code:'EXPERT_TICK_INVALID' } })
    expect(evaluateMotionExpertAtTickV1({ spec, tick:10, ticksPerSecond:1000 })).toMatchObject({ ok:false, refusal:{ code:'EXPERT_CLOCK_INVALID' } })
  })
})
