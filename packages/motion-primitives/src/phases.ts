import { clamp01 } from './math.ts'
export type MotionPhase = 'enter' | 'settle' | 'hold' | 'exit' | 'ended'
export interface EnterHoldExitState { readonly phase: MotionPhase; readonly progress:number; readonly enter:number; readonly settle:number; readonly hold:number; readonly exit:number }
export const sequenceProgress=(progress:number,start:number,end:number):number=>{
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>1||start>=end) throw new RangeError('Sequence range must satisfy 0 <= start < end <= 1.')
  return clamp01((clamp01(progress)-start)/(end-start))
}
export const enterProgress=(progress:number,end=0.18)=>sequenceProgress(progress,0,end)
export const settleProgress=(progress:number,start=0.18,end=0.30)=>sequenceProgress(progress,start,end)
export const holdProgress=(progress:number,start=0.30,end=0.80)=>sequenceProgress(progress,start,end)
export const exitProgress=(progress:number,start=0.80)=>sequenceProgress(progress,start,1)
export const enterHoldExit=({progress,enterEnd=0.18,settleEnd=0.30,exitStart=0.80}:{readonly progress:number;readonly enterEnd?:number;readonly settleEnd?:number;readonly exitStart?:number}):EnterHoldExitState=>{
  if(!(enterEnd>0&&enterEnd<settleEnd&&settleEnd<exitStart&&exitStart<1)) throw new RangeError('Phase boundaries must satisfy 0 < enterEnd < settleEnd < exitStart < 1.')
  const p=clamp01(progress)
  const phase:MotionPhase=p<enterEnd?'enter':p<settleEnd?'settle':p<exitStart?'hold':p<1?'exit':'ended'
  return {phase,progress:p,enter:sequenceProgress(p,0,enterEnd),settle:sequenceProgress(p,enterEnd,settleEnd),hold:sequenceProgress(p,settleEnd,exitStart),exit:sequenceProgress(p,exitStart,1)}
}
export const staggerProgress=({progress,index,count,overlap=0.55}:{readonly progress:number;readonly index:number;readonly count:number;readonly overlap?:number}):number=>{
  if(!Number.isSafeInteger(count)||count<=0) throw new RangeError('count must be a positive integer.')
  if(!Number.isSafeInteger(index)||index<0||index>=count) throw new RangeError('index must be inside the stagger collection.')
  if(!Number.isFinite(overlap)||overlap<0||overlap>1) throw new RangeError('overlap must be inside [0, 1].')
  const p=clamp01(progress); if(count===1||overlap===1) return p
  const spread=Math.min(0.92,(1-overlap)*((count-1)/count)), start=(index/(count-1))*spread, itemDuration=1-spread
  return clamp01((p-start)/itemDuration)
}
