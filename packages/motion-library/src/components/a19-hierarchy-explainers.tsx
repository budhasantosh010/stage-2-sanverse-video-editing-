import type { CSSProperties, ReactNode } from 'react'
import type { MotionRenderContextV1, MotionValidationResultV1 } from '@sanverse/motion-contract'
import type { MotionExposureV1, MotionNodeV1, MotionSceneV1, ResolvedMotionSceneV1 } from '@sanverse/motion-graph'
import { constant, createMotionScene, keyframed } from '@sanverse/motion-graph'
import { SANVERSE_TICKS_PER_SECOND, normalizedProgress } from '@sanverse/motion-primitives'
import { mergeMotionGraphNodeStyle } from '@sanverse/motion-native-runtime'
import { FULL_NATIVE_GRAPH_CAPABILITIES, graphGroup, graphPath, graphShape, graphText, responsiveGraphLayout } from '../graph-common.ts'
import { isRecord, unknownFieldIssues, validationFailure, validationSuccess, valueIssue } from '../validation.ts'
import type { FamilyComponentProps, FamilyComponentStyle, FamilyVariantConfig } from './component-families.tsx'

export type A19HierarchyVariant = 'decision-tree' | 'swimlane' | 'journey-map' | 'priority-matrix' | 'value-chain' | 'layer-stack' | 'ecosystem-map' | 'dependency-map'

interface ParsedRow {
  readonly id: string
  readonly fields: readonly string[]
  readonly raw: string
}

const stableId = /^[a-z][a-z0-9-]{0,31}$/u
const prefixFor = (config: FamilyVariantConfig) => `a19.${config.id.replace(/^sanverse\./u, '')}`
const isA19Variant = (variant: string): variant is A19HierarchyVariant => A19_VARIANTS.has(variant)
const A19_VARIANTS = new Set<string>(['decision-tree','swimlane','journey-map','priority-matrix','value-chain','layer-stack','ecosystem-map','dependency-map'])

export const A19_HIERARCHY_COMPONENT_IDS = Object.freeze([
  'sanverse.decision-tree',
  'sanverse.swimlane-process',
  'sanverse.journey-map',
  'sanverse.priority-matrix',
  'sanverse.value-chain',
  'sanverse.layer-stack-explainer',
  'sanverse.ecosystem-regions-map',
  'sanverse.dependency-map',
] as const)

