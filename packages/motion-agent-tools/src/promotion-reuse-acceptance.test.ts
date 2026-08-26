import { describe,expect,it } from 'vitest'
import { constant,createMotionScene,deriveNodeGraphProjection,keyframed,nodeBase,projectMotionCurves,projectMotionDopeSheet,projectMotionLayers,type MotionSceneV1 } from '@sanverse/motion-graph'
import type { MotionPlanV1 } from '@sanverse/creative-direction'
import type { PromotionSourceV1 } from '@sanverse/motion-promotion'
import { createClosedLoopEngineV1,createCreativeEngineV11ToolRegistryV1,createPromotionReuseEngineV1,PROMOTION_REUSE_TOOL_IDS_V1 } from './index.ts'

const sourceScene=():MotionSceneV1=>createMotionScene({
  componentId:'generated.project-a.metric-story',componentVersion:1,rootNodeId:'root',
  nodes:Object.freeze({
    root:Object.freeze({...nodeBase('root','Root',null),type:'group' as const,childIds:Object.freeze(['surface','headline','metric','label','media'])}),
    surface:Object.freeze({...nodeBase('surface','Hero Surface','root'),type:'shape' as const,shape:'rounded-rectangle' as const,width:constant(1120),height:constant(620),fillColor:constant('#111827'),strokeColor:constant('#334155'),strokeWidth:constant(2),radius:constant(40)}),
    headline:Object.freeze({...nodeBase('headline','Headline','root'),type:'text' as const,text:constant('Revenue grew'),fillColor:constant('#F8FAFC'),fontFamily:'Inter',fontSize:constant(74),fontWeight:constant(800),textAlign:'center' as const}),
    metric:Object.freeze({...nodeBase('metric','Payoff Metric','root'),type:'text' as const,text:constant('68%'),fillColor:constant('#4A74FF'),fontFamily:'Inter',fontSize:constant(148),fontWeight:constant(900),textAlign:'center' as const,transform:Object.freeze({...nodeBase('metric','Payoff Metric','root').transform,scaleX:keyframed([{id:'metric:s0',tick:720_000,value:.92,interpolation:'bezier',bezier:{inX:.25,inY:.1,outX:.25,outY:1}},{id:'metric:s1',tick:1_200_000,value:1,interpolation:'bezier',bezier:{inX:.25,inY:.1,outX:.25,outY:1}}]),scaleY:keyframed([{id:'metric:sy0',tick:720_000,value:.92,interpolation:'bezier',bezier:{inX:.25,inY:.1,outX:.25,outY:1}},{id:'metric:sy1',tick:1_200_000,value:1,interpolation:'bezier',bezier:{inX:.25,inY:.1,outX:.25,outY:1}}])})}),
    label:Object.freeze({...nodeBase('label','Supporting Label','root'),type:'text' as const,text:constant('Q3 Revenue'),fillColor:constant('#CBD5E1'),fontFamily:'Inter',fontSize:constant(38),fontWeight:constant(600),textAlign:'center' as const}),
    media:Object.freeze({...nodeBase('media','Hero Media','root'),type:'image' as const,source:'asset://project-a/hero',width:constant(360),height:constant(220),fit:'cover' as const,imageOpacity:constant(1)}),
  }),
  semanticParts:Object.freeze([
    {id:'part:headline',label:'Headline',role:'primary-text' as const,nodeIds:Object.freeze(['headline'])},
    {id:'part:metric',label:'Metric',role:'value' as const,nodeIds:Object.freeze(['metric'])},
    {id:'part:label',label:'Supporting label',role:'secondary-text' as const,nodeIds:Object.freeze(['label'])},
    {id:'part:surface',label:'Surface',role:'surface' as const,nodeIds:Object.freeze(['surface'])},
    {id:'part:media',label:'Media',role:'content-group' as const,nodeIds:Object.freeze(['media'])},
  ]),
  exposures:Object.freeze([
    {id:'headline.content',label:'Headline',group:'Content' as const,level:'creator' as const,target:{kind:'node' as const,nodeId:'headline',property:'text.text' as const},editor:{type:'text' as const},keyframeable:false},
    {id:'metric.content',label:'Metric',group:'Content' as const,level:'creator' as const,target:{kind:'node' as const,nodeId:'metric',property:'text.text' as const},editor:{type:'text' as const},keyframeable:false},
    {id:'label.content',label:'Label',group:'Content' as const,level:'creator' as const,target:{kind:'node' as const,nodeId:'label',property:'text.text' as const},editor:{type:'text' as const},keyframeable:false},
    {id:'media.content',label:'Media',group:'Content' as const,level:'creator' as const,target:{kind:'component' as const,propertyId:'media'},editor:{type:'asset' as const},keyframeable:false},
    {id:'metric.accent',label:'Accent',group:'Style' as const,level:'designer' as const,target:{kind:'node' as const,nodeId:'metric',property:'text.fillColor' as const},editor:{type:'color' as const},keyframeable:false},
  ]),
  layout:Object.freeze({mode:'responsive' as const,ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9','9:16','1:1','4:5'] as const),
})
const motionPlan=():MotionPlanV1=>Object.freeze({id:'motion-plan:project-a',storyboardId:'storyboard:a',storyboardApprovedRevision:2,animaticId:'animatic:a',animaticApprovedRevision:2,revision:1,beats:Object.freeze([
  Object.freeze({id:'beat:headline',purpose:'establish' as const,startTick:0,endTick:360_000,nodeIds:Object.freeze(['headline']),operationIntents:Object.freeze([{id:'intent:headline',type:'motion.enter' as const,nodeIds:Object.freeze(['headline']),startTick:0,endTick:360_000}])}),
  Object.freeze({id:'beat:label',purpose:'build' as const,startTick:360_000,endTick:720_000,nodeIds:Object.freeze(['label']),operationIntents:Object.freeze([{id:'intent:label',type:'motion.fade' as const,nodeIds:Object.freeze(['label']),startTick:360_000,endTick:720_000}])}),
  Object.freeze({id:'beat:metric',purpose:'payoff' as const,startTick:720_000,endTick:1_200_000,nodeIds:Object.freeze(['metric']),operationIntents:Object.freeze([{id:'intent:metric',type:'motion.scale' as const,nodeIds:Object.freeze(['metric']),startTick:720_000,endTick:1_200_000,parameters:Object.freeze({from:.92,to:1})}])}),
])})
const source=():PromotionSourceV1=>Object.freeze({schemaVersion:'sanverse.promotion-source/v1',sourceProjectId:'project:a',sourceProjectRevision:12,sourceSceneId:'motion-draft:project-a',sourceSceneRevision:3,scene:sourceScene(),sourceStoryboardId:'storyboard:a',sourceStoryboardRevision:2,sourceAnimaticId:'animatic:a',sourceAnimaticRevision:2,sourceMotionPlanId:'motion-plan:project-a',sourceMotionPlanRevision:1,motionPlan:motionPlan(),motionApproval:Object.freeze({schemaVersion:'sanverse.owner-approval/v1',id:'approval:project-a-motion-r3',scope:'motion',subjectId:'motion-draft:project-a',subjectRevision:3,status:'owner-approved',approvedAt:'2026-08-26T09:00:00.000Z'}),structuralQaPassed:true,visualReviewEvidence:Object.freeze({canonicalReviewRef:'review://project-a/1x',posterRef:'frame://project-a/poster',criticalFrameRefs:Object.freeze(['frame://a/entrance','frame://a/payoff','frame://a/exit'])}),origin:'generated',dependencies:Object.freeze([{id:'asset:project-a-hero',origin:'generated' as const,reusePermission:'global' as const,runtimeAssetOwned:true}])})
const projectBOriginal=()=>createMotionScene({componentId:'generated.project-b.empty',componentVersion:1,rootNodeId:'root',nodes:Object.freeze({root:Object.freeze({...nodeBase('root','Project B Root',null),type:'group' as const,childIds:Object.freeze([])})}),semanticParts:Object.freeze([{id:'part:root',label:'Root',role:'content-group' as const,nodeIds:Object.freeze(['root'])}]),exposures:Object.freeze([]),layout:Object.freeze({mode:'responsive' as const,ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9'])})
const expectOk=<T extends {ok:boolean}>(value:T)=>expect(value).toMatchObject({ok:true})

describe('Creative Engine V1.1 Project A → Project B reuse acceptance',()=>{
  it('promotes approved Project A work, B2 retrieves it, Project B adapts/reviews/applies it as normal graph content, then one Undo restores Project B',async()=>{
    const originalB=projectBOriginal()
    const closedLoop=createClosedLoopEngineV1(Object.freeze({id:'project:closed-loop-registry-host',revision:1,scene:originalB}))
    const promotion=createPromotionReuseEngineV1(source(),Object.freeze({id:'project:b',revision:20,scene:originalB}),{renderReuseReview:(draft,capability)=>Object.freeze({canonicalReviewRef:`review://${capability.id}/${draft.id}/1x`,posterRef:'frame://project-b/poster',criticalFrameRefs:Object.freeze(['frame://b/critical']),kvsAnchorFrameRefs:Object.freeze(['frame://b/anchor']),entrancePayoffExitFrameRefs:Object.freeze(['frame://b/entrance','frame://b/payoff','frame://b/exit']),sourceCompositeFrameRefs:Object.freeze(['frame://b/source-composite'])})})
    const tools=createCreativeEngineV11ToolRegistryV1(closedLoop,promotion)
    expect(tools.list()).toHaveLength(17+PROMOTION_REUSE_TOOL_IDS_V1.length)
    expect(PROMOTION_REUSE_TOOL_IDS_V1.every(id=>tools.get(id)!==null)).toBe(true)

    expectOk(await tools.invoke('promotion.create_candidate',{candidateId:'promotion:project-a',workspaceId:'promotion-workspace:project-a',targetKinds:['scene','motion-recipe']}))
    expectOk(await tools.invoke('promotion.propose_parameters',{planId:'parameters:project-a'}))
    expectOk(await tools.invoke('promotion.set_target_kind',{targetKind:'scene',idempotencyKey:'target-scene'}))
    expectOk(await tools.invoke('promotion.productize',{id:'promoted.metric-story',title:'Promoted Metric Story',description:'Reusable metric story from approved Project A.',registrationVersion:1}))
    const qa=await tools.invoke('promotion.validate',{replacementValues:{'content.headline':'Retention improved','content.metric':'82%','content.supporting-label':'Customer retention','style.accent':'#FF7A1A','media.hero-media':'asset://project-b/retention','motion.intensity':1},durationTicks:1_440_000,ticksPerSecond:1_440_000,composition:{width:1920,height:1080,fpsNumerator:30,fpsDenominator:1},sampleTicks:[0,360_000,720_000,1_200_000]});expectOk(qa);if(qa.ok)expect(qa.value).toMatchObject({ok:true})
    expectOk(await tools.invoke('promotion.register',{confirmation:{schemaVersion:'sanverse.promotion-registration-confirmation/v1',id:'promotion-confirmation:project-a',candidateId:'promotion:project-a',candidateRevision:1,authority:'system-policy',confirmedAt:'2026-08-26T09:10:00.000Z'},artifacts:{posterRef:'frame://promoted/default',reviewRef:'review://promoted/default/1x'}}))

    const retrieved=await tools.invoke('promotion.retrieve',{communicationGoal:'metric-payoff',presentationMode:'full-screen-motion',ratio:'16:9',styleTraits:['structured'],requiredEditability:'full',allowedLibraryScopes:['generated'],requiredCapabilities:[]});expectOk(retrieved)
    if(!retrieved.ok)throw new Error('retrieval failed')
    const ranked=retrieved.value as readonly Readonly<{capabilityId:string;score:number;reasons:readonly string[]}>[]
    expect(ranked[0]?.capabilityId).toBe('promoted.metric-story');expect(ranked[0]?.reasons.length).toBeGreaterThan(1)

    expectOk(await tools.invoke('capability.instantiate',{capabilityId:'promoted.metric-story',sandboxId:'reuse:project-b',instanceId:'instance:project-b'}))
    const ctx={sandboxId:'reuse:project-b'} as const
    expect(await tools.invoke('capability.set_parameter',{publicPath:'content.headline',value:'Retention improved',expectedSandboxRevision:99},ctx)).toMatchObject({ok:false,refusal:{code:'STALE_CAPABILITY_REUSE_REVISION'}})
    expectOk(await tools.invoke('capability.set_parameter',{publicPath:'content.headline',value:'Retention improved',expectedSandboxRevision:1},ctx))
    expectOk(await tools.invoke('capability.set_parameter',{publicPath:'content.metric',value:'82%',expectedSandboxRevision:2},ctx))
    expectOk(await tools.invoke('capability.set_parameter',{publicPath:'content.supporting-label',value:'Customer retention',expectedSandboxRevision:3},ctx))
    expectOk(await tools.invoke('capability.apply_style_lock',{lock:{accent:'#FF7A1A',primaryText:'#FFF7ED',secondaryText:'#FED7AA'},expectedSandboxRevision:4},ctx))
    expectOk(await tools.invoke('recipe.apply',{recipeApplicationId:'recipe-use:project-b',storyboardId:'storyboard:b',storyboardApprovedRevision:4,animaticId:'animatic:b',animaticApprovedRevision:3,roleBindings:{HEADLINE:['headline'],SUPPORTING_ITEMS:['label'],PAYOFF_METRIC:['metric'],PRIMARY_HERO:['surface']},expectedSandboxRevision:5},ctx))

    const reuseQa=await tools.invoke('capability.validate',{durationTicks:1_440_000,ticksPerSecond:1_440_000,composition:{width:1920,height:1080,fpsNumerator:30,fpsDenominator:1},sampleTicks:[0,180_000,360_000,720_000,1_000_000,1_200_000],expectedSemanticNodeIds:['headline','metric','label','surface','media'],requiredCapabilities:[],availableCapabilities:[]},ctx);expectOk(reuseQa);if(reuseQa.ok)expect(reuseQa.value).toMatchObject({ok:true})
    expectOk(await tools.invoke('capability.render_review',{},ctx))
    const reuseState=promotion.getState().reuseSandbox!;const draft=reuseState.motionDraft
    expect(draft.scene.nodes.headline?.type==='text'&&draft.scene.nodes.headline.text).toEqual(constant('Retention improved'))
    expect(draft.scene.nodes.metric?.type==='text'&&draft.scene.nodes.metric.text).toEqual(constant('82%'))
    expect(draft.scene.nodes.metric?.type==='text'&&draft.scene.nodes.metric.fillColor).toEqual(constant('#FF7A1A'))
    const immutableSource=source().scene.nodes.headline
    expect(immutableSource?.type==='text'&&immutableSource.text).toEqual(constant('Revenue grew'))

    const nodeId='metric'
    expect(projectMotionLayers({scene:draft.scene}).layersById[nodeId]?.nodeId).toBe(nodeId)
    expect(projectMotionDopeSheet(draft.scene).layers.some(layer=>layer.nodeId===nodeId&&layer.tracks.length>0)).toBe(true)
    expect(projectMotionCurves(draft.scene).tracks.some(track=>track.nodeId===nodeId)).toBe(true)
    expect(deriveNodeGraphProjection(draft.scene).nodes.some(node=>node.nodeId===nodeId)).toBe(true)
    expect(draft.scene.nodes[draft.scene.rootNodeId]?.type==='group'&&(draft.scene.nodes[draft.scene.rootNodeId] as {componentInstance?:{instanceId:string}}).componentInstance?.instanceId).toBe('instance:project-b')

    expect(await tools.invoke('capability.record_owner_approval',{approval:{schemaVersion:'sanverse.owner-approval/v1',id:'fake-client-approval',scope:'motion',subjectId:'reuse:project-b',subjectRevision:draft.revision+1,status:'owner-approved',approvedAt:'2026-08-26T09:20:00.000Z'}},ctx)).toMatchObject({ok:false,refusal:{code:'APPROVAL_REVISION_MISMATCH'}})
    expectOk(await tools.invoke('capability.record_owner_approval',{approval:{schemaVersion:'sanverse.owner-approval/v1',id:'approval:project-b-reuse',scope:'motion',subjectId:'reuse:project-b',subjectRevision:draft.revision,status:'owner-approved',approvedAt:'2026-08-26T09:21:00.000Z'}},ctx))
    expectOk(await tools.invoke('capability.apply_reuse',{},ctx));expect(promotion.getState().acceptedProject.revision).toBe(21);expect(promotion.getState().acceptedProject.scene.nodes.metric).toBeDefined()
    expectOk(await tools.invoke('capability.undo_reuse',{}));expect(promotion.getState().acceptedProject.revision).toBe(22);expect(promotion.getState().acceptedProject.scene).toEqual(originalB)
  })
})
