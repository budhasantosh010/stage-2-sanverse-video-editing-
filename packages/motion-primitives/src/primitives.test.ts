import { describe, expect, it } from 'vitest'
import { clamp, clamp01, cubicBezier, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, enterHoldExit, frameForTicks, inverseLerp, lerp, mapRange, normalizedProgress, progressBetweenTicks, SANVERSE_TICKS_PER_SECOND, springProgress, staggerProgress, ticksForFrame } from './index.ts'
const composition={width:1920,height:1080,fpsNumerator:30_000,fpsDenominator:1_001} as const

describe('numeric primitives',()=>{
  it('clamps and interpolates positive and negative ranges',()=>{ expect(clamp(-5,-3,9)).toBe(-3); expect(clamp01(1.2)).toBe(1); expect(lerp(-10,10,0.25)).toBe(-5); expect(inverseLerp(-10,10,0)).toBe(0.5); expect(mapRange(5,10,0,0,100)).toBe(50) })
  it('refuses non-finite and zero-length ranges',()=>{ expect(()=>clamp(Number.NaN,0,1)).toThrow(/finite/); expect(()=>inverseLerp(4,4,4)).toThrow(/zero-length/); expect(()=>progressBetweenTicks(10,2,2)).toThrow(/non-zero/); expect(()=>normalizedProgress(0,0)).toThrow(/greater than zero/) })
  it('handles large safe ticks',()=>{ const big=Number.MAX_SAFE_INTEGER-10_000; expect(progressBetweenTicks(big-5_000,big-10_000,big)).toBeCloseTo(0.5,8) })
})

describe('easing and deterministic spring',()=>{
  it('pins standard easings to exact boundaries',()=>{ for(const easing of [easeInCubic,easeOutCubic,easeInOutCubic]){expect(easing(0)).toBe(0);expect(easing(1)).toBe(1)}; expect(easeOutBack(0)).toBeCloseTo(0); expect(easeOutBack(1)).toBeCloseTo(1) })
  it('evaluates cubic bezier deterministically',()=>{ const easing=cubicBezier(0.2,0.8,0.2,1); const first=easing(0.4375); expect(easing(0.4375)).toBe(first) })
  it('evaluates spring directly at any time',()=>{ const o={damping:6,frequency:1.15}; expect(springProgress({progress:0,...o})).toBe(0); expect(springProgress({progress:1,...o})).toBe(1); const x=springProgress({progress:0.25,...o}); springProgress({progress:0.9,...o}); springProgress({progress:0.1,...o}); expect(springProgress({progress:0.25,...o})).toBe(x) })
})

describe('phase and stagger',()=>{
  it('uses enter/settle/hold/exit defaults',()=>{ expect(enterHoldExit({progress:0.1}).phase).toBe('enter'); expect(enterHoldExit({progress:0.2}).phase).toBe('settle'); expect(enterHoldExit({progress:0.5}).phase).toBe('hold'); expect(enterHoldExit({progress:0.9}).phase).toBe('exit') })
  it.each([1,2,8,100])('stagger count=%i stays finite',(count)=>{ const values=Array.from({length:count},(_,index)=>staggerProgress({progress:0.5,index,count,overlap:0.5})); expect(values.every(Number.isFinite)).toBe(true) })
})

describe('frame/tick mapping',()=>{
  it('reuses Sanverse project clock and exact 30000/1001 frame ticks',()=>{ expect(SANVERSE_TICKS_PER_SECOND).toBe(1_440_000); expect(ticksForFrame(1,composition)).toBe(48_048); expect(ticksForFrame(250,composition)).toBe(12_012_000); expect(frameForTicks(12_012_000,composition)).toBe(250) })
  it('is random-access independent',()=>{ const direct=ticksForFrame(250,composition); for(const f of [0,1,40,700,0,315,250]) ticksForFrame(f,composition); expect(ticksForFrame(250,composition)).toBe(direct) })
})
