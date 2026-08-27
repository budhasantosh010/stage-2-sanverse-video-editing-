import { describe,expect,it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { instantiateMotionExpertRecipeV1 } from '@sanverse/motion-expert-runtime'
import { nodeBase, type ResolvedMotionExpertNodeV1 } from '@sanverse/motion-graph'
import { MotionExpertNodeSurface } from './expert-surface.tsx'

const context={localTicks:2_880_000,durationTicks:7_200_000,ticksPerSecond:1_440_000,composition:{width:960,height:540,fpsNumerator:30,fpsDenominator:1},reducedMotion:false} as const
const resolved=(recipeId:'expert.radial-payoff'|'expert.plasma-backdrop'):ResolvedMotionExpertNodeV1=>{const made=instantiateMotionExpertRecipeV1({recipeId,width:960,height:540,seed:77});if(!made.ok)throw new Error(made.refusal.message);const base=nodeBase('expert','Expert',null);return {...base,type:'expert',enabled:true,effectiveEnabled:true,stackingIndex:0,visible:true,opacity:1,transform:{positionX:0,positionY:0,scaleX:1,scaleY:1,rotationDeg:0,anchorX:.5,anchorY:.5,perspectiveMatrix3d:'none'},effects:[],masks:[],expert:made.value}}

describe('native Expert Motion surface',()=>{
  it('renders the analytic particle plan without owning time',()=>{const markup=renderToStaticMarkup(<MotionExpertNodeSurface node={resolved('expert.radial-payoff')} context={context}/>);expect(markup).toContain('data-motion-expert-tick="2880000"');expect((markup.match(/data-expert-primitive="particle"/gu)??[])).toHaveLength(72)})
  it('renders the fixed shader plan with canonical tick and seed attributes',()=>{const markup=renderToStaticMarkup(<MotionExpertNodeSurface node={resolved('expert.plasma-backdrop')} context={context}/>);expect(markup).toContain('data-expert-shader="plasma-field"');expect(markup).toContain('data-expert-shader-tick="2880000"');expect(markup).toContain('data-expert-shader-seed="77"')})
})
