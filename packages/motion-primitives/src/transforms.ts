import { lerp } from './math.ts'
import { easeOutBack } from './easing.ts'

export interface MotionPointV1 { readonly x:number; readonly y:number }

export const fade=(progress:number,from=0,to=1):number=>lerp(from,to,progress)
export const translateX=(progress:number,from:number,to=0):number=>lerp(from,to,progress)
export const translateY=(progress:number,from:number,to=0):number=>lerp(from,to,progress)
export const slide=(progress:number,from:MotionPointV1,to:MotionPointV1={x:0,y:0}):MotionPointV1=>Object.freeze({x:lerp(from.x,to.x,progress),y:lerp(from.y,to.y,progress)})
export const scale=(progress:number,from:number,to=1):number=>lerp(from,to,progress)
export const scaleOvershoot=(progress:number,from=0.92,to=1,overshoot=1.35):number=>lerp(from,to,easeOutBack(progress,overshoot))
export const rotate=(progress:number,fromDegrees:number,toDegrees=0):number=>lerp(fromDegrees,toDegrees,progress)
export const parallax=(progress:number,distance:number,depth=1):number=>lerp(-distance*depth,distance*depth,progress)
