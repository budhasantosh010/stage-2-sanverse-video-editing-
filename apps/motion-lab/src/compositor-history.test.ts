import { describe, expect, it } from 'vitest'
import { createMotionAuthoringMetadata, createMotionSelectionState } from '@sanverse/motion-graph'
import { createCompositorHistory, pushCompositorHistory, redoCompositorHistory, undoCompositorHistory } from './compositor-history.ts'

const snapshot=(id:string)=>({graphOperations:Object.freeze([]),authoringMetadata:createMotionAuthoringMetadata(id==='locked'?['node']:[]),selection:createMotionSelectionState(id==='empty'?[]:[id],id==='empty'?null:id,id==='empty'?null:id)})

describe('Motion Lab compositor history',()=>{
  it('stores one snapshot per user transaction, supports undo/redo and clears redo after a new edit',()=>{
    let history=createCompositorHistory(3)
    history=pushCompositorHistory(history,snapshot('a'))
    history=pushCompositorHistory(history,snapshot('b'))
    const undone=undoCompositorHistory(history,snapshot('c'))
    expect(undone.snapshot?.selection.primaryNodeId).toBe('b')
    expect(undone.history.redo).toHaveLength(1)
    const redone=redoCompositorHistory(undone.history,undone.snapshot!)
    expect(redone.snapshot?.selection.primaryNodeId).toBe('c')
    const branched=pushCompositorHistory(undone.history,snapshot('x'))
    expect(branched.redo).toEqual([])
  })

  it('caps retained debug history',()=>{
    let history=createCompositorHistory(2)
    history=pushCompositorHistory(history,snapshot('a'))
    history=pushCompositorHistory(history,snapshot('b'))
    history=pushCompositorHistory(history,snapshot('c'))
    expect(history.undo.map(entry=>entry.selection.primaryNodeId)).toEqual(['b','c'])
  })

  it('records a five-key C4 drag as one undo transaction, not five history entries',()=>{
    const before=snapshot('value')
    const fiveMoveOperations=Object.freeze(Array.from({length:5},(_,index)=>Object.freeze({operationId:`c4-move:${index}`,type:'move-keyframe' as const,target:{kind:'node' as const,nodeId:'value',property:'opacity' as const},keyframeId:`kf-${index}`,tick:(index+1)*48000})))
    const after={...before,graphOperations:fiveMoveOperations}
    let history=createCompositorHistory(10)
    history=pushCompositorHistory(history,before)
    expect(history.undo).toHaveLength(1)
    const undone=undoCompositorHistory(history,after)
    expect(undone.snapshot?.graphOperations).toEqual(before.graphOperations)
    expect(undone.history.redo).toHaveLength(1)
    const redone=redoCompositorHistory(undone.history,undone.snapshot!)
    expect(redone.snapshot?.graphOperations).toEqual(fiveMoveOperations)
  })
})
