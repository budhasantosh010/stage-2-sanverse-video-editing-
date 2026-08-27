import { creativeRefusal, creativeValidationOk, type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import { validateMotionExpertSpecV1, type MotionExpertSpecV1 } from '@sanverse/motion-graph'

export const MOTION_EXPERT_RECIPE_IDS_V1 = Object.freeze(['expert.orbital-accent','expert.radial-payoff','expert.plasma-backdrop'] as const)
export type MotionExpertRecipeIdV1 = (typeof MOTION_EXPERT_RECIPE_IDS_V1)[number]

export interface MotionExpertRecipeV1 {
  readonly schemaVersion: 'sanverse.motion-expert-recipe/v1'
  readonly id: MotionExpertRecipeIdV1
  readonly name: string
  readonly purpose: 'accent' | 'payoff' | 'background'
  readonly kind: MotionExpertSpecV1['kind']
  readonly program: MotionExpertSpecV1['program']
  readonly defaultSeed: number
}

export const MOTION_EXPERT_RECIPES_V1: readonly MotionExpertRecipeV1[] = Object.freeze([
  Object.freeze({ schemaVersion:'sanverse.motion-expert-recipe/v1', id:'expert.orbital-accent', name:'Orbital Accent', purpose:'accent', kind:'procedural', program:'orbital-rings', defaultSeed:101 }),
  Object.freeze({ schemaVersion:'sanverse.motion-expert-recipe/v1', id:'expert.radial-payoff', name:'Radial Payoff', purpose:'payoff', kind:'particles', program:'radial-burst', defaultSeed:202 }),
  Object.freeze({ schemaVersion:'sanverse.motion-expert-recipe/v1', id:'expert.plasma-backdrop', name:'Plasma Backdrop', purpose:'background', kind:'shader', program:'plasma-field', defaultSeed:303 }),
])

const recipeFor = (id: MotionExpertRecipeIdV1): MotionExpertRecipeV1 | undefined => MOTION_EXPERT_RECIPES_V1.find((recipe) => recipe.id === id)

export const instantiateMotionExpertRecipeV1 = (input: Readonly<{ recipeId: MotionExpertRecipeIdV1; width: number; height: number; seed?: number }>): CreativeValidationResultV1<MotionExpertSpecV1> => {
  const recipe = recipeFor(input.recipeId)
  if (!recipe) return creativeRefusal('EXPERT_RECIPE_UNKNOWN', `Unknown Expert Motion recipe: ${String(input.recipeId)}.`)
  const seed = input.seed ?? recipe.defaultSeed
  let spec: MotionExpertSpecV1
  if (recipe.kind === 'procedural') spec = Object.freeze({ schemaVersion:'sanverse.motion-expert-node/v1', kind:'procedural', program:'orbital-rings', seed, width:input.width, height:input.height, maxPrimitives:12, parameters:Object.freeze({ ringCount:8, radius:Math.min(input.width,input.height)*0.34, thickness:3.5, wobble:18, speed:1.15 }) })
  else if (recipe.kind === 'particles') spec = Object.freeze({ schemaVersion:'sanverse.motion-expert-node/v1', kind:'particles', program:'radial-burst', seed, width:input.width, height:input.height, maxPrimitives:96, parameters:Object.freeze({ count:72, lifetimeTicks:8_640_000, radius:Math.min(input.width,input.height)*0.42, size:10, speed:1 }) })
  else spec = Object.freeze({ schemaVersion:'sanverse.motion-expert-node/v1', kind:'shader', program:'plasma-field', seed, width:input.width, height:input.height, maxPrimitives:1, parameters:Object.freeze({ frequency:0.85, amplitude:0.9, hueShift:225, scale:1.4 }) })
  const validated = validateMotionExpertSpecV1(spec)
  return validated.ok ? creativeValidationOk(validated.value) : creativeRefusal('EXPERT_RECIPE_INVALID','Expert recipe generated an invalid bounded expert specification.',validated.issues)
}