export const A19_HIERARCHY_CONFIGS = Object.freeze([
  { id:'sanverse.decision-tree', name:'Decision Tree', purpose:'Explain branching yes/no logic, qualification and decision outcomes.', family:'diagram', variant:'decision-tree', eyebrow:'DECISION LOGIC', title:'Should this step be automated?', subtitle:'Follow the branch that matches the kind of judgment required.', value:'manual', items:['root|question|Does it repeat?|none|','repeat|decision|Same inputs each time?|root|YES','automate|result|Automate|repeat|YES','review|result|Human review|repeat|NO','manual|result|Keep manual|root|NO'], minDurationSeconds:1.5, defaultDurationSeconds:4.5, maxDurationSeconds:12, events:[{name:'title-revealed',normalizedTime:.08},{name:'root-revealed',normalizedTime:.18},{name:'branches-revealed',normalizedTime:.42},{name:'active-path-complete',normalizedTime:.68},{name:'settled',normalizedTime:.76},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.swimlane-process', name:'Swimlane Process', purpose:'Explain team, department or AI-agent responsibility and handoffs across lanes.', family:'diagram', variant:'swimlane', eyebrow:'SWIMLANE', title:'From signal to published asset', subtitle:'Each lane owns a different kind of work.', value:'review', items:['research|Research|gather:Gather,verify:Verify,score:Score','editing|Editing|assemble:Assemble,polish:Polish','review|Review|approve:Approve,publish:Publish'], minDurationSeconds:1.5, defaultDurationSeconds:5, maxDurationSeconds:12, events:[{name:'title-revealed',normalizedTime:.06},{name:'lanes-revealed',normalizedTime:.18},{name:'steps-revealed',normalizedTime:.38},{name:'handoffs-revealed',normalizedTime:.62},{name:'settled',normalizedTime:.76},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.journey-map', name:'Journey Map', purpose:'Show a customer, creator or product journey as staged progression with context and optional metrics.', family:'diagram', variant:'journey-map', eyebrow:'JOURNEY', title:'From stranger to advocate', subtitle:'Each stage changes the question the user is asking.', value:'activate', items:['discover|Discover|Find the problem|12K reach','evaluate|Evaluate|Compare approaches|32% engaged','activate|Activate|Get first result|18% started','retain|Retain|Repeat the habit|71% retained','advocate|Advocate|Share the result|24% referred'], minDurationSeconds:1.5, defaultDurationSeconds:5, maxDurationSeconds:12, events:[{name:'title-revealed',normalizedTime:.06},{name:'stage-1',normalizedTime:.18},{name:'stage-2',normalizedTime:.30},{name:'stage-3',normalizedTime:.42},{name:'active-stage',normalizedTime:.58},{name:'settled',normalizedTime:.76},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.priority-matrix', name:'Priority Matrix', purpose:'Map choices across two decision axes such as impact/effort or urgency/importance.', family:'diagram', variant:'priority-matrix', eyebrow:'PRIORITY MATRIX', title:'What should we do first?', subtitle:'Impact rises upward. Effort rises to the right.', value:'must', items:['must|high-low|Fix the hook','bet|high-high|Build the new format','quick|low-low|Polish the CTA','avoid|low-high|Rebuild everything'], minDurationSeconds:1.5, defaultDurationSeconds:4.5, maxDurationSeconds:12, events:[{name:'axes-revealed',normalizedTime:.10},{name:'quadrants-revealed',normalizedTime:.24},{name:'items-revealed',normalizedTime:.46},{name:'priority-highlighted',normalizedTime:.64},{name:'settled',normalizedTime:.76},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.value-chain', name:'Value Chain', purpose:'Explain how inputs are transformed stage by stage into an outcome customers value.', family:'diagram', variant:'value-chain', eyebrow:'VALUE CHAIN', title:'How raw signals become business value', subtitle:'Each stage adds something the next stage can trust.', value:'publish', items:['signal|Signals|Raw sources|Interesting evidence','verify|Verify|Uncertain claims|Trusted evidence','package|Package|Trusted evidence|Clear angle','publish|Publish|Clear angle|Useful asset','learn|Learn|Audience response|Next signal'], minDurationSeconds:1.5, defaultDurationSeconds:5, maxDurationSeconds:12, events:[{name:'inputs-revealed',normalizedTime:.10},{name:'stage-1',normalizedTime:.22},{name:'stage-2',normalizedTime:.34},{name:'stage-3',normalizedTime:.46},{name:'outcome-revealed',normalizedTime:.66},{name:'settled',normalizedTime:.78},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.layer-stack-explainer', name:'Layer Stack Explainer', purpose:'Explain technology, product or system architecture as an ordered stack of layers.', family:'diagram', variant:'layer-stack', eyebrow:'SYSTEM STACK', title:'What the product is actually made of', subtitle:'Higher layers depend on the layers below them.', value:'application', items:['experience|Experience|Creator interface','application|Application|Workflow logic','services|Services|Search + rendering','data|Data|Projects + evidence','infrastructure|Infrastructure|Storage + compute'], minDurationSeconds:1.5, defaultDurationSeconds:4.5, maxDurationSeconds:12, events:[{name:'base-revealed',normalizedTime:.12},{name:'layer-2',normalizedTime:.24},{name:'layer-3',normalizedTime:.36},{name:'layer-4',normalizedTime:.48},{name:'top-revealed',normalizedTime:.60},{name:'settled',normalizedTime:.76},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.ecosystem-regions-map', name:'Ecosystem Regions Map', purpose:'Show a platform ecosystem as categorized regions around a core rather than one undifferentiated network.', family:'diagram', variant:'ecosystem-map', eyebrow:'ECOSYSTEM', title:'Who creates value around the platform?', subtitle:'Regions make each relationship category explicit.', value:'core', items:['core|Core|Sanverse','partners|Partners|Agency,Consultant,Creator','customers|Customers|Founder,Team,Brand','infrastructure|Infrastructure|Storage,Models,Render'], minDurationSeconds:1.5, defaultDurationSeconds:5, maxDurationSeconds:12, events:[{name:'core-revealed',normalizedTime:.12},{name:'regions-revealed',normalizedTime:.28},{name:'members-revealed',normalizedTime:.48},{name:'connections-revealed',normalizedTime:.64},{name:'settled',normalizedTime:.78},{name:'exit-start',normalizedTime:.92}] },
  { id:'sanverse.dependency-map', name:'Dependency Map', purpose:'Show prerequisite relationships and blockers between deliverables or system capabilities.', family:'diagram', variant:'dependency-map', eyebrow:'DEPENDENCIES', title:'What has to exist before publish?', subtitle:'A dependency graph answers what is blocked by what.', value:'publish', items:['research|Research|none','brief|Brief|research','script|Script|research,brief','edit|Edit|script','review|Review|edit','publish|Publish|review'], minDurationSeconds:1.5, defaultDurationSeconds:5, maxDurationSeconds:12, events:[{name:'roots-revealed',normalizedTime:.10},{name:'dependencies-revealed',normalizedTime:.34},{name:'critical-path',normalizedTime:.58},{name:'settled',normalizedTime:.78},{name:'exit-start',normalizedTime:.92}] },
] satisfies readonly FamilyVariantConfig[])

export const isA19HierarchyConfig = (config: FamilyVariantConfig): boolean => isA19Variant(config.variant)

const parseRows = (props: FamilyComponentProps): readonly ParsedRow[] => Object.freeze(props.items.map((raw) => {
  const [id = '', ...fields] = raw.split('|').map((part) => part.trim())
  return Object.freeze({ id, fields: Object.freeze(fields), raw })
}))

const commonPropsValidation = (input: unknown): MotionValidationResultV1<FamilyComponentProps> => {
  if (!isRecord(input)) return validationFailure(valueIssue('$','TYPE_INVALID','Hierarchy component props must be an object.'))
  const issues=[...unknownFieldIssues(input,['eyebrow','title','subtitle','value','items'])]
  const stringBound=(value:unknown,min:number,max:number)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max
  if(!stringBound(input.eyebrow,0,32))issues.push(valueIssue('$.eyebrow','VALUE_INVALID','eyebrow is limited to 32 characters.'))
  if(!stringBound(input.title,1,96))issues.push(valueIssue('$.title','VALUE_INVALID','title must contain 1–96 characters.'))
  if(!stringBound(input.subtitle,0,160))issues.push(valueIssue('$.subtitle','VALUE_INVALID','subtitle is limited to 160 characters.'))
  if(!stringBound(input.value,0,32))issues.push(valueIssue('$.value','VALUE_INVALID','value/active ID is limited to 32 characters.'))
  if(!Array.isArray(input.items)||input.items.length<2||input.items.length>12||input.items.some((item)=>!stringBound(item,3,120)))issues.push(valueIssue('$.items','VALUE_INVALID','structured data must contain 2–12 rows of 3–120 characters.'))
  if(issues.length)return validationFailure(...issues)
  return validationSuccess(Object.freeze({eyebrow:input.eyebrow as string,title:input.title as string,subtitle:input.subtitle as string,value:input.value as string,items:Object.freeze([...(input.items as string[])])}))
}

const variantRange = (variant:A19HierarchyVariant):readonly [number,number] => variant==='decision-tree'?[3,10]:variant==='swimlane'?[2,5]:variant==='priority-matrix'?[4,8]:variant==='ecosystem-map'?[3,6]:[3,10]

const hasReferenceCycle=(rows:readonly ParsedRow[],referencesFor:(row:ParsedRow)=>readonly string[]):boolean=>{
  const byId=new Map(rows.map(row=>[row.id,row] as const));const visiting=new Set<string>();const complete=new Set<string>()
  const visit=(id:string):boolean=>{if(complete.has(id))return false;if(visiting.has(id))return true;const row=byId.get(id);if(!row)return false;visiting.add(id);for(const reference of referencesFor(row))if(reference!=='none'&&byId.has(reference)&&visit(reference))return true;visiting.delete(id);complete.add(id);return false}
  return rows.some(row=>visit(row.id))
}

export const validateA19HierarchyProps = (config: FamilyVariantConfig,input:unknown):MotionValidationResultV1<FamilyComponentProps>=>{
  const base=commonPropsValidation(input);if(!base.ok)return base
  if(!isA19Variant(config.variant))return base
  const rows=parseRows(base.value);const issues=[] as ReturnType<typeof valueIssue>[]
  const [min,max]=variantRange(config.variant)
  if(rows.length<min||rows.length>max)issues.push(valueIssue('$.items','VALUE_INVALID',`${config.name} requires ${min}–${max} structured rows for a readable layout.`))
  const seen=new Set<string>()
  for(const [index,row] of rows.entries()){
    if(!stableId.test(row.id))issues.push(valueIssue(`$.items[${index}]`,'VALUE_INVALID','Row ID must match [a-z][a-z0-9-]{0,31}.'))
    if(seen.has(row.id))issues.push(valueIssue(`$.items[${index}]`,'VALUE_INVALID',`Duplicate stable row ID: ${row.id}.`));seen.add(row.id)
    if(!row.fields[0]?.trim())issues.push(valueIssue(`$.items[${index}]`,'VALUE_INVALID','Each structured row requires a human label after the stable ID.'))
  }
  if(base.value.value&& !stableId.test(base.value.value))issues.push(valueIssue('$.value','VALUE_INVALID','Active item must be an empty string or a stable row ID.'))
  if(base.value.value&& !seen.has(base.value.value))issues.push(valueIssue('$.value','VALUE_INVALID','Active item ID must reference a structured row.'))
  if(config.variant==='decision-tree'){
    for(const [index,row] of rows.entries()){
      const kind=row.fields[0];const label=row.fields[1];const parent=row.fields[2];
      if(!['question','decision','result'].includes(kind??''))issues.push(valueIssue(`$.items[${index}]`,'VALUE_INVALID','Decision row format: id|question|decision|result label|parentId|edgeLabel.'))
      if(!label)issues.push(valueIssue(`$.items[${index}]`,'VALUE_INVALID','Decision node label is required.'))
      if(parent&&parent!=='none'&&!seen.has(parent))issues.push(valueIssue(`$.items[${index}]`,'VALUE_INVALID',`Unknown decision parent ID: ${parent}.`))
    }
  }
  if(config.variant==='swimlane')for(const [index,row] of rows.entries()){const steps=row.fields[1]?.split(',').filter(Boolean)??[];if(!row.fields[0]||steps.length<1||steps.length>5||steps.some((step)=>{const [id,label]=step.split(':');return !stableId.test(id?.trim()??'')||!label?.trim()}))issues.push(valueIssue(`$.items[${index}]`,'VALUE_INVALID','Swimlane row format: laneId|Lane label|stepId:Step label,... with 1–5 stable steps.'))}
  if(config.variant==='priority-matrix')for(const [index,row] of rows.entries())if(!['high-low','high-high','low-low','low-high'].includes(row.fields[0]??'')||!row.fields[1])issues.push(valueIssue(`$.items[${index}]`,'VALUE_INVALID','Priority row format: id|high-low|high-high|low-low|low-high|Label.'))
  if(config.variant==='dependency-map')for(const [index,row] of rows.entries()){const deps=(row.fields[1]??'').split(',').map(v=>v.trim()).filter(v=>v&&v!=='none');if(!row.fields[0]||deps.some(dep=>!seen.has(dep)))issues.push(valueIssue(`$.items[${index}]`,'VALUE_INVALID','Dependency row format: id|Label|dependencyId,... and every dependency ID must exist.'))}
  if(config.variant==='decision-tree'&&hasReferenceCycle(rows,row=>{const parent=row.fields[2]??'none';return parent==='none'?[]:[parent]}))issues.push(valueIssue('$.items','VALUE_INVALID','Decision relationships must be acyclic.'))
  if(config.variant==='dependency-map'&&hasReferenceCycle(rows,row=>(row.fields[1]??'').split(',').map(value=>value.trim()).filter(value=>value&&value!=='none')))issues.push(valueIssue('$.items','VALUE_INVALID','Dependency relationships must be acyclic.'))
  if(issues.length)return validationFailure(...issues)
  return base
}

const validateContext=(context:MotionRenderContextV1)=>{if(!Number.isSafeInteger(context.durationTicks)||context.durationTicks<=0)throw new RangeError('durationTicks must be a positive exact integer.');if(!Number.isSafeInteger(context.localTicks)||context.localTicks<0||context.localTicks>context.durationTicks)throw new RangeError('localTicks must be an exact tick inside duration.');if(context.ticksPerSecond!==SANVERSE_TICKS_PER_SECOND)throw new RangeError('A19 hierarchy components require canonical Sanverse ticks.')}
const validateDuration=(config:FamilyVariantConfig,context:MotionRenderContextV1)=>{const minimum=Math.round((config.minDurationSeconds??1)*SANVERSE_TICKS_PER_SECOND);const maximum=Math.round((config.maxDurationSeconds??16)*SANVERSE_TICKS_PER_SECOND);if(context.durationTicks<minimum||context.durationTicks>maximum)throw new RangeError(`${config.id} duration must stay inside ${config.minDurationSeconds??1}–${config.maxDurationSeconds??16} seconds.`)}
const tick=(context:MotionRenderContextV1,p:number)=>Math.max(0,Math.min(context.durationTicks,Math.round(context.durationTicks*p)))
const reveal=(id:string,context:MotionRenderContextV1,start:number)=>context.reducedMotion?constant(1):keyframed([{id:`${id}:hidden`,tick:0,value:0,interpolation:'hold'},{id:`${id}:enter`,tick:tick(context,start),value:0,interpolation:'bezier',bezier:{inX:.7,inY:1,outX:.2,outY:.84}},{id:`${id}:shown`,tick:tick(context,Math.min(.82,start+.16)),value:1,interpolation:'linear'}])
const offset=(id:string,context:MotionRenderContextV1,start:number,amount:number)=>context.reducedMotion?constant(0):keyframed([{id:`${id}:offset`,tick:0,value:amount,interpolation:'hold'},{id:`${id}:enter`,tick:tick(context,start),value:amount,interpolation:'bezier',bezier:{inX:.7,inY:1,outX:.22,outY:.86}},{id:`${id}:settled`,tick:tick(context,Math.min(.82,start+.16)),value:0,interpolation:'linear'}])
const scale=(id:string,context:MotionRenderContextV1,start:number)=>context.reducedMotion?constant(1):keyframed([{id:`${id}:small`,tick:0,value:.9,interpolation:'hold'},{id:`${id}:enter`,tick:tick(context,start),value:.9,interpolation:'bezier',bezier:{inX:.68,inY:1,outX:.2,outY:.88}},{id:`${id}:shown`,tick:tick(context,Math.min(.82,start+.16)),value:1,interpolation:'linear'}])

const animateNode=<T extends MotionNodeV1>(node:T,context:MotionRenderContextV1,start:number):T=>Object.freeze({...node,opacity:reveal(`${node.id}:opacity`,context,start),transform:Object.freeze({...node.transform,positionY:offset(`${node.id}:y`,context,start,24),scaleX:scale(`${node.id}:sx`,context,start),scaleY:scale(`${node.id}:sy`,context,start)})}) as unknown as T

const commonHeader=(prefix:string,props:FamilyComponentProps,style:FamilyComponentStyle,short:number)=>{
  const headerId=`${prefix}.header`,eyebrowId=`${headerId}.eyebrow`,titleId=`${headerId}.title`,subtitleId=`${headerId}.subtitle`
  return {headerId,eyebrowId,titleId,subtitleId,nodes:{
    [headerId]:graphGroup(headerId,'Header',`${prefix}.root`,[eyebrowId,titleId,subtitleId]),
    [eyebrowId]:graphText({id:eyebrowId,name:'Eyebrow',parentId:headerId,text:props.eyebrow,color:style.accentColor,fontFamily:style.fontFamily,fontSize:Math.max(18,Math.round(short*.022)),fontWeight:800}),
    [titleId]:graphText({id:titleId,name:'Title',parentId:headerId,text:props.title,color:style.textColor,fontFamily:style.fontFamily,fontSize:Math.max(36,Math.round(short*.054)),fontWeight:style.titleWeight,textAlign:'center'}),
    [subtitleId]:graphText({id:subtitleId,name:'Subtitle',parentId:headerId,text:props.subtitle,color:style.mutedColor,fontFamily:style.fontFamily,fontSize:Math.max(18,Math.round(short*.023)),fontWeight:style.bodyWeight,textAlign:'center'}),
  }}
}

const structuredParts=(row:ParsedRow,variant:A19HierarchyVariant)=>{
  if(variant==='decision-tree')return {label:row.fields[1]??row.id,kind:row.fields[0]??'decision',parent:row.fields[2]??'none',extra:(row.fields[0]??'decision').toUpperCase()}
  if(variant==='swimlane')return {label:row.fields[0]??row.id,kind:'lane',parent:'',extra:row.fields[1]??''}
  if(variant==='journey-map')return {label:row.fields[0]??row.id,kind:'stage',parent:'',extra:[row.fields[1],row.fields[2]].filter(Boolean).join(' · ')}
  if(variant==='priority-matrix')return {label:row.fields[1]??row.id,kind:row.fields[0]??'low-low',parent:'',extra:''}
  if(variant==='value-chain')return {label:row.fields[0]??row.id,kind:'stage',parent:'',extra:`${row.fields[1]??''} → ${row.fields[2]??''}`}
  if(variant==='layer-stack')return {label:row.fields[0]??row.id,kind:'layer',parent:'',extra:row.fields[1]??''}
  if(variant==='ecosystem-map')return {label:row.fields[0]??row.id,kind:row.id==='core'?'core':'region',parent:'',extra:row.fields[1]??''}
  return {label:row.fields[0]??row.id,kind:'dependency',parent:'',extra:`Needs: ${row.fields[1]&&row.fields[1]!=='none'?row.fields[1]:'none'}`}
}

export const createA19HierarchyScene=(config:FamilyVariantConfig,props:FamilyComponentProps,style:FamilyComponentStyle,context:MotionRenderContextV1):MotionSceneV1=>{
  validateContext(context);validateDuration(config,context);const validated=validateA19HierarchyProps(config,props);if(!validated.ok)throw new RangeError(validated.issues[0]?.message??'Invalid A19 hierarchy props.');if(!isA19Variant(config.variant))throw new RangeError('Not an A19 hierarchy variant.')
  const rows=parseRows(validated.value);const prefix=prefixFor(config);const rootId=`${prefix}.root`,surfaceId=`${prefix}.surface`,bodyId=`${prefix}.body`,connectorsId=`${prefix}.connectors`;const short=Math.min(context.composition.width,context.composition.height);const header=commonHeader(prefix,validated.value,style,short)
  const nodes:Record<string,MotionNodeV1>={}
  const dataNodeIds:string[]=[];const connectorIds:string[]=[];const activeNodeIds:string[]=[]
  const topChildren=[surfaceId,header.headerId,bodyId,connectorsId]
  nodes[rootId]=graphGroup(rootId,config.name,null,topChildren)
  nodes[surfaceId]=graphShape({id:surfaceId,name:'Surface',parentId:rootId,width:Math.round(context.composition.width*.82),height:Math.round(context.composition.height*.72),fillColor:style.surfaceColor,strokeColor:`${style.accentColor}2f`,strokeWidth:2,radius:style.radius})
  Object.assign(nodes,header.nodes)
  nodes[connectorsId]=graphGroup(connectorsId,'Connectors',rootId,connectorIds)

  const makeCard=(parentId:string,row:ParsedRow,index:number,namePrefix:string,groupIdOverride?:string)=>{
    const info=structuredParts(row,config.variant as A19HierarchyVariant);const groupId=groupIdOverride??`${prefix}.${namePrefix}:${row.id}`,shapeId=`${groupId}.surface`,labelId=`${groupId}.label`,detailId=`${groupId}.detail`;const start=Math.min(.12+index*.055,.58)
    nodes[groupId]=animateNode(graphGroup(groupId,`${namePrefix.replace(/-/gu,' ')} — ${info.label}`,parentId,[shapeId,labelId,detailId]),context,start)
    nodes[shapeId]=graphShape({id:shapeId,name:`Surface — ${info.label}`,parentId:groupId,width:280,height:130,fillColor:row.id===validated.value.value?`${style.accentColor}22`:`${style.textColor}08`,strokeColor:row.id===validated.value.value?style.accentColor:`${style.textColor}28`,strokeWidth:row.id===validated.value.value?3:1,radius:Math.max(10,style.radius*.7)})
    nodes[labelId]=graphText({id:labelId,name:`Label — ${info.label}`,parentId:groupId,text:info.label,color:style.textColor,fontFamily:style.fontFamily,fontSize:28,fontWeight:800,textAlign:'center'})
    nodes[detailId]=graphText({id:detailId,name:`Detail — ${info.label}`,parentId:groupId,text:info.extra,color:style.mutedColor,fontFamily:style.fontFamily,fontSize:18,fontWeight:style.bodyWeight,textAlign:'center'})
    dataNodeIds.push(groupId,shapeId,labelId,detailId);if(row.id===validated.value.value)activeNodeIds.push(groupId,shapeId,labelId,detailId)
    return {groupId,info}
  }

  if(config.variant==='swimlane'){
    const laneIds=rows.map(row=>`${prefix}.lane:${row.id}`);nodes[bodyId]=graphGroup(bodyId,'Lanes',rootId,laneIds)
    rows.forEach((row,laneIndex)=>{const laneId=laneIds[laneIndex]!;const laneLabelId=`${laneId}.label`;const stepsGroupId=`${laneId}.steps`;const stepDefs=(row.fields[1]??'').split(',').map(part=>part.trim()).filter(Boolean).map(part=>{const [id,label]=part.split(':').map(v=>v.trim());return{id,label}});const stepIds=stepDefs.map(step=>`${laneId}.step:${step.id}`);nodes[laneId]=animateNode(graphGroup(laneId,`Lane — ${row.fields[0]??row.id}`,bodyId,[laneLabelId,stepsGroupId]),context,.12+laneIndex*.07);nodes[laneLabelId]=graphText({id:laneLabelId,name:`Lane Label — ${row.fields[0]??row.id}`,parentId:laneId,text:row.fields[0]??row.id,color:style.accentColor,fontFamily:style.fontFamily,fontSize:24,fontWeight:900});nodes[stepsGroupId]=graphGroup(stepsGroupId,'Steps',laneId,stepIds);dataNodeIds.push(laneId,laneLabelId,stepsGroupId);stepDefs.forEach((step,stepIndex)=>{const fake=Object.freeze({id:step.id,fields:Object.freeze([step.label]),raw:`${step.id}|${step.label}`});const made=makeCard(stepsGroupId,fake,laneIndex*5+stepIndex,'step',stepIds[stepIndex]!);(nodes[stepsGroupId] as any)=graphGroup(stepsGroupId,'Steps',laneId,stepIds);if(validated.value.value===row.id)activeNodeIds.push(made.groupId)})})
  } else if(config.variant==='priority-matrix'){
    const quadrants=['high-low','high-high','low-low','low-high'] as const;const quadrantIds=quadrants.map(q=>`${prefix}.quadrant:${q}`);nodes[bodyId]=graphGroup(bodyId,'Matrix',rootId,quadrantIds)
    quadrants.forEach((quadrant,qIndex)=>{const contained=rows.filter(row=>row.fields[0]===quadrant);const childIds=contained.map(row=>`${prefix}.item:${row.id}`);const qId=quadrantIds[qIndex]!;const labelId=`${qId}.label`;nodes[qId]=graphGroup(qId,`Quadrant — ${quadrant}`,bodyId,[labelId,...childIds]);nodes[labelId]=graphText({id:labelId,name:`Quadrant Label — ${quadrant}`,parentId:qId,text:priorityQuadrantLabel(quadrant),color:style.mutedColor,fontFamily:style.fontFamily,fontSize:18,fontWeight:800,textAlign:'center'});dataNodeIds.push(qId,labelId);contained.forEach((row,index)=>makeCard(qId,row,qIndex*3+index,'item'))})
  } else if(config.variant==='ecosystem-map'){
    const regionIds=rows.map(row=>`${prefix}.region:${row.id}`);nodes[bodyId]=graphGroup(bodyId,'Regions',rootId,regionIds)
    rows.forEach((row,index)=>{const regionId=regionIds[index]!;const labelId=`${regionId}.label`;const membersGroupId=`${regionId}.members`;const members=(row.fields[1]??'').split(',').map(v=>v.trim()).filter(Boolean);const memberIds=members.map((_,memberIndex)=>`${regionId}.member:${memberIndex+1}`);nodes[regionId]=animateNode(graphGroup(regionId,`${row.id==='core'?'Core':'Region'} — ${row.fields[0]??row.id}`,bodyId,[labelId,membersGroupId]),context,.12+index*.07);nodes[labelId]=graphText({id:labelId,name:`Region Label — ${row.fields[0]??row.id}`,parentId:regionId,text:row.fields[0]??row.id,color:row.id===validated.value.value?style.accentColor:style.textColor,fontFamily:style.fontFamily,fontSize:24,fontWeight:900,textAlign:'center'});nodes[membersGroupId]=graphGroup(membersGroupId,'Members',regionId,memberIds);dataNodeIds.push(regionId,labelId,membersGroupId);members.forEach((member,memberIndex)=>{const memberId=memberIds[memberIndex]!;nodes[memberId]=animateNode(graphText({id:memberId,name:`Member — ${member}`,parentId:membersGroupId,text:member,color:style.mutedColor,fontFamily:style.fontFamily,fontSize:18,fontWeight:style.bodyWeight,textAlign:'center'}),context,.24+index*.05+memberIndex*.025);dataNodeIds.push(memberId)})})
  } else {
    const itemIds=rows.map(row=>`${prefix}.${config.variant==='decision-tree'?'node':config.variant==='dependency-map'?'dependency':'stage'}:${row.id}`);nodes[bodyId]=graphGroup(bodyId,config.variant==='decision-tree'?'Tree':config.variant==='dependency-map'?'Dependencies':config.variant==='layer-stack'?'Stack':config.variant==='journey-map'?'Stages':'Value Chain',rootId,itemIds)
    rows.forEach((row,index)=>makeCard(bodyId,row,index,config.variant==='decision-tree'?'node':config.variant==='dependency-map'?'dependency':'stage'))
  }

  const addConnector=(id:string,label:string)=>{const pathId=`${connectorsId}.path:${id}`;const start=.34+connectorIds.length*.025;nodes[pathId]=Object.freeze({...animateNode(graphPath({id:pathId,name:`Connector — ${label}`,parentId:connectorsId,pathData:'M0 0 L100 100',fillColor:'transparent',strokeColor:style.accentColor,strokeWidth:3}),context,start),trimProgress:reveal(`${pathId}:trim`,context,start)});connectorIds.push(pathId);return pathId}
  if(config.variant==='decision-tree')rows.filter(row=>(row.fields[2]??'none')!=='none').forEach(row=>addConnector(`${row.fields[2]}-${row.id}`,row.fields[3]||`${row.fields[2]} → ${row.id}`))
  else if(config.variant==='dependency-map')rows.forEach(row=>(row.fields[1]??'').split(',').map(v=>v.trim()).filter(v=>v&&v!=='none').forEach(dep=>addConnector(`${dep}-${row.id}`,`${dep} → ${row.id}`)))
  else if(config.variant==='ecosystem-map')rows.filter(row=>row.id!=='core').forEach(row=>addConnector(`core-${row.id}`,`Core → ${row.fields[0]??row.id}`))
  else if(config.variant!=='priority-matrix')for(let index=0;index<rows.length-1;index++)addConnector(`${rows[index]!.id}-${rows[index+1]!.id}`,`${rows[index]!.id} → ${rows[index+1]!.id}`)
  nodes[connectorsId]=graphGroup(connectorsId,'Connectors',rootId,connectorIds)

  const allContentIds=[header.headerId,header.eyebrowId,header.titleId,header.subtitleId,bodyId,...dataNodeIds]
  const exposures:MotionExposureV1[]=[
    {id:`${prefix}.eyebrow`,label:'Eyebrow',group:'Content',level:'creator',target:{kind:'component',propertyId:'eyebrow'},editor:{type:'text'},keyframeable:false},
    {id:`${prefix}.title`,label:'Title',group:'Content',level:'creator',target:{kind:'component',propertyId:'title'},editor:{type:'textarea'},keyframeable:false},
    {id:`${prefix}.subtitle`,label:'Subtitle',group:'Content',level:'creator',target:{kind:'component',propertyId:'subtitle'},editor:{type:'textarea'},keyframeable:false},
    {id:`${prefix}.active`,label:'Active item ID',group:'Content',level:'creator',target:{kind:'component',propertyId:'value'},editor:{type:'text'},keyframeable:false},
    {id:`${prefix}.data`,label:'Structured data · one row per line',group:'Content',level:'creator',target:{kind:'component',propertyId:'items'},editor:{type:'textarea'},keyframeable:false},
    {id:`${prefix}.text-color`,label:'Text color',group:'Style',level:'creator',target:{kind:'component',propertyId:'textColor'},editor:{type:'color'},keyframeable:false},
    {id:`${prefix}.accent-color`,label:'Accent color',group:'Style',level:'creator',target:{kind:'component',propertyId:'accentColor'},editor:{type:'color'},keyframeable:false},
    {id:`${prefix}.radius`,label:'Surface roundness',group:'Surface',level:'designer',target:{kind:'node',nodeId:surfaceId,property:'shape.radius'},editor:{type:'slider'},keyframeable:true,constraints:{minimum:0,maximum:120,step:1}},
    {id:`${prefix}.position-x`,label:'Position X',group:'Transform',level:'designer',target:{kind:'node',nodeId:rootId,property:'transform.positionX'},editor:{type:'slider'},keyframeable:true,constraints:{minimum:-500,maximum:500,step:1}},
    {id:`${prefix}.position-y`,label:'Position Y',group:'Transform',level:'designer',target:{kind:'node',nodeId:rootId,property:'transform.positionY'},editor:{type:'slider'},keyframeable:true,constraints:{minimum:-500,maximum:500,step:1}},
    {id:`${prefix}.opacity`,label:'Overall opacity',group:'Transform',level:'designer',target:{kind:'node',nodeId:rootId,property:'opacity'},editor:{type:'slider'},keyframeable:true,constraints:{minimum:0,maximum:1,step:.01}},
    {id:`${prefix}.parts`,label:'Semantic parts',group:'Parts',level:'advanced',target:{kind:'part',semanticPartId:'content',property:'opacity'},editor:{type:'readonly'},keyframeable:true},
  ]
  return createMotionScene({componentId:config.id,componentVersion:1,rootNodeId:rootId,nodes:Object.freeze(nodes),semanticParts:Object.freeze([
    {id:'surface',label:'Surface',role:'surface',nodeIds:Object.freeze([surfaceId])},
    {id:'title',label:'Title',role:'primary-text',nodeIds:Object.freeze([header.headerId,header.eyebrowId,header.titleId,header.subtitleId])},
    {id:'content',label:'Content',role:'content-group',nodeIds:Object.freeze([bodyId,...dataNodeIds])},
    {id:'connectors',label:'Connectors',role:'decoration',nodeIds:Object.freeze([connectorsId,...connectorIds])},
    {id:'activeItem',label:'Active item',role:'accent',nodeIds:Object.freeze(activeNodeIds)},
  ]),exposures:Object.freeze(exposures),layout:responsiveGraphLayout(),supportedAspectRatios:Object.freeze(['16:9','9:16','1:1','4:5'])})
}

const nodeStyle=(scene:ResolvedMotionSceneV1|null,id:string,base:CSSProperties)=>mergeMotionGraphNodeStyle(base,scene?.nodes[id]??null,false)
const splitSteps=(row:ParsedRow)=>((row.fields[1]??'').split(',').map(part=>part.trim()).filter(Boolean).map(part=>{const [id,label]=part.split(':').map(v=>v.trim());return{id,label}}))
const card=(scene:ResolvedMotionSceneV1|null,id:string,label:string,detail:string,style:FamilyComponentStyle,active:boolean,wide:boolean):ReactNode=>{
  const surfaceId=`${id}.surface`,labelId=`${id}.label`,detailId=`${id}.detail`
  const surfaceNode=scene?.nodes[surfaceId]
  const shape=surfaceNode?.type==='shape'?surfaceNode:null
  const labelNode=scene?.nodes[labelId]
  const textLabel=labelNode?.type==='text'?labelNode.text:label
  const detailNode=scene?.nodes[detailId]
  const textDetail=detailNode?.type==='text'?detailNode.text:detail
  return <div key={id} data-motion-node-id={id} style={nodeStyle(scene,id,{position:'relative',display:'grid',gap:6,minWidth:0,padding:wide?'16px 14px':'22px 18px',color:style.textColor,textAlign:'center',isolation:'isolate'})}>
    <div aria-hidden="true" data-motion-node-id={surfaceId} style={nodeStyle(scene,surfaceId,{position:'absolute',inset:0,zIndex:0,borderRadius:shape?.radius??Math.max(10,style.radius*.7),borderStyle:'solid',borderWidth:shape?.strokeWidth??(active?2:1),borderColor:shape?.strokeColor??(active?style.accentColor:`${style.textColor}26`),background:shape?.fillColor??(active?`${style.accentColor}18`:`${style.textColor}07`),boxShadow:active?`0 10px 26px ${style.accentColor}20`:'none'})}/>
    <strong data-motion-node-id={labelId} style={nodeStyle(scene,labelId,{position:'relative',zIndex:1,fontSize:wide?24:30,lineHeight:1.05,overflowWrap:'anywhere',color:labelNode?.type==='text'?labelNode.fillColor:style.textColor})}>{textLabel}</strong>
    {textDetail?<span data-motion-node-id={detailId} style={nodeStyle(scene,detailId,{position:'relative',zIndex:1,fontSize:wide?16:20,lineHeight:1.3,color:detailNode?.type==='text'?detailNode.fillColor:style.mutedColor,overflowWrap:'anywhere'})}>{textDetail}</span>:null}
  </div>
}

const connectorArrow=(scene:ResolvedMotionSceneV1|null,prefix:string,connectorKey:string,label:string,style:FamilyComponentStyle,vertical:boolean):ReactNode=>{
  const id=`${prefix}.connectors.path:${connectorKey}`
  const node=scene?.nodes[id]
  const trim=node?.type==='path'?node.trimProgress:1
  return <div key={id} data-motion-node-id={id} style={nodeStyle(scene,id,{display:'grid',placeItems:'center',gap:2,minWidth:vertical?0:32,minHeight:vertical?24:0,color:node?.type==='path'?node.strokeColor:style.accentColor,opacity:trim,transformOrigin:'center',fontSize:vertical?24:22,lineHeight:1})}>
    <span aria-hidden="true">{vertical?'↓':'→'}</span>
    {label?<small style={{fontSize:12,fontWeight:900,letterSpacing:'.08em',whiteSpace:'nowrap'}}>{label}</small>:null}
  </div>
}

const priorityQuadrantLabel=(quadrant:string):string=>quadrant==='high-low'?'High impact · Low effort':quadrant==='high-high'?'High impact · High effort':quadrant==='low-low'?'Low impact · Low effort':'Low impact · High effort'

export const renderA19HierarchyComponent=(config:FamilyVariantConfig,props:FamilyComponentProps,style:FamilyComponentStyle,context:MotionRenderContextV1,scene:ResolvedMotionSceneV1|null):ReactNode=>{
  if(!isA19Variant(config.variant))return null;const validated=validateA19HierarchyProps(config,props);if(!validated.ok)return null;const rows=parseRows(validated.value);const prefix=prefixFor(config);const wide=context.composition.width/context.composition.height>1.15;const graphStyle=(id:string,base:CSSProperties)=>nodeStyle(scene,id,base);const rootId=`${prefix}.root`,surfaceId=`${prefix}.surface`;const header=<header data-motion-node-id={`${prefix}.header`} style={graphStyle(`${prefix}.header`,{display:'grid',gap:6,textAlign:'center',justifyItems:'center'})}>{props.eyebrow?<div data-motion-node-id={`${prefix}.header.eyebrow`} style={graphStyle(`${prefix}.header.eyebrow`,{color:style.accentColor,fontSize:wide?18:20,fontWeight:900,letterSpacing:'.12em'})}>{props.eyebrow}</div>:null}<div data-motion-node-id={`${prefix}.header.title`} style={graphStyle(`${prefix}.header.title`,{color:style.textColor,fontSize:wide?46:52,lineHeight:1.02,fontWeight:style.titleWeight,letterSpacing:'-.035em',maxWidth:'92%'})}>{props.title}</div>{props.subtitle?<div data-motion-node-id={`${prefix}.header.subtitle`} style={graphStyle(`${prefix}.header.subtitle`,{color:style.mutedColor,fontSize:wide?18:21,lineHeight:1.3,maxWidth:'90%'})}>{props.subtitle}</div>:null}</header>
  const info=(row:ParsedRow)=>structuredParts(row,config.variant as A19HierarchyVariant)
  let body:ReactNode=null
  if(config.variant==='decision-tree'){
    const byId=new Map(rows.map(row=>[row.id,row] as const))
    const depthMemo=new Map<string,number>()
    const depthFor=(row:ParsedRow,trail:ReadonlySet<string>=new Set()):number=>{
      const known=depthMemo.get(row.id);if(known!==undefined)return known
      const parent=row.fields[2]??'none';if(parent==='none'){depthMemo.set(row.id,0);return 0}
      if(trail.has(row.id))return 0
      const parentRow=byId.get(parent);const depth=parentRow?depthFor(parentRow,new Set([...trail,row.id]))+1:0;depthMemo.set(row.id,depth);return depth
    }
    const maxDepth=Math.max(...rows.map(row=>depthFor(row)))
    const levels=Array.from({length:maxDepth+1},(_,depth)=>rows.filter(row=>depthFor(row)===depth))
    body=<div data-motion-node-id={`${prefix}.body`} style={graphStyle(`${prefix}.body`,{display:'grid',gap:wide?10:8,alignItems:'center'})}>
      {levels.map((level,depth)=><div key={`level-${depth}`} style={{display:'grid',gridTemplateColumns:`repeat(${Math.max(1,wide?level.length:Math.min(2,level.length))},minmax(0,1fr))`,gap:wide?14:8,justifyContent:'center',maxWidth:depth===0?(wide?'54%':'82%'):'100%',width:depth===0?(wide?'54%':'82%'):'100%',margin:'0 auto'}}>{level.map(row=>{const i=info(row);const parent=row.fields[2]??'none';return <div key={row.id} style={{display:'grid',gap:4,alignContent:'start'}}>{depth>0&&parent!=='none'?connectorArrow(scene,prefix,`${parent}-${row.id}`,row.fields[3]??'',style,true):null}{card(scene,`${prefix}.node:${row.id}`,i.label,i.extra,style,row.id===props.value,wide)}</div>})}</div>)}
    </div>
  }
  else if(config.variant==='swimlane'){
    const columns:ReactNode[]=[]
    rows.forEach((row,index)=>{
      const laneId=`${prefix}.lane:${row.id}`,labelId=`${laneId}.label`,stepsId=`${laneId}.steps`;const labelNode=scene?.nodes[labelId];const active=row.id===props.value
      columns.push(<section key={laneId} data-motion-node-id={laneId} style={graphStyle(laneId,{display:'grid',gap:9,padding:12,borderRadius:style.radius,border:`${active?2:1}px solid ${active?style.accentColor:`${style.textColor}24`}`,background:active?`${style.accentColor}10`:`${style.textColor}04`,minWidth:0})}><strong data-motion-node-id={labelId} style={graphStyle(labelId,{color:active?style.accentColor:style.textColor,fontSize:wide?20:24,textTransform:'uppercase',letterSpacing:'.05em'})}>{labelNode?.type==='text'?labelNode.text:row.fields[0]}</strong><div data-motion-node-id={stepsId} style={graphStyle(stepsId,{display:'grid',gap:7})}>{splitSteps(row).map(step=>card(scene,`${laneId}.step:${step.id}`,step.label,'',style,false,wide))}</div></section>)
      if(index<rows.length-1)columns.push(connectorArrow(scene,prefix,`${row.id}-${rows[index+1]!.id}`,'HANDOFF',style,!wide))
    })
    body=<div data-motion-node-id={`${prefix}.body`} style={graphStyle(`${prefix}.body`,{display:'grid',gridTemplateColumns:wide?rows.map((_,index)=>index<rows.length-1?'minmax(0,1fr) 34px':'minmax(0,1fr)').join(' '):'1fr',gap:wide?6:4,alignItems:'stretch'})}>{columns}</div>
  }
  else if(config.variant==='priority-matrix'){
    const quadrants=['high-low','high-high','low-low','low-high']
    body=<div data-motion-node-id={`${prefix}.body`} style={graphStyle(`${prefix}.body`,{display:'grid',gap:6})}>
      <div style={{display:'flex',justifyContent:'space-between',color:style.mutedColor,fontSize:14,fontWeight:900,letterSpacing:'.08em'}}><span>↑ HIGH IMPACT</span><span>LOW EFFORT ←</span></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2,padding:2,borderRadius:Math.max(8,style.radius*.7),background:`${style.textColor}22`,overflow:'hidden'}}>{quadrants.map(q=><section key={q} data-motion-node-id={`${prefix}.quadrant:${q}`} style={graphStyle(`${prefix}.quadrant:${q}`,{minHeight:wide?150:190,display:'grid',alignContent:'start',gap:8,padding:wide?12:14,background:`${style.surfaceColor}`,boxShadow:'inset 0 0 0 1px rgba(255,255,255,.03)'})}><strong data-motion-node-id={`${prefix}.quadrant:${q}.label`} style={graphStyle(`${prefix}.quadrant:${q}.label`,{fontSize:wide?12:14,textTransform:'uppercase',letterSpacing:'.06em',color:style.mutedColor})}>{priorityQuadrantLabel(q)}</strong>{rows.filter(row=>row.fields[0]===q).map(row=>card(scene,`${prefix}.item:${row.id}`,row.fields[1]??row.id,'',style,row.id===props.value,wide))}</section>)}</div>
      <div style={{textAlign:'right',color:style.mutedColor,fontSize:14,fontWeight:900,letterSpacing:'.08em'}}>HIGH EFFORT →</div>
    </div>
  }
  else if(config.variant==='ecosystem-map'){
    const core=rows.find(row=>row.id==='core')??rows[0]!
    const regions=rows.filter(row=>row.id!==core.id)
    const region=(row:ParsedRow)=>{const regionId=`${prefix}.region:${row.id}`,labelId=`${regionId}.label`,membersId=`${regionId}.members`;const labelNode=scene?.nodes[labelId];const active=row.id===props.value;return <section key={row.id} data-motion-node-id={regionId} style={graphStyle(regionId,{display:'grid',gap:8,padding:wide?14:16,borderRadius:style.radius,border:`${active?2:1}px solid ${active?style.accentColor:`${style.textColor}25`}`,background:active?`${style.accentColor}14`:`${style.textColor}06`,minWidth:0})}><strong data-motion-node-id={labelId} style={graphStyle(labelId,{fontSize:wide?21:26,color:active?style.accentColor:style.textColor,textAlign:'center'})}>{labelNode?.type==='text'?labelNode.text:row.fields[0]}</strong><div data-motion-node-id={membersId} style={graphStyle(membersId,{display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center'})}>{(row.fields[1]??'').split(',').map(v=>v.trim()).filter(Boolean).map((member,index)=>{const memberId=`${regionId}.member:${index+1}`,memberNode=scene?.nodes[memberId];return <span key={memberId} data-motion-node-id={memberId} style={graphStyle(memberId,{padding:'5px 8px',borderRadius:999,background:`${style.textColor}09`,color:style.mutedColor,fontSize:wide?13:17})}>{memberNode?.type==='text'?memberNode.text:member}</span>})}</div></section>}
    body=<div data-motion-node-id={`${prefix}.body`} style={graphStyle(`${prefix}.body`,{display:'grid',gap:wide?8:6})}>
      <div style={{width:wide?'44%':'74%',margin:'0 auto'}}>{region(core)}</div>
      {wide?<><div style={{display:'grid',gridTemplateColumns:`repeat(${Math.max(1,regions.length)},minmax(0,1fr))`,gap:8}}>{regions.map(row=>connectorArrow(scene,prefix,`core-${row.id}`,'',style,true))}</div><div style={{display:'grid',gridTemplateColumns:`repeat(${Math.max(1,regions.length)},minmax(0,1fr))`,gap:8}}>{regions.map(region)}</div></>:<div style={{display:'grid',gap:6}}>{regions.map(row=><div key={row.id} style={{display:'grid',gap:4}}>{connectorArrow(scene,prefix,`core-${row.id}`,'',style,true)}{region(row)}</div>)}</div>}
    </div>
  }
  else if(config.variant==='layer-stack')body=<div data-motion-node-id={`${prefix}.body`} style={graphStyle(`${prefix}.body`,{display:'grid',gap:3,width:'100%',maxWidth:wide?860:620,margin:'0 auto'})}>{rows.map((row,index)=>{const width=rows.length<=1?100:(wide?62:78)+(index/Math.max(1,rows.length-1))*(wide?38:22);return <div key={row.id} style={{display:'grid',gap:2,width:`${width}%`,margin:'0 auto'}}>{card(scene,`${prefix}.stage:${row.id}`,row.fields[0]??row.id,row.fields[1]??'',style,row.id===props.value,wide)}{index<rows.length-1?connectorArrow(scene,prefix,`${row.id}-${rows[index+1]!.id}`,'DEPENDS ON',style,true):null}</div>})}</div>
  else if(config.variant==='journey-map'){
    const flow:ReactNode[]=[]
    rows.forEach((row,index)=>{flow.push(<div key={`journey-${row.id}`} style={{display:'grid',gap:6,alignContent:'start',minWidth:0}}><div style={{width:34,height:34,margin:'0 auto',display:'grid',placeItems:'center',borderRadius:'50%',background:row.id===props.value?style.accentColor:`${style.textColor}12`,color:row.id===props.value?'#080808':style.mutedColor,fontSize:14,fontWeight:900}}>{index+1}</div>{card(scene,`${prefix}.stage:${row.id}`,row.fields[0]??row.id,[row.fields[1],row.fields[2]].filter(Boolean).join(' · '),style,row.id===props.value,wide)}</div>);if(index<rows.length-1)flow.push(connectorArrow(scene,prefix,`${row.id}-${rows[index+1]!.id}`,'',style,!wide))})
    body=<div data-motion-node-id={`${prefix}.body`} style={graphStyle(`${prefix}.body`,{display:'grid',gridTemplateColumns:wide?rows.map((_,index)=>index<rows.length-1?'minmax(0,1fr) 28px':'minmax(0,1fr)').join(' '):'1fr',gap:wide?4:3,alignItems:'center'})}>{flow}</div>
  }
  else if(config.variant==='value-chain'){
    const flow:ReactNode[]=[]
    rows.forEach((row,index)=>{flow.push(<div key={`value-${row.id}`} style={{display:'grid',gap:5,minWidth:0}}><small style={{color:style.mutedColor,fontSize:13,fontWeight:900,letterSpacing:'.08em',textAlign:'center'}}>STAGE {index+1}</small>{card(scene,`${prefix}.stage:${row.id}`,row.fields[0]??row.id,`${row.fields[1]??''} → ${row.fields[2]??''}`,style,row.id===props.value,wide)}</div>);if(index<rows.length-1)flow.push(connectorArrow(scene,prefix,`${row.id}-${rows[index+1]!.id}`,'ADD VALUE',style,!wide))})
    body=<div data-motion-node-id={`${prefix}.body`} style={graphStyle(`${prefix}.body`,{display:'grid',gridTemplateColumns:wide?rows.map((_,index)=>index<rows.length-1?'minmax(0,1fr) 34px':'minmax(0,1fr)').join(' '):'1fr',gap:wide?4:3,alignItems:'center'})}>{flow}</div>
  }
  else {
    const byId=new Map(rows.map(row=>[row.id,row] as const));const memo=new Map<string,number>()
    const depthFor=(row:ParsedRow,trail:ReadonlySet<string>=new Set()):number=>{const known=memo.get(row.id);if(known!==undefined)return known;if(trail.has(row.id))return 0;const deps=(row.fields[1]??'').split(',').map(value=>value.trim()).filter(value=>value&&value!=='none');const depth=deps.length?1+Math.max(...deps.map(dep=>{const found=byId.get(dep);return found?depthFor(found,new Set([...trail,row.id])):0})):0;memo.set(row.id,depth);return depth}
    const maxDepth=Math.max(...rows.map(row=>depthFor(row)));const levels=Array.from({length:maxDepth+1},(_,depth)=>rows.filter(row=>depthFor(row)===depth))
    const edges=rows.flatMap(row=>(row.fields[1]??'').split(',').map(value=>value.trim()).filter(value=>value&&value!=='none').map(dep=>({dep,row})))
    body=<div data-motion-node-id={`${prefix}.body`} style={graphStyle(`${prefix}.body`,{display:'grid',gap:8})}>
      <div style={{display:'grid',gridTemplateColumns:wide?`repeat(${levels.length},minmax(0,1fr))`:'1fr',gap:8,alignItems:'start'}}>{levels.map((level,depth)=><section key={`dep-level-${depth}`} style={{display:'grid',gap:6}}><small style={{color:style.mutedColor,fontSize:13,fontWeight:900,letterSpacing:'.08em',textAlign:'center'}}>LEVEL {depth+1}</small>{level.map(row=>card(scene,`${prefix}.dependency:${row.id}`,row.fields[0]??row.id,`Needs: ${row.fields[1]??'none'}`,style,row.id===props.value,wide))}</section>)}</div>
      <div data-motion-node-id={`${prefix}.connectors`} style={graphStyle(`${prefix}.connectors`,{display:wide?'flex':'none',flexWrap:'wrap',gap:5,justifyContent:'center',paddingTop:2})}>{edges.map(({dep,row})=>connectorArrow(scene,prefix,`${dep}-${row.id}`,`${dep} → ${row.id}`,style,false))}</div>
    </div>
  }
  const surfaceNode=scene?.nodes[surfaceId];const surfaceShape=surfaceNode?.type==='shape'?surfaceNode:null
  return <div data-motion-root="family-component" data-motion-family="diagram" data-motion-variant={config.variant} data-motion-module-id={config.id} data-motion-node-id={rootId} style={graphStyle(rootId,{position:'absolute',inset:0,display:'grid',placeItems:'center',padding:Math.round(Math.min(context.composition.width,context.composition.height)*.055),overflow:'hidden',fontFamily:style.fontFamily})}>
    <section data-motion-node-id={surfaceId} style={graphStyle(surfaceId,{width:wide?'86%':'90%',maxWidth:1500,minHeight:wide?'68%':'84%',display:'grid',alignContent:'center',gap:wide?18:24,padding:wide?32:36,borderRadius:surfaceShape?.radius??style.radius,borderStyle:'solid',borderWidth:surfaceShape?.strokeWidth??2,borderColor:surfaceShape?.strokeColor??`${style.accentColor}24`,background:surfaceShape?.fillColor??style.surfaceColor,boxShadow:'0 24px 70px rgba(0,0,0,.28)'})}>{header}{body}</section>
  </div>
}

export const evaluateA19HierarchyState=(props:FamilyComponentProps,context:MotionRenderContextV1)=>{validateContext(context);return Object.freeze({progress:normalizedProgress(context.localTicks,context.durationTicks),phase:context.localTicks>=context.durationTicks?'ended':normalizedProgress(context.localTicks,context.durationTicks)<.76?'enter':normalizedProgress(context.localTicks,context.durationTicks)<.92?'hold':'exit',layout:context.composition.width/context.composition.height>1.15?'wide':'compact',reveal:1,itemReveals:Object.freeze(props.items.map(()=>1))})}

export const a19HierarchyItemLimit=(config:FamilyVariantConfig):number=>isA19HierarchyConfig(config)?12:6
