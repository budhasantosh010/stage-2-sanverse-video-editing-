import type { KeyVisualStateV1 } from './contracts.ts'

export interface StoryboardChangedNodeV1 { readonly nodeId:string; readonly changedProperties:readonly string[] }
export interface StoryboardDiffV1 {
  readonly fromStateId:string
  readonly toStateId:string
  readonly addedNodeIds:readonly string[]
  readonly removedNodeIds:readonly string[]
  readonly changedNodes:readonly StoryboardChangedNodeV1[]
  readonly focusChanged:boolean
  readonly presentationModeChanged:boolean
  readonly sourceTreatmentChanged:boolean
  readonly backgroundTreatmentChanged:boolean
}

const stable=(value:unknown):string=>JSON.stringify(value,(_,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a.localeCompare(b))):entry)
const changedProperties=(a:Record<string,unknown>,b:Record<string,unknown>):readonly string[]=>Object.freeze([...new Set([...Object.keys(a),...Object.keys(b)].filter((key)=>key!=='id'&&stable(a[key])!==stable(b[key])))].sort())
const sameIds=(a:readonly string[],b:readonly string[]):boolean=>a.length===b.length&&a.every((id,index)=>id===b[index])

export const diffStoryboardStatesV1=(from:KeyVisualStateV1,to:KeyVisualStateV1):StoryboardDiffV1=>{
  const fromIds=new Set(Object.keys(from.graphState.nodes)),toIds=new Set(Object.keys(to.graphState.nodes))
  const addedNodeIds=Object.freeze([...toIds].filter((id)=>!fromIds.has(id)).sort()),removedNodeIds=Object.freeze([...fromIds].filter((id)=>!toIds.has(id)).sort())
  const changedNodes:StoryboardChangedNodeV1[]=[]
  for(const nodeId of [...fromIds].filter((id)=>toIds.has(id)).sort()){const a=from.graphState.nodes[nodeId] as unknown as Record<string,unknown>,b=to.graphState.nodes[nodeId] as unknown as Record<string,unknown>;const properties=changedProperties(a,b);if(properties.length)changedNodes.push(Object.freeze({nodeId,changedProperties:properties}))}
  return Object.freeze({fromStateId:from.id,toStateId:to.id,addedNodeIds,removedNodeIds,changedNodes:Object.freeze(changedNodes),focusChanged:!sameIds(from.focusNodeIds,to.focusNodeIds),presentationModeChanged:from.presentationMode!==to.presentationMode,sourceTreatmentChanged:from.sourceTreatment!==to.sourceTreatment,backgroundTreatmentChanged:from.backgroundTreatment!==to.backgroundTreatment})
}

export const diffStoryboardSequenceV1=(states:readonly KeyVisualStateV1[]):readonly StoryboardDiffV1[]=>Object.freeze(states.slice(0,-1).map((state,index)=>diffStoryboardStatesV1(state,states[index+1]!)))
