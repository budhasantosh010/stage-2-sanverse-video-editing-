import { validateMotionScene, type MotionSceneV1 } from '@sanverse/motion-graph'

export interface MotionResourceLeaseV15 {
  readonly id: string
  readonly kind: 'preview-cache'|'sandbox'|'poster'|'external-asset'|'other'
  readonly ownerId: string
  readonly acquiredAtSequence: number
}

export interface MotionResourceLedgerV15 {
  readonly acquire: (lease: Omit<MotionResourceLeaseV15,'acquiredAtSequence'>) => MotionResourceLeaseV15
  readonly release: (id: string) => boolean
  readonly releaseOwner: (ownerId: string) => number
  readonly active: () => readonly MotionResourceLeaseV15[]
  readonly assertReleased: (ownerId?: string) => Readonly<{ok:boolean;leaks:readonly MotionResourceLeaseV15[]}>
}

export const createMotionResourceLedgerV15 = (): MotionResourceLedgerV15 => {
  let sequence=0
  const active=new Map<string,MotionResourceLeaseV15>()
  return Object.freeze({
    acquire:(input: Omit<MotionResourceLeaseV15,'acquiredAtSequence'>)=>{
      if(!input.id.trim()||!input.ownerId.trim())throw new RangeError('Resource lease id and ownerId are required.')
      if(active.has(input.id))throw new RangeError(`Resource lease already active: ${input.id}`)
      const lease=Object.freeze({...input,acquiredAtSequence:++sequence})
      active.set(lease.id,lease)
      return lease
    },
    release:(id:string)=>active.delete(id),
    releaseOwner:(ownerId:string)=>{let count=0;for(const [id,lease] of active)if(lease.ownerId===ownerId){active.delete(id);count+=1}return count},
    active:()=>Object.freeze([...active.values()].sort((a,b)=>a.acquiredAtSequence-b.acquiredAtSequence)),
    assertReleased:(ownerId?:string)=>{const leaks=[...active.values()].filter(lease=>!ownerId||lease.ownerId===ownerId);return Object.freeze({ok:leaks.length===0,leaks:Object.freeze(leaks)})},
  })
}

export interface MotionSceneReferenceAuditV15 {
  readonly ok: boolean
  readonly nodeCount: number
  readonly bindingCount: number
  readonly maskCount: number
  readonly matteCount: number
  readonly expertAssetReferences: number
  readonly issues: readonly string[]
}

/** Independent reliability audit layered over the canonical validator. */
export const auditMotionSceneReferencesV15 = (scene:MotionSceneV1):MotionSceneReferenceAuditV15=>{
  const issues:string[]=[]
  const validated=validateMotionScene(scene)
  if(!validated.ok)issues.push(...validated.issues.map(issue=>`${issue.path}: ${issue.message}`))
  let bindings=0,masks=0,expertAssets=0
  for(const node of Object.values(scene.nodes)){
    if(node.parentId&&!scene.nodes[node.parentId])issues.push(`Node ${node.id} has missing parent ${node.parentId}.`)
    if(node.type==='group')for(const childId of node.childIds)if(!scene.nodes[childId])issues.push(`Group ${node.id} references missing child ${childId}.`)
    const inspect=(value:unknown)=>{if(value&&typeof value==='object'&&!Array.isArray(value)&&(value as {kind?:string}).kind==='binding'){bindings+=1;const source=(value as {binding?:{source?:{nodeId?:string}}}).binding?.source?.nodeId;if(source&&!scene.nodes[source])issues.push(`Binding on ${node.id} references missing node ${source}.`)}}
    inspect(node.visible);inspect(node.opacity);for(const value of Object.values(node.transform))inspect(value)
    masks+=node.masks.length
    if(node.type==='expert')expertAssets+=node.expert.assets?.length??0
  }
  for(const matte of scene.compositing?.mattes??[]){if(!scene.nodes[matte.sourceNodeId]||!scene.nodes[matte.targetNodeId])issues.push(`Matte ${matte.id} references missing source/target.`)}
  return Object.freeze({ok:issues.length===0,nodeCount:Object.keys(scene.nodes).length,bindingCount:bindings,maskCount:masks,matteCount:scene.compositing?.mattes.length??0,expertAssetReferences:expertAssets,issues:Object.freeze(issues)})
}

export interface MotionSerializationStressResultV15 {
  readonly ok:boolean
  readonly cycles:number
  readonly bytes:number
  readonly stableHash:string
  readonly issues:readonly string[]
}
const fnv1a=(value:string):string=>{let hash=0x811c9dc5;for(let i=0;i<value.length;i+=1){hash^=value.charCodeAt(i);hash=Math.imul(hash,0x01000193)}return(hash>>>0).toString(16).padStart(8,'0')}

export const runMotionSerializationStressV15=(scene:MotionSceneV1,cycles=25):MotionSerializationStressResultV15=>{
  const count=Math.max(1,Math.min(250,Math.floor(cycles)))
  const issues:string[]=[]
  const initial=JSON.stringify(scene),hash=fnv1a(initial)
  let current:unknown=scene
  for(let index=0;index<count;index+=1){
    const serialized=JSON.stringify(current)
    if(fnv1a(serialized)!==hash)issues.push(`Serialization hash drifted at cycle ${index}.`)
    try{current=JSON.parse(serialized)}catch{issues.push(`Serialization parse failed at cycle ${index}.`);break}
    const audit=auditMotionSceneReferencesV15(current as MotionSceneV1)
    if(!audit.ok){issues.push(`Reference audit failed at cycle ${index}: ${audit.issues.join(' ')}`);break}
  }
  return Object.freeze({ok:issues.length===0,cycles:count,bytes:new TextEncoder().encode(initial).byteLength,stableHash:hash,issues:Object.freeze(issues)})
}

export interface MotionLongProjectCycleStateV15 {
  readonly revision:number
  readonly activeSandboxIds:readonly string[]
  readonly historyDepth:number
  readonly promotedCapabilityIds:readonly string[]
  readonly resourceCount:number
}

/**
 * A small deterministic state-machine probe used by the long-project suite to
 * detect stale sandbox/history/resource bookkeeping independently of UI code.
 */
export const runMotionLongProjectLifecycleV15=(cycles=50):Readonly<{ok:boolean;states:readonly MotionLongProjectCycleStateV15[];finalResources:number}>=>{
  const ledger=createMotionResourceLedgerV15(),states:MotionLongProjectCycleStateV15[]=[]
  let revision=1,historyDepth=0
  const promoted=new Set<string>()
  for(let index=0;index<Math.max(10,cycles);index+=1){
    const sandbox=`sandbox:${index}`
    ledger.acquire({id:`resource:${sandbox}`,kind:'sandbox',ownerId:sandbox})
    ledger.acquire({id:`preview:${sandbox}`,kind:'preview-cache',ownerId:sandbox})
    revision+=1
    if(index%3===0){historyDepth+=1;promoted.add(`capability:${Math.floor(index/3)}`);revision+=1}
    if(index%5===0&&historyDepth>0){historyDepth-=1;revision+=1}
    ledger.releaseOwner(sandbox)
    states.push(Object.freeze({revision,activeSandboxIds:Object.freeze([]),historyDepth,promotedCapabilityIds:Object.freeze([...promoted]),resourceCount:ledger.active().length}))
  }
  const final=ledger.assertReleased()
  return Object.freeze({ok:final.ok&&states.every(state=>state.resourceCount===0),states:Object.freeze(states),finalResources:final.leaks.length})
}
