import { describe, expect, it } from 'vitest'
import {
  applyMotionOperation,
  applyMotionOperations,
  constant,
  createDefaultEffect,
  createDefaultMask,
  createMotionAuthoringMetadata,
  createMotionScene,
  keyframed,
  nodeBase,
  setMotionNodeLocked,
  validateMotionScene,
} from './index.ts'
import type { MotionGroupNodeV1, MotionSceneV1, MotionShapeNodeV1, MotionTextNodeV1 } from './index.ts'

const group=(id:string,parentId:string|null,children:readonly string[]):MotionGroupNodeV1=>Object.freeze({...nodeBase(id,id,parentId),type:'group',childIds:Object.freeze([...children])})
const text=(id:string,parentId:string,value:string):MotionTextNodeV1=>Object.freeze({...nodeBase(id,id,parentId),type:'text',text:constant(value),fillColor:constant('#fff'),fontFamily:'Inter',fontSize:constant(48),fontWeight:constant(700),textAlign:'left'})
const shape=(id:string,parentId:string,color:string):MotionShapeNodeV1=>Object.freeze({...nodeBase(id,id,parentId),type:'shape',shape:'rectangle',width:constant(200),height:constant(100),fillColor:constant(color),strokeColor:constant('#fff'),strokeWidth:constant(1),radius:constant(0)})
const base=():MotionSceneV1=>createMotionScene({componentId:'sanverse.c3-ops',componentVersion:1,rootNodeId:'root',nodes:Object.freeze({
  root:group('root',null,['a','b','g']),
  a:Object.freeze({...shape('a','root','#f00'),transform:Object.freeze({...nodeBase('tmp','tmp',null).transform,positionX:constant(10)})}),
  b:Object.freeze({...shape('b','root','#00f'),effects:Object.freeze([createDefaultEffect('glow','glow')]),masks:Object.freeze([createDefaultMask('mask','rounded-rectangle')])}),
  g:group('g','root',['label','value']),
  label:text('label','g','Label'),
  value:Object.freeze({...text('value','g','Value'),visible:keyframed([{id:'v0',tick:0,value:true,interpolation:'hold'},{id:'v1',tick:1000,value:false,interpolation:'hold'}])}),
}),semanticParts:Object.freeze([{id:'all',label:'All',role:'content-group',nodeIds:Object.freeze(['a','b','g','label','value'])}]),exposures:Object.freeze([]),layout:Object.freeze({mode:'responsive',ownership:Object.freeze([]),formatOverrides:Object.freeze([])}),supportedAspectRatios:Object.freeze(['16:9','9:16','1:1','4:5'])})

const ok=(result:ReturnType<typeof applyMotionOperation>)=>{expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error.message);expect(validateMotionScene(result.scene).ok).toBe(true);return result}

