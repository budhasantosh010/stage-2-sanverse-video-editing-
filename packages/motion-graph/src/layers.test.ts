import { describe, expect, it } from 'vitest'
import {
  applyMotionOperation,
  constant,
  createMotionAuthoringMetadata,
  createMotionScene,
  createMotionSelectionState,
  evaluateScene,
  filterMotionLayerProjection,
  keyframed,
  motionNodeLockState,
  nodeBase,
  projectMotionLayers,
  parseMotionAuthoringMetadata,
  serializeMotionAuthoringMetadata,
  selectMotionNodeRange,
  selectionFallbackAfterDelete,
  setMotionNodeLocked,
  toggleMotionNodeSelection,
  validateMotionAuthoringMetadata,
} from './index.ts'
import type { MotionGroupNodeV1, MotionImageNodeV1, MotionPathNodeV1, MotionSceneV1, MotionShapeNodeV1, MotionTextNodeV1 } from './index.ts'

const group = (id: string, name: string, parentId: string | null, childIds: readonly string[]): MotionGroupNodeV1 => Object.freeze({ ...nodeBase(id, name, parentId), type: 'group', childIds: Object.freeze([...childIds]) })
const text = (id: string, name: string, parentId: string, value: string): MotionTextNodeV1 => Object.freeze({ ...nodeBase(id, name, parentId), type: 'text', text: constant(value), fillColor: constant('#fff'), fontFamily: 'Inter', fontSize: constant(48), fontWeight: constant(700), textAlign: 'left' })
const shape = (id: string, name: string, parentId: string): MotionShapeNodeV1 => Object.freeze({ ...nodeBase(id, name, parentId), type: 'shape', shape: 'rectangle', width: constant(200), height: constant(100), fillColor: constant('#111'), strokeColor: constant('#fff'), strokeWidth: constant(1), radius: constant(0) })
const scene = (): MotionSceneV1 => createMotionScene({
  componentId:'sanverse.c3-test', componentVersion:1, rootNodeId:'root',
  nodes:Object.freeze({
    root:group('root','C3 Test',null,['surface','hero','footer']),
    surface:shape('surface','Surface','root'),
    hero:group('hero','Hero','root',['label','value']),
    label:text('label','Label','hero','Revenue'),
    value:Object.freeze({ ...text('value','Value','hero','$24K'), visible:keyframed([{id:'visible-0',tick:0,value:true,interpolation:'hold'},{id:'visible-1',tick:1_000,value:false,interpolation:'hold'}]) }),
    footer:text('footer','Footer','root','Source'),
  }),
  semanticParts:Object.freeze([
    {id:'surface',label:'Surface',role:'surface',nodeIds:Object.freeze(['surface'])},
    {id:'hero',label:'Hero',role:'content-group',nodeIds:Object.freeze(['hero','label','value'])},
    {id:'footer',label:'Footer',role:'secondary-text',nodeIds:Object.freeze(['footer'])},
  ]), exposures:Object.freeze([]), layout:Object.freeze({mode:'responsive',ownership:Object.freeze([]),formatOverrides:Object.freeze([])}), supportedAspectRatios:Object.freeze(['16:9','9:16','1:1','4:5']),
})
const context=(localTicks=0)=>({localTicks,durationTicks:2_000,ticksPerSecond:1_000,composition:{width:1920,height:1080,fpsNumerator:30,fpsDenominator:1},reducedMotion:false} as const)
const depthScene=(depth:number):MotionSceneV1=>{
  const nodes:Record<string,MotionGroupNodeV1|MotionTextNodeV1>={}
  for(let index=0;index<=depth;index+=1){const id=`g${index}`;const child=index===depth?'leaf':`g${index+1}`;nodes[id]=group(id,id,index===0?null:`g${index-1}`,[child])}
  nodes.leaf=text('leaf','Leaf',`g${depth}`,'Leaf')
  return createMotionScene({componentId:'sanverse.depth-stress',componentVersion:1,rootNodeId:'g0',nodes,semanticParts:Object.freeze([{id:'all',label:'All',role:'content-group',nodeIds:Object.freeze(Object.keys(nodes))}]),exposures:Object.freeze([]),layout:Object.freeze({mode:'responsive',ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9'])})
}
const siblingScene=(count:number):MotionSceneV1=>{
  const childIds=Array.from({length:count},(_,index)=>`n${index}`);const nodes:Record<string,MotionGroupNodeV1|MotionTextNodeV1>={root:group('root','Root',null,childIds)};for(const [index,id] of childIds.entries())nodes[id]=text(id,`Node ${index}`,'root',`Node ${index}`)
  return createMotionScene({componentId:'sanverse.width-stress',componentVersion:1,rootNodeId:'root',nodes,semanticParts:Object.freeze([{id:'all',label:'All',role:'content-group',nodeIds:Object.freeze(childIds)}]),exposures:Object.freeze([]),layout:Object.freeze({mode:'responsive',ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9'])})
}

describe('C3 render enable and authoring lock separation',()=>{
  it('keeps enabled distinct from animated visibility and preserves the track across eye toggles',()=>{
    const before=scene()
    const hidden=applyMotionOperation(before,{operationId:'eye-off',type:'set-node-enabled',nodeId:'value',enabled:false})
    expect(hidden.ok).toBe(true)
    if(!hidden.ok) return
    expect(hidden.scene.nodes.value!.enabled).toBe(false)
    expect(hidden.scene.nodes.value!.visible).toEqual(before.nodes.value!.visible)
    const hiddenResolved=evaluateScene(hidden.scene,context(500)).nodes.value!
    expect(hiddenResolved).toMatchObject({enabled:false,effectiveEnabled:false,visible:true})
    const shown=applyMotionOperation(hidden.scene,{operationId:'eye-on',type:'set-node-enabled',nodeId:'value',enabled:true})
    expect(shown.ok).toBe(true)
    if(!shown.ok) return
    expect(shown.scene.nodes.value!.visible).toEqual(before.nodes.value!.visible)
    expect(evaluateScene(shown.scene,context(1_500)).nodes.value!.visible).toBe(false)
  })

  it('computes ancestor enable without mutating child local state',()=>{
    const base=scene()
    const parentOff=applyMotionOperation(base,{operationId:'hero-off',type:'set-node-enabled',nodeId:'hero',enabled:false})
    expect(parentOff.ok).toBe(true)
    if(!parentOff.ok) return
    const resolved=evaluateScene(parentOff.scene,context())
    expect(resolved.nodes.hero).toMatchObject({enabled:false,effectiveEnabled:false})
    expect(resolved.nodes.value).toMatchObject({enabled:true,effectiveEnabled:false})
    const parentOn=applyMotionOperation(parentOff.scene,{operationId:'hero-on',type:'set-node-enabled',nodeId:'hero',enabled:true})
    expect(parentOn.ok).toBe(true)
    if(!parentOn.ok) return
    expect(evaluateScene(parentOn.scene,context()).nodes.value).toMatchObject({enabled:true,effectiveEnabled:true})
  })

  it('stores locks outside render state, round-trips authoring metadata, and refuses edits through direct or ancestor locks while eye remains usable',()=>{
    const base=scene()
    const metadata=setMotionNodeLocked(createMotionAuthoringMetadata(),base,'hero',true)
    expect(validateMotionAuthoringMetadata(base,metadata)).toEqual([])
    expect(parseMotionAuthoringMetadata(base,serializeMotionAuthoringMetadata(metadata))).toEqual(metadata)
    expect(motionNodeLockState(base,metadata,'value')).toMatchObject({directlyLocked:false,effectiveLocked:true,lockedByAncestorNodeId:'hero'})
    const rename=applyMotionOperation(base,{operationId:'locked-rename',type:'rename-node',nodeId:'value',name:'Locked Value'},{authoringMetadata:metadata})
    expect(rename).toMatchObject({ok:false,error:{code:'LOCKED'}})
    const eye=applyMotionOperation(base,{operationId:'locked-eye',type:'set-node-enabled',nodeId:'value',enabled:false},{authoringMetadata:metadata})
    expect(eye.ok).toBe(true)
    const unlocked=setMotionNodeLocked(metadata,base,'hero',false)
    expect(applyMotionOperation(base,{operationId:'unlocked-rename',type:'rename-node',nodeId:'value',name:'Editable again'},{authoringMetadata:unlocked}).ok).toBe(true)
    expect(JSON.stringify(metadata)).not.toContain('enabled')
    expect(JSON.stringify(base)).not.toContain('lockedNodeIds')
  })
})

describe('C3 pure layer projection',()=>{
  it('projects every native graph node family without inventing layer-only node types',()=>{
    const path: MotionPathNodeV1=Object.freeze({...nodeBase('path','Path','root'),type:'path',pathData:'M0 0 L100 100',fillColor:constant('transparent'),strokeColor:constant('#fff'),strokeWidth:constant(2),trimProgress:constant(1)})
    const image: MotionImageNodeV1=Object.freeze({...nodeBase('image','Image','root'),type:'image',source:'fixture://image',width:constant(320),height:constant(180),fit:'contain',imageOpacity:constant(1)})
    const nativeScene=createMotionScene({componentId:'sanverse.native-nodes',componentVersion:1,rootNodeId:'root',nodes:Object.freeze({root:group('root','Root',null,['text','shape','path','image']),text:text('text','Text','root','Hello'),shape:shape('shape','Shape','root'),path,image}),semanticParts:Object.freeze([{id:'all',label:'All',role:'content-group',nodeIds:Object.freeze(['text','shape','path','image'])}]),exposures:Object.freeze([]),layout:Object.freeze({mode:'responsive',ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9'])})
    const projection=projectMotionLayers({scene:nativeScene,resolvedScene:evaluateScene(nativeScene,context())})
    expect(projection.preorderNodeIds.map((nodeId)=>projection.layersById[nodeId]?.nodeType)).toEqual(['group','text','shape','path','image'])
  })

  it('derives hierarchy, human names, semantic parts, dynamic badges and effective states from the graph',()=>{
    const base=scene()
    const metadata=setMotionNodeLocked(createMotionAuthoringMetadata(),base,'hero',true)
    const resolved=evaluateScene(base,context(500))
    const projection=projectMotionLayers({scene:base,resolvedScene:resolved,authoringMetadata:metadata})
    expect(projection.preorderNodeIds).toEqual(['root','surface','hero','label','value','footer'])
    expect(projection.layersById.root).toMatchObject({depth:0,parentNodeId:null,nodeType:'group'})
    expect(projection.layersById.value).toMatchObject({depth:2,displayName:'Value — $24K',effectiveLocked:true,lockedByAncestorNodeId:'hero',hasKeyframes:true,effectCount:0,maskCount:0})
    expect(projection.layersById.label?.semanticPartIds).toContain('hero')
  })

  it('filters by name/type/semantic/id and preserves the ancestor chain',()=>{
    const projection=projectMotionLayers({scene:scene(),resolvedScene:evaluateScene(scene(),context())})
    const filtered=filterMotionLayerProjection(projection,'$24k')
    expect(filtered.visibleNodeIds).toEqual(['root','hero','value'])
    expect(filtered.requiredAncestorNodeIds).toEqual(expect.arrayContaining(['root','hero']))
  })
})

describe('C3 hierarchy stress invariants',()=>{
  it.each([1,3,5,10,20])('projects depth %i without recursion drift',(depth)=>{
    const testScene=depthScene(depth);const projection=projectMotionLayers({scene:testScene,resolvedScene:evaluateScene(testScene,context())});
    expect(projection.layersById.leaf?.depth).toBe(depth+1)
    expect(projection.preorderNodeIds).toHaveLength(depth+2)
  })

  it.each([10,50,100,500,1000])('projects %i siblings with stable order',(count)=>{
    const testScene=siblingScene(count);const projection=projectMotionLayers({scene:testScene,resolvedScene:evaluateScene(testScene,context())});
    expect(projection.preorderNodeIds).toHaveLength(count+1)
    expect(projection.layersById.root?.childNodeIds).toEqual(Array.from({length:count},(_,index)=>`n${index}`))
  })
})

describe('C3 canonical selection helpers',()=>{
  it('supports toggle/range with one primary and anchor',()=>{
    const visible=['root','surface','hero','label','value','footer']
    const initial=createMotionSelectionState(['surface'],'surface','surface')
    const toggled=toggleMotionNodeSelection(initial,'hero')
    expect(toggled).toMatchObject({selectedNodeIds:['surface','hero'],primaryNodeId:'hero',anchorNodeId:'surface'})
    const range=selectMotionNodeRange(toggled,'value',visible)
    expect(range.selectedNodeIds).toEqual(['surface','hero','label','value'])
    expect(range.primaryNodeId).toBe('value')
  })

  it('chooses deterministic next/previous/parent/root fallback after delete',()=>{
    const before=scene()
    const removed=applyMotionOperation(before,{operationId:'delete-value',type:'remove-node',nodeId:'value',mode:'subtree'})
    expect(removed.ok).toBe(true)
    if(!removed.ok) return
    expect(selectionFallbackAfterDelete(before,removed.scene,['value'],'value')).toBe('label')
  })
})
