import type { MotionFixtureV1 } from '@sanverse/motion-contract'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import type { KineticHeadlineProps, KineticHeadlineStyle } from '../components/kinetic-headline.tsx'
import { kineticHeadlineStyleFromPack } from '../components/kinetic-headline.tsx'
import { MOTION_REFERENCE_COMPOSITIONS } from '../reference-compositions.ts'
import { CREATOR_ENERGETIC_STYLE, SANVERSE_CLEAN_STYLE } from '../style-packs.ts'

const defaultDuration=SANVERSE_TICKS_PER_SECOND*3
const defaultSamples=Object.freeze([0,Math.round(defaultDuration*.12),Math.round(defaultDuration*.30),Math.round(defaultDuration*.58),Math.round(defaultDuration*.90)])
const fixture=(id:string,name:string,props:KineticHeadlineProps,style:KineticHeadlineStyle,ratio:keyof typeof MOTION_REFERENCE_COMPOSITIONS='16:9',reducedMotion=false,durationTicks=defaultDuration):MotionFixtureV1<KineticHeadlineProps,KineticHeadlineStyle>=>Object.freeze({id,name,componentId:'sanverse.kinetic-headline',props:Object.freeze(props),style:Object.freeze(style),composition:MOTION_REFERENCE_COMPOSITIONS[ratio],durationTicks,sampleTicks:durationTicks===defaultDuration?defaultSamples:Object.freeze([0,Math.round(durationTicks/2),durationTicks]),reducedMotion,background:'black'})
const clean=kineticHeadlineStyleFromPack(SANVERSE_CLEAN_STYLE)
const energetic=kineticHeadlineStyleFromPack(CREATOR_ENERGETIC_STYLE)
export const KINETIC_HEADLINE_FIXTURES=Object.freeze([
fixture('headline-one-word','One word',{text:'Momentum',emphasisIndices:[0],alignment:'center',maxLines:1},clean),
fixture('headline-three-word','Three words',{text:'Build Better Videos',emphasisIndices:[1],alignment:'center',maxLines:2},clean),
fixture('headline-long-text','Long text',{text:'Turn a dense idea into one clear visual moment without losing the point',emphasisIndices:[6,7],alignment:'left',maxLines:3},clean),
fixture('headline-duplicate-word','Duplicate word',{text:'AI makes AI easier',emphasisIndices:[2],alignment:'center',maxLines:2},energetic),
fixture('headline-unicode','Unicode',{text:'创作 أسرع — build 10× faster 🚀',emphasisIndices:[3,4],alignment:'center',maxLines:3},energetic),
fixture('headline-landscape','Landscape',{text:'Build videos 10× faster',emphasisIndices:[2],alignment:'center',maxLines:2},clean,'16:9'),
fixture('headline-portrait','Portrait',{text:'Build videos 10× faster',emphasisIndices:[2],alignment:'center',maxLines:3},clean,'9:16'),
fixture('headline-square','Square',{text:'Build videos 10× faster',emphasisIndices:[2],alignment:'center',maxLines:3},clean,'1:1'),
fixture('headline-4x5','4:5',{text:'Build videos 10× faster',emphasisIndices:[2],alignment:'center',maxLines:3},clean,'4:5'),
fixture('headline-clean-style','Clean style',{text:'Clarity beats complexity',emphasisIndices:[0],alignment:'left',maxLines:2},clean),
fixture('headline-energetic-style','Energetic style',{text:'Make the hook hit',emphasisIndices:[3],alignment:'center',maxLines:2},energetic),
fixture('headline-reduced-motion','Reduced motion',{text:'Motion with restraint',emphasisIndices:[2],alignment:'center',maxLines:2},clean,'16:9',true),
fixture('headline-min-duration','Minimum duration',{text:'Fast reveal',emphasisIndices:[0],alignment:'center',maxLines:1},energetic,'16:9',false,SANVERSE_TICKS_PER_SECOND),
fixture('headline-max-duration','Maximum duration',{text:'Hold the key idea',emphasisIndices:[2],alignment:'center',maxLines:2},clean,'16:9',false,SANVERSE_TICKS_PER_SECOND*12),
])
