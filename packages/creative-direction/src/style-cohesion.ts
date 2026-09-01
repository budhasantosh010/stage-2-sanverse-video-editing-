import { creativeOperationOk,creativeOperationRefusal,type CreativeOperationResultV1,type MotionPresentationModeV1 } from '@sanverse/motion-contract'

export interface StyleIntelligenceInputV1 {
  readonly brand:Readonly<{palette:readonly string[];typeFamily?:string;traits:readonly string[]}>
  readonly existingStyle:Readonly<{accent?:string;surface?:string;primaryText?:string;radius?:number;motionIntensity?:number;overshootAllowance?:number;density?:'low'|'medium'|'high'}>
  readonly approvedAssetSignals:readonly Readonly<{motionIntensity?:number;overshoot?:number;density?:'low'|'medium'|'high';surface?:string}>[]
  readonly promotedAssetSignals:readonly Readonly<{motionIntensity?:number;overshoot?:number;density?:'low'|'medium'|'high'}>[]
  readonly videoContext:Readonly<{talkingHead:boolean;informationDensity:'low'|'medium'|'high';negativeSpace:'low'|'medium'|'high'|'unknown';subjectPriority:'low'|'medium'|'high'}>
  readonly locked:boolean
  readonly explicitStyleRevision?:boolean
}
export interface StyleLockRecommendationV1 {
  readonly schemaVersion:'sanverse.style-lock-recommendation/v1'
  readonly visual:Readonly<{paletteRoles:Readonly<{background:string;surface:string;text:string;accent:string}>;typeFamily?:string;radius:number;stroke:number;shadow:number;depth:number;texture:'none'|'subtle'}>
  readonly motion:Readonly<{baseTiming:'calm'|'balanced'|'energetic';primaryEase:'soft'|'snappy';secondaryEase:'soft'|'linear';overshootAllowance:number;travelDistance:number;staggerRhythm:number;holdDiscipline:'short'|'balanced'|'long';cameraAggressiveness:number;effectIntensity:number}>
  readonly composition:Readonly<{density:'low'|'medium'|'high';alignment:'editorial'|'centered'|'adaptive';safeArea:number;negativeSpacePreference:'preserve'|'adaptive';subjectPriority:'low'|'medium'|'high'}>
  readonly reasons:readonly string[]
}
const avg=(values:readonly number[],fallback:number)=>values.length?values.reduce((a,b)=>a+b,0)/values.length:fallback
const densityRank=(d:'low'|'medium'|'high')=>d==='low'?0:d==='medium'?1:2
const densityAt=(rank:number):'low'|'medium'|'high'=>rank<.67?'low':rank<1.5?'medium':'high'
export const recommendStyleLockV1=(input:StyleIntelligenceInputV1):CreativeOperationResultV1<StyleLockRecommendationV1>=>{
  if(input.locked&&!input.explicitStyleRevision)return creativeOperationRefusal('STYLE_LOCKED','B6 cannot silently revise an existing locked style. Start an explicit style revision first.')
  if(input.brand.palette.length<2)return creativeOperationRefusal('STYLE_INPUT_INSUFFICIENT','B6 requires at least background/surface and accent-capable brand colors.')
  const signals=[...input.approvedAssetSignals,...input.promotedAssetSignals]
  const intensity=avg(signals.flatMap(s=>s.motionIntensity===undefined?[]:[s.motionIntensity]),input.existingStyle.motionIntensity??.45)
  const overshoot=avg(signals.flatMap(s=>s.overshoot===undefined?[]:[s.overshoot]),input.existingStyle.overshootAllowance??.12)
  const densitySignals=signals.flatMap(s=>s.density?[densityRank(s.density)]:[])
  let density=densityAt(avg(densitySignals,densityRank(input.existingStyle.density??'medium')))
  const reasons:string[]=[]
  if(input.videoContext.talkingHead&&input.videoContext.informationDensity==='high'){density='low';reasons.push('Talking-head source has high information density, so graphic density is reduced to protect comprehension.')}
  if(overshoot<=.15)reasons.push('Approved/promoted asset evidence uses restrained overshoot, so motion language stays calm and controlled.')
  if(input.brand.traits.some(t=>/editorial|restrained|clean/iu.test(t)))reasons.push('Brand traits call for restrained editorial surface and motion language.')
  if(input.videoContext.subjectPriority==='high')reasons.push('High subject priority keeps safe area and negative space biased toward the speaker.')
  const palette=input.brand.palette
  return creativeOperationOk(Object.freeze({schemaVersion:'sanverse.style-lock-recommendation/v1',visual:Object.freeze({paletteRoles:Object.freeze({background:palette[0]!,surface:input.existingStyle.surface??palette[0]!,text:input.existingStyle.primaryText??'#ffffff',accent:input.existingStyle.accent??palette[1]!}),...(input.brand.typeFamily?{typeFamily:input.brand.typeFamily}:{}),radius:input.existingStyle.radius??16,stroke:1,shadow:.22,depth:.18,texture:'none'}),motion:Object.freeze({baseTiming:intensity<.4?'calm':intensity>.7?'energetic':'balanced',primaryEase:intensity>.7?'snappy':'soft',secondaryEase:intensity>.7?'linear':'soft',overshootAllowance:Math.max(0,Math.min(.4,overshoot)),travelDistance:Math.round(24+intensity*56),staggerRhythm:Number((.08+(1-intensity)*.1).toFixed(3)),holdDiscipline:input.videoContext.informationDensity==='high'?'long':'balanced',cameraAggressiveness:Number((intensity*.6).toFixed(3)),effectIntensity:Number((intensity*.7).toFixed(3))}),composition:Object.freeze({density,alignment:'adaptive',safeArea:input.videoContext.subjectPriority==='high'?.1:.07,negativeSpacePreference:input.videoContext.negativeSpace==='high'?'preserve':'adaptive',subjectPriority:input.videoContext.subjectPriority}),reasons:Object.freeze(reasons.length?reasons:['Recommendation preserves the current approved style signals because no stronger contextual pressure was found.'])}),1)
}

