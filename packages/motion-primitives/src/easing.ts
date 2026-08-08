import { assertFiniteNumber, clamp01 } from './math.ts'

export type MotionEasing = (progress: number) => number
export const linear: MotionEasing = (progress) => clamp01(progress)
export const easeInCubic: MotionEasing = (progress) => { const t = clamp01(progress); return t*t*t }
export const easeOutCubic: MotionEasing = (progress) => { const t = 1 - clamp01(progress); return 1 - t*t*t }
export const easeInOutCubic: MotionEasing = (progress) => { const t = clamp01(progress); return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2 }
export const easeOutBack = (progress: number, overshoot = 1.70158): number => {
  const t = clamp01(progress) - 1
  assertFiniteNumber(overshoot, 'overshoot')
  const c3 = overshoot + 1
  return 1 + c3*t*t*t + overshoot*t*t
}

const cubic = (a: number, b: number, c: number, t: number): number => ((a*t+b)*t+c)*t
export const cubicBezier = (x1: number, y1: number, x2: number, y2: number): MotionEasing => {
  for (const [value,label] of [[x1,'x1'],[y1,'y1'],[x2,'x2'],[y2,'y2']] as const) assertFiniteNumber(value,label)
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) throw new RangeError('Cubic-bezier x control points must be inside [0, 1].')
  const cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx,cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by
  const sampleX=(t:number)=>cubic(ax,bx,cx,t), sampleY=(t:number)=>cubic(ay,by,cy,t), derivative=(t:number)=>(3*ax*t+2*bx)*t+cx
  return (progress:number) => {
    const x=clamp01(progress); if (x===0 || x===1) return x
    let t=x
    for (let i=0;i<8;i+=1) { const d=derivative(t); if (Math.abs(d)<1e-7) break; const next=t-(sampleX(t)-x)/d; if(next<0||next>1) break; t=next }
    let low=0,high=1
    for (let i=0;i<20;i+=1) { const sampled=sampleX(t); if(Math.abs(sampled-x)<1e-7) break; if(sampled<x) low=t; else high=t; t=(low+high)/2 }
    return sampleY(t)
  }
}

export interface SpringProgressOptions { readonly progress:number; readonly damping:number; readonly frequency:number }
export const springProgress = ({ progress, damping, frequency }: SpringProgressOptions): number => {
  const t=clamp01(progress); assertFiniteNumber(damping,'damping'); assertFiniteNumber(frequency,'frequency')
  if(damping<=0) throw new RangeError('damping must be greater than zero.')
  if(frequency<=0) throw new RangeError('frequency must be greater than zero.')
  if(t===0) return 0; if(t===1) return 1
  const omega=Math.PI*2*frequency
  const raw=1-Math.exp(-damping*t)*Math.cos(omega*t)
  const end=1-Math.exp(-damping)*Math.cos(omega)
  if(Math.abs(end)<1e-9) throw new RangeError('Spring parameters create an unstable normalization.')
  return raw/end
}
