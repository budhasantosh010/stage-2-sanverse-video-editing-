import { describe,expect,it } from 'vitest'
import { extractMotionRecipeV1,bindMotionRecipeV1 } from './recipe.ts'
import { promotionProofMotionPlan,promotionSource } from './test-fixtures.ts'

describe('Promotion V1 Motion Recipe extraction',()=>{
  it('extracts role-based choreography from MotionPlan instead of hard-coded source node IDs',()=>{
    const recipe=extractMotionRecipeV1({id:'recipe:metric-payoff',title:'Metric payoff choreography',motionPlan:promotionProofMotionPlan(),scene:promotionSource().scene,communicationGoals:['explain-growth'],supportedPresentationModes:['full-screen-motion']})
    expect(recipe).toMatchObject({ok:true,value:{schemaVersion:'sanverse.promoted-motion-recipe/v1',id:'recipe:metric-payoff',version:1}})
    if(!recipe.ok)throw new Error('recipe')
    expect(recipe.value.requiredRoles.map(role=>role.role)).toEqual(expect.arrayContaining(['HEADLINE','PRIMARY_HERO','PAYOFF_METRIC']))
    expect(JSON.stringify(recipe.value.beatTemplate)).not.toContain('headline')
    expect(JSON.stringify(recipe.value.beatTemplate)).not.toContain('metric')
  })

  it('binds the same recipe to different Project B semantic node IDs and returns a normal MotionPlan',()=>{
    const recipe=extractMotionRecipeV1({id:'recipe:metric-payoff',title:'Metric payoff choreography',motionPlan:promotionProofMotionPlan(),scene:promotionSource().scene,communicationGoals:['explain-growth'],supportedPresentationModes:['full-screen-motion']});if(!recipe.ok)throw new Error('recipe')
    const bound=bindMotionRecipeV1(recipe.value,{recipeApplicationId:'recipe-use:project-b',storyboardId:'storyboard:b',storyboardApprovedRevision:4,animaticId:'animatic:b',animaticApprovedRevision:3,roleBindings:{HEADLINE:['b.headline'],PRIMARY_HERO:['b.hero'],SUPPORTING_ITEMS:['b.support'],PAYOFF_METRIC:['b.metric']}})
    expect(bound).toMatchObject({ok:true,value:{id:'recipe-use:project-b',storyboardId:'storyboard:b',animaticId:'animatic:b'}})
    if(!bound.ok)throw new Error('bound')
    expect(bound.value.beats.flatMap(beat=>beat.nodeIds)).toEqual(expect.arrayContaining(['b.headline','b.metric']))
    expect(JSON.stringify(bound.value)).not.toContain('"headline"')
    expect(JSON.stringify(bound.value)).not.toContain('"metric"')
  })

  it('fails closed when a required semantic role is not bound',()=>{
    const recipe=extractMotionRecipeV1({id:'recipe:metric-payoff',title:'Metric payoff choreography',motionPlan:promotionProofMotionPlan(),scene:promotionSource().scene,communicationGoals:['explain-growth'],supportedPresentationModes:['full-screen-motion']});if(!recipe.ok)throw new Error('recipe')
    expect(bindMotionRecipeV1(recipe.value,{recipeApplicationId:'x',storyboardId:'s',storyboardApprovedRevision:1,animaticId:'a',animaticApprovedRevision:1,roleBindings:{HEADLINE:['h']}})).toMatchObject({ok:false,refusal:{code:'MOTION_RECIPE_ROLE_BINDING_INCOMPLETE'}})
  })
})
