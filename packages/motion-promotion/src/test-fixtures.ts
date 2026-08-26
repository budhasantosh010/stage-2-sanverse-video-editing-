import { constant,createMotionScene,keyframed,nodeBase,type MotionSceneV1 } from '@sanverse/motion-graph'
import type { MotionPlanV1 } from '@sanverse/creative-direction'
import type { OwnerApprovalV1 } from '@sanverse/motion-storyboard'
import type { PromotionSourceV1 } from './contracts.ts'

export const promotionProofScene=():MotionSceneV1=>createMotionScene({
  componentId:'sanverse.generated-metric-story',componentVersion:1,rootNodeId:'root',
  nodes:Object.freeze({
    root:Object.freeze({...nodeBase('root','Metric Story',null),type:'group' as const,childIds:Object.freeze(['surface','headline','metric','label','media'])}),
    surface:Object.freeze({...nodeBase('surface','Hero Surface','root'),type:'shape' as const,shape:'rounded-rectangle' as const,width:constant(1100),height:constant(520),fillColor:constant('#10141A'),strokeColor:constant('#2D3742'),strokeWidth:constant(2),radius:constant(40)}),
    headline:Object.freeze({...nodeBase('headline','Headline','root'),type:'text' as const,text:constant('Revenue grew'),fillColor:constant('#FFFFFF'),fontFamily:'Inter',fontSize:constant(72),fontWeight:constant(800),textAlign:'left' as const,opacity:keyframed(Object.freeze([{id:'headline:o0',tick:0,value:0,interpolation:'linear' as const},{id:'headline:o1',tick:360_000,value:1,interpolation:'bezier' as const,bezier:{inX:.7,inY:1,outX:.2,outY:.8}}])),transform:Object.freeze({...nodeBase('headline','Headline','root').transform,positionY:keyframed(Object.freeze([{id:'headline:y0',tick:0,value:60,interpolation:'linear' as const},{id:'headline:y1',tick:360_000,value:0,interpolation:'bezier' as const,bezier:{inX:.7,inY:1,outX:.2,outY:.8}}]))}),}),
    metric:Object.freeze({...nodeBase('metric','Primary Metric','root'),type:'text' as const,text:constant('68%'),fillColor:constant('#4A74FF'),fontFamily:'Inter',fontSize:constant(144),fontWeight:constant(900),textAlign:'left' as const,opacity:keyframed(Object.freeze([{id:'metric:o0',tick:240_000,value:0,interpolation:'linear' as const},{id:'metric:o1',tick:720_000,value:1,interpolation:'bezier' as const,bezier:{inX:.7,inY:1,outX:.2,outY:.8}}]))}),
    label:Object.freeze({...nodeBase('label','Supporting Label','root'),type:'text' as const,text:constant('Quarter over quarter'),fillColor:constant('#C7CED8'),fontFamily:'Inter',fontSize:constant(42),fontWeight:constant(600),textAlign:'left' as const}),
    media:Object.freeze({...nodeBase('media','Hero Media','root'),type:'image' as const,source:'asset://project-a/hero',width:constant(360),height:constant(240),fit:'cover' as const,imageOpacity:constant(1)}),
  }),
  semanticParts:Object.freeze([
    {id:'hero',label:'Hero',role:'content-group' as const,nodeIds:Object.freeze(['headline','metric','label'])},
    {id:'metric',label:'Metric',role:'value' as const,nodeIds:Object.freeze(['metric'])},
    {id:'surface',label:'Surface',role:'surface' as const,nodeIds:Object.freeze(['surface'])},
    {id:'media',label:'Media',role:'content-group' as const,nodeIds:Object.freeze(['media'])},
  ]),
  exposures:Object.freeze([
    {id:'headline.content',label:'Headline',group:'Content' as const,level:'creator' as const,target:{kind:'node' as const,nodeId:'headline',property:'text.text' as const},editor:{type:'text' as const},keyframeable:false},
    {id:'metric.content',label:'Metric',group:'Content' as const,level:'creator' as const,target:{kind:'node' as const,nodeId:'metric',property:'text.text' as const},editor:{type:'text' as const},keyframeable:false},
    {id:'metric.accent',label:'Accent',group:'Style' as const,level:'designer' as const,target:{kind:'node' as const,nodeId:'metric',property:'text.fillColor' as const},editor:{type:'color' as const},keyframeable:false},
  ]),
  layout:Object.freeze({mode:'responsive' as const,ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),
  supportedAspectRatios:Object.freeze(['16:9','9:16','1:1','4:5'] as const),
})

export const promotionProofMotionPlan=():MotionPlanV1=>Object.freeze({id:'motion-plan:project-a',storyboardId:'storyboard:project-a',storyboardApprovedRevision:2,animaticId:'animatic:project-a',animaticApprovedRevision:2,revision:1,beats:Object.freeze([
  Object.freeze({id:'beat:establish',purpose:'establish' as const,startTick:0,endTick:360_000,nodeIds:Object.freeze(['headline']),operationIntents:Object.freeze([{id:'intent:headline',type:'motion.enter' as const,nodeIds:Object.freeze(['headline']),startTick:0,endTick:360_000}])}),
  Object.freeze({id:'beat:build',purpose:'build' as const,startTick:360_000,endTick:720_000,nodeIds:Object.freeze(['label']),operationIntents:Object.freeze([{id:'intent:label',type:'motion.fade' as const,nodeIds:Object.freeze(['label']),startTick:360_000,endTick:720_000}])}),
  Object.freeze({id:'beat:payoff',purpose:'payoff' as const,startTick:720_000,endTick:1_200_000,nodeIds:Object.freeze(['metric']),operationIntents:Object.freeze([{id:'intent:metric',type:'motion.scale' as const,nodeIds:Object.freeze(['metric']),startTick:720_000,endTick:1_200_000,parameters:Object.freeze({from:0.92,to:1})}])}),
  Object.freeze({id:'beat:hold',purpose:'hold' as const,startTick:1_200_000,endTick:1_440_000,nodeIds:Object.freeze(['headline','metric','label']),operationIntents:Object.freeze([{id:'intent:hold',type:'motion.insert-hold' as const,nodeIds:Object.freeze(['headline','metric','label']),startTick:1_200_000,endTick:1_440_000}])}),
])})

export const promotionApproval=(revision=1):OwnerApprovalV1=>Object.freeze({schemaVersion:'sanverse.owner-approval/v1',id:`approval:motion:r${revision}`,scope:'motion',subjectId:'motion-draft:project-a',subjectRevision:revision,status:'owner-approved',approvedAt:'2026-08-26T00:00:00.000Z'})

export const promotionSource=(overrides:Partial<PromotionSourceV1>={}):PromotionSourceV1=>Object.freeze({
  schemaVersion:'sanverse.promotion-source/v1',sourceProjectId:'project:a',sourceProjectRevision:12,sourceSceneId:'motion-draft:project-a',sourceSceneRevision:1,scene:promotionProofScene(),sourceStoryboardId:'storyboard:project-a',sourceStoryboardRevision:2,sourceAnimaticId:'animatic:project-a',sourceAnimaticRevision:2,sourceMotionPlanId:'motion-plan:project-a',sourceMotionPlanRevision:1,motionPlan:promotionProofMotionPlan(),motionApproval:promotionApproval(1),structuralQaPassed:true,visualReviewEvidence:Object.freeze({canonicalReviewRef:'review://project-a/1x',posterRef:'frame://project-a/poster',criticalFrameRefs:Object.freeze(['frame://a/0','frame://a/payoff','frame://a/end'])}),origin:'generated',dependencies:Object.freeze([{id:'asset:hero',origin:'generated' as const,reusePermission:'global' as const,runtimeAssetOwned:true}]),...overrides,
})
