import type { MotionCompositionV1 } from '@sanverse/motion-contract'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import { assertSafeInteger } from './math.ts'
export const SANVERSE_TICKS_PER_SECOND = PROJECT_TIMESCALE
const validateFps=(composition:MotionCompositionV1):void=>{
  if(!Number.isSafeInteger(composition.fpsNumerator)||composition.fpsNumerator<=0) throw new RangeError('fpsNumerator must be a positive safe integer.')
  if(!Number.isSafeInteger(composition.fpsDenominator)||composition.fpsDenominator<=0) throw new RangeError('fpsDenominator must be a positive safe integer.')
}
export const ticksForFrame=(frameIndex:number,composition:MotionCompositionV1,ticksPerSecond=PROJECT_TIMESCALE):number=>{
  assertSafeInteger(frameIndex,'frameIndex'); if(frameIndex<0) throw new RangeError('frameIndex must be non-negative.')
  assertSafeInteger(ticksPerSecond,'ticksPerSecond'); if(ticksPerSecond<=0) throw new RangeError('ticksPerSecond must be positive.')
  validateFps(composition)
  return Math.round(frameIndex*ticksPerSecond*composition.fpsDenominator/composition.fpsNumerator)
}
export const frameForTicks=(ticks:number,composition:MotionCompositionV1,ticksPerSecond=PROJECT_TIMESCALE):number=>{
  assertSafeInteger(ticks,'ticks'); if(ticks<0) throw new RangeError('ticks must be non-negative.')
  assertSafeInteger(ticksPerSecond,'ticksPerSecond'); if(ticksPerSecond<=0) throw new RangeError('ticksPerSecond must be positive.')
  validateFps(composition)
  return Math.floor(ticks*composition.fpsNumerator/(ticksPerSecond*composition.fpsDenominator))
}
export const secondsForTicks=(ticks:number,ticksPerSecond=PROJECT_TIMESCALE):number=>{ assertSafeInteger(ticks,'ticks'); assertSafeInteger(ticksPerSecond,'ticksPerSecond'); if(ticksPerSecond<=0) throw new RangeError('ticksPerSecond must be positive.'); return ticks/ticksPerSecond }