export interface VideoCreativeLanguageV1 { readonly schemaVersion:'sanverse.video-creative-language/v1'; readonly id:string; readonly version:number; readonly styleLockId:string; readonly preferredPresentationModes:readonly MotionPresentationModeV1[]; readonly typographyLanguage:'editorial'|'interface'|'expressive'; readonly surfaceLanguage:'flat'|'soft-depth'|'high-depth'; readonly motionRhythm:'calm'|'balanced'|'energetic'; readonly transitionVocabulary:readonly ('cut'|'fade'|'slide'|'scale'|'mask')[]; readonly densityPolicy:'low'|'medium'|'high'; readonly cameraPolicy:'static'|'restrained'|'expressive'; readonly paletteRoles:readonly string[]; readonly easingFamily:readonly ('soft'|'linear'|'snappy')[]; readonly overshootMax:number; readonly allowedExceptions:readonly Readonly<{sceneId:string;reason:string;dimensions:readonly CohesionDimensionV1[]}>[] }
export type CohesionDimensionV1='palette'|'type'|'surface'|'motion-timing'|'easing'|'overshoot'|'density'|'presentation-mode'|'transition'
export interface SceneCreativeSignatureV1 { readonly sceneId:string; readonly paletteRoles:readonly string[]; readonly typographyLanguage:VideoCreativeLanguageV1['typographyLanguage']; readonly surfaceLanguage:VideoCreativeLanguageV1['surfaceLanguage']; readonly motionRhythm:VideoCreativeLanguageV1['motionRhythm']; readonly easing:'soft'|'linear'|'snappy'; readonly overshoot:number; readonly density:'low'|'medium'|'high'; readonly presentationMode:MotionPresentationModeV1; readonly transition:'cut'|'fade'|'slide'|'scale'|'mask' }
export interface CohesionScoreV1 { readonly level:'HIGH'|'MEDIUM'|'LOW'; readonly score:number; readonly reasons:readonly string[]; readonly exceptionApplied:boolean }
export const scoreSceneCohesionV1=(language:VideoCreativeLanguageV1,scene:SceneCreativeSignatureV1):CohesionScoreV1=>{
  const exception=language.allowedExceptions.find(e=>e.sceneId===scene.sceneId);const exempt=new Set(exception?.dimensions??[]);const failures:string[]=[];let checks=0,passes=0
  const check=(dimension:CohesionDimensionV1,ok:boolean,message:string)=>{if(exempt.has(dimension))return;checks+=1;if(ok)passes+=1;else failures.push(message)}
  check('palette',scene.paletteRoles.every(role=>language.paletteRoles.includes(role)),'Scene uses palette roles outside the video language.')
  check('type',scene.typographyLanguage===language.typographyLanguage,'Typography language differs from the video language.')
  check('surface',scene.surfaceLanguage===language.surfaceLanguage,'Surface language differs from the video language.')
  check('motion-timing',scene.motionRhythm===language.motionRhythm,'Motion rhythm differs from the video language.')
  check('easing',language.easingFamily.includes(scene.easing),'Easing family is outside the approved vocabulary.')
  check('overshoot',scene.overshoot<=language.overshootMax,'Overshoot exceeds the video language maximum.')
  check('density',scene.density===language.densityPolicy,'Graphic density differs from the video language.')
  check('presentation-mode',language.preferredPresentationModes.includes(scene.presentationMode),'Presentation mode is not preferred for this video.')
  check('transition',language.transitionVocabulary.includes(scene.transition),'Transition is outside the video vocabulary.')
  const score=checks===0?1:passes/checks;return Object.freeze({level:score>=.8?'HIGH':score>=.55?'MEDIUM':'LOW',score:Number(score.toFixed(3)),reasons:Object.freeze([...(exception?[`Deliberate scene exception: ${exception.reason}`]:[]),...failures]),exceptionApplied:Boolean(exception)})
}