describe('MOTION-C3 hierarchy operations',()=>{
  it('rename preserves stable identity, animation, effects, masks and semantic membership',()=>{
    const scene=base(); const before=scene.nodes.b!
    const renamed=ok(applyMotionOperation(scene,{operationId:'rename',type:'rename-node',nodeId:'b',name:'Blue Card'}))
    expect(renamed.scene.nodes.b).toMatchObject({id:'b',name:'Blue Card',effects:before.effects,masks:before.masks})
    expect(renamed.scene.semanticParts[0]?.nodeIds).toContain('b')
    const valueRenamed=ok(applyMotionOperation(scene,{operationId:'rename-value',type:'rename-node',nodeId:'value',name:'Animated Value'}))
    expect(valueRenamed.scene.nodes.value!.visible).toEqual(scene.nodes.value!.visible)
  })

  it('reorder changes sibling order while preserving selection identity/serialization inputs',()=>{
    const result=ok(applyMotionOperation(base(),{operationId:'reorder',type:'reorder-node',nodeId:'b',index:0}))
    expect((result.scene.nodes.root as MotionGroupNodeV1).childIds).toEqual(['b','a','g'])
    expect(JSON.parse(JSON.stringify(result.scene)).nodes.root.childIds).toEqual(['b','a','g'])
    expect(result.affectedNodeIds).toContain('b')
  })

  it('reparent is explicitly LOCAL-transform preserving and refuses cycles/locked source/locked target',()=>{
    const scene=base(); const beforeTransform=scene.nodes.a!.transform
    const moved=ok(applyMotionOperation(scene,{operationId:'move',type:'reparent-node',nodeId:'a',parentId:'g',index:1}))
    expect(moved.scene.nodes.a!.parentId).toBe('g')
    expect(moved.scene.nodes.a!.transform).toEqual(beforeTransform)
    expect(applyMotionOperation(scene,{operationId:'cycle',type:'reparent-node',nodeId:'g',parentId:'g'})).toMatchObject({ok:false,error:{code:'CYCLE_DETECTED'}})
    const sourceLocked=setMotionNodeLocked(createMotionAuthoringMetadata(),scene,'a',true)
    expect(applyMotionOperation(scene,{operationId:'locked-source',type:'reparent-node',nodeId:'a',parentId:'g'},{authoringMetadata:sourceLocked})).toMatchObject({ok:false,error:{code:'LOCKED'}})
    const targetLocked=setMotionNodeLocked(createMotionAuthoringMetadata(),scene,'g',true)
    expect(applyMotionOperation(scene,{operationId:'locked-target',type:'reparent-node',nodeId:'a',parentId:'g'},{authoringMetadata:targetLocked})).toMatchObject({ok:false,error:{code:'LOCKED'}})
  })

  it('duplicates subtrees with fresh graph/effect/mask IDs while source stays unchanged',()=>{
    const scene=base()
    const duplicated=ok(applyMotionOperation(scene,{operationId:'dup',type:'duplicate-node',nodeId:'b',duplicateId:'b-copy'}))
    const copy=duplicated.scene.nodes['b-copy']!
    expect(copy.id).toBe('b-copy')
    expect(copy.effects[0]?.id).not.toBe(scene.nodes.b!.effects[0]?.id)
    expect(copy.masks[0]?.id).not.toBe(scene.nodes.b!.masks[0]?.id)
    expect(scene.nodes['b-copy']).toBeUndefined()
    expect(duplicated.scene.semanticParts[0]?.nodeIds).toContain('b-copy')
  })

  it('delete remains atomic and prunes stale semantic references',()=>{
    const scene=base()
    const batch=applyMotionOperations(scene,[
      {operationId:'del-a',type:'remove-node',nodeId:'a',mode:'subtree'},
      {operationId:'del-root',type:'remove-node',nodeId:'root',mode:'subtree'},
    ])
    expect(batch).toMatchObject({ok:false,error:{code:'BATCH_FAILED',failedOperationIndex:1}})
    expect(scene.nodes.a).toBeDefined()
    const deleted=ok(applyMotionOperation(scene,{operationId:'del-g',type:'remove-node',nodeId:'g',mode:'subtree'}))
    expect(deleted.scene.nodes.g).toBeUndefined()
    expect(deleted.scene.nodes.label).toBeUndefined()
    expect(deleted.scene.semanticParts.some(part=>part.nodeIds.some(id=>['g','label','value'].includes(id)))).toBe(false)
  })

  it('groups contiguous siblings in relative order with identity group transform and ungroups back',()=>{
    const scene=base()
    const grouped=ok(applyMotionOperation(scene,{operationId:'group',type:'group-nodes',nodeIds:['a','b'],groupId:'group-ab',groupName:'Cards'}))
    expect((grouped.scene.nodes.root as MotionGroupNodeV1).childIds).toEqual(['group-ab','g'])
    expect((grouped.scene.nodes['group-ab'] as MotionGroupNodeV1).childIds).toEqual(['a','b'])
    expect(grouped.scene.nodes['group-ab']!.transform).toEqual(nodeBase('x','x',null).transform)
    const ungrouped=ok(applyMotionOperation(grouped.scene,{operationId:'ungroup',type:'ungroup-nodes',groupId:'group-ab'}))
    expect((ungrouped.scene.nodes.root as MotionGroupNodeV1).childIds).toEqual(['a','b','g'])
  })

  it('visibility eye preserves effects, masks and animation payloads',()=>{
    const scene=base()
    const b=scene.nodes.b!
    const hidden=ok(applyMotionOperation(scene,{operationId:'eye-b',type:'set-node-enabled',nodeId:'b',enabled:false}))
    expect(hidden.scene.nodes.b!.effects).toEqual(b.effects)
    expect(hidden.scene.nodes.b!.masks).toEqual(b.masks)
    const value=scene.nodes.value!
    const hiddenValue=ok(applyMotionOperation(scene,{operationId:'eye-value',type:'set-node-enabled',nodeId:'value',enabled:false}))
    expect(hiddenValue.scene.nodes.value!.visible).toEqual(value.visible)
  })

  it('locked nodes refuse edit classes but visibility eye remains independently usable',()=>{
    const scene=base(); const metadata=setMotionNodeLocked(createMotionAuthoringMetadata(),scene,'g',true)
    const blocked=[
      {operationId:'rename',type:'rename-node',nodeId:'value',name:'No'} as const,
      {operationId:'delete',type:'remove-node',nodeId:'value',mode:'subtree'} as const,
      {operationId:'key',type:'add-keyframe',target:{kind:'node',nodeId:'value',property:'opacity'} as const,keyframeId:'k',tick:100,value:.5,interpolation:'linear'} as const,
    ]
    for(const operation of blocked) expect(applyMotionOperation(scene,operation,{authoringMetadata:metadata})).toMatchObject({ok:false,error:{code:'LOCKED'}})
    const childLocked=setMotionNodeLocked(createMotionAuthoringMetadata(),scene,'value',true)
    expect(applyMotionOperation(scene,{operationId:'delete-parent',type:'remove-node',nodeId:'g',mode:'subtree'},{authoringMetadata:childLocked})).toMatchObject({ok:false,error:{code:'LOCKED'}})
    expect(applyMotionOperation(scene,{operationId:'ungroup-parent',type:'ungroup-nodes',groupId:'g'},{authoringMetadata:childLocked})).toMatchObject({ok:false,error:{code:'LOCKED'}})
    expect(applyMotionOperation(scene,{operationId:'eye',type:'set-node-enabled',nodeId:'value',enabled:false},{authoringMetadata:metadata}).ok).toBe(true)
  })
})
