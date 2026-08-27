import type { CSSProperties } from 'react'
import type { MotionRenderContextV1 } from '@sanverse/motion-contract'
import { evaluateMotionExpertAtTickV1 } from '@sanverse/motion-expert-runtime'
import type { ResolvedMotionExpertNodeV1 } from '@sanverse/motion-graph'

export interface MotionExpertNodeSurfaceProps {
  readonly node: ResolvedMotionExpertNodeV1
  readonly context: MotionRenderContextV1
  readonly className?: string
  readonly style?: CSSProperties
}

export function MotionExpertNodeSurface({node,context,className,style}:MotionExpertNodeSurfaceProps){
  const result=evaluateMotionExpertAtTickV1({spec:node.expert,tick:context.localTicks,ticksPerSecond:context.ticksPerSecond})
  if(!result.ok)throw new RangeError(`${result.refusal.code}: ${result.refusal.message}`)
  const frame=result.value
  return <div className={className} style={{position:'relative',width:'100%',height:'100%',overflow:'hidden',...style}} data-motion-expert-surface="true" data-motion-expert-kind={frame.kind} data-motion-expert-program={frame.program} data-motion-expert-tick={frame.tick} data-motion-expert-seed={frame.seed}>
    {frame.shader?<div data-expert-shader="plasma-field" data-expert-shader-tick={frame.shader.uniforms.canonicalTick} data-expert-shader-seed={frame.shader.uniforms.seed} style={{position:'absolute',inset:0,background:frame.shader.cssBackground}}/>:null}
    {frame.primitives.map((primitive)=>primitive.kind==='ring'
      ?<div key={primitive.id} data-expert-primitive="ring" data-expert-primitive-id={primitive.id} style={{position:'absolute',left:`${(primitive.centerX/frame.width)*100}%`,top:`${(primitive.centerY/frame.height)*100}%`,width:`${(primitive.radius*2/frame.width)*100}%`,height:`${(primitive.radius*2/frame.height)*100}%`,transform:`translate(-50%,-50%) rotate(${primitive.rotationDeg}deg)`,border:`${Math.max(.5,primitive.thickness)}px solid rgba(151,221,255,${primitive.opacity})`,borderRadius:'50%',boxSizing:'border-box',boxShadow:`0 0 ${Math.max(4,primitive.thickness*3)}px rgba(75,189,255,${primitive.opacity*.34})`}}/>
      :<div key={primitive.id} data-expert-primitive="particle" data-expert-primitive-id={primitive.id} style={{position:'absolute',left:`${(primitive.x/frame.width)*100}%`,top:`${(primitive.y/frame.height)*100}%`,width:`${Math.max(.15,(primitive.size/frame.width)*100)}%`,aspectRatio:'1/1',transform:`translate(-50%,-50%) rotate(${primitive.rotationDeg}deg)`,opacity:primitive.opacity,borderRadius:'38%',background:`hsl(${primitive.hue} 88% 64%)`,boxShadow:`0 0 ${Math.max(3,primitive.size*.8)}px hsl(${primitive.hue} 90% 60% / .55)`}}/>) }
  </div>
}
