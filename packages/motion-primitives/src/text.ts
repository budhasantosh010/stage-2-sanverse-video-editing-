import { clamp01 } from './math.ts'
import { staggerProgress } from './phases.ts'
const reveal=(progress:number,index:number,count:number,overlap:number)=>staggerProgress({progress,index,count,overlap})
export const wordRevealProgress=(progress:number,index:number,count:number)=>reveal(progress,index,count,0.58)
export const characterRevealProgress=(progress:number,index:number,count:number)=>reveal(progress,index,count,0.72)
export const lineRevealProgress=(progress:number,index:number,count:number)=>reveal(progress,index,count,0.48)
export const rollingNumberProgress=(progress:number)=>clamp01(progress)
export const countProgress=(progress:number)=>clamp01(progress)
export const highlightSweepProgress=(progress:number)=>clamp01(progress)
export const underlineProgress=(progress:number)=>clamp01(progress)
export const emphasisPulse=(progress:number)=>Math.sin(clamp01(progress)*Math.PI)
