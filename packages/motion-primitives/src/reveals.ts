import { clamp01 } from './math.ts'
export const blurRevealProgress=(progress:number):number=>clamp01(progress)
export const maskRevealProgress=(progress:number):number=>clamp01(progress)
export const clipRevealProgress=(progress:number):number=>clamp01(progress)
export const wipeProgress=(progress:number):number=>clamp01(progress)
export const pathDrawProgress=(progress:number):number=>clamp01(progress)
export const fillProgress=(progress:number):number=>clamp01(progress)
