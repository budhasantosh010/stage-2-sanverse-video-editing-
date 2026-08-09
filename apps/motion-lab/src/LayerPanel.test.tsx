import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMotionAuthoringMetadata, createMotionSelectionState, evaluateScene, projectMotionLayers } from '@sanverse/motion-graph'
import { DEFAULT_KINETIC_HEADLINE_PROPS, DEFAULT_KINETIC_HEADLINE_STYLE, KineticHeadlineModule, MOTION_REFERENCE_COMPOSITIONS } from '@sanverse/motion-library'
import { SANVERSE_TICKS_PER_SECOND } from '@sanverse/motion-primitives'
import { LayerPanel } from './LayerPanel.tsx'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const context={localTicks:SANVERSE_TICKS_PER_SECOND,durationTicks:SANVERSE_TICKS_PER_SECOND*3,ticksPerSecond:SANVERSE_TICKS_PER_SECOND,composition:MOTION_REFERENCE_COMPOSITIONS['16:9'],reducedMotion:false} as const
const scene=KineticHeadlineModule.createScene(DEFAULT_KINETIC_HEADLINE_PROPS,DEFAULT_KINETIC_HEADLINE_STYLE,context)
const projection=projectMotionLayers({scene,resolvedScene:evaluateScene(scene,context),authoringMetadata:createMotionAuthoringMetadata()})

const props=()=>({projection,selection:createMotionSelectionState(),canUndo:true,canRedo:false,onSelectNode:vi.fn(),onClearSelection:vi.fn(),onToggleEnabled:vi.fn(),onToggleLock:vi.fn(),onRename:vi.fn(),onDuplicate:vi.fn(),onDuplicateSelection:vi.fn(),onDelete:vi.fn(),onGroup:vi.fn(),onToggleSelectionEnabled:vi.fn(),onToggleSelectionLock:vi.fn(),onUngroup:vi.fn(),onMove:vi.fn(),onDrop:vi.fn(),onAddEffect:vi.fn(),onAddMask:vi.fn(),onFocusSection:vi.fn(),onUndo:vi.fn(),onRedo:vi.fn(),onReset:vi.fn()})

describe('C3 LayerPanel',()=>{
  let container:HTMLDivElement; let root:ReturnType<typeof createRoot>
  beforeEach(()=>{container=document.createElement('div');document.body.appendChild(container);root=createRoot(container)})
  afterEach(()=>{act(()=>root.unmount());container.remove()})

  it('renders graph-derived rows with eye/lock/type/badges and canonical click modifiers',()=>{
    const callbacks=props(); act(()=>root.render(<LayerPanel {...callbacks}/>))
    expect(container.querySelector('[aria-label="Motion Layers"]')).not.toBeNull()
    expect(container.textContent).toContain('graph nodes')
    const rootRow=container.querySelector<HTMLElement>(`[data-layer-node-id="${scene.rootNodeId}"] .motion-lab__layer-row`)
    expect(rootRow).not.toBeNull()
    act(()=>rootRow!.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true})))
    expect(callbacks.onSelectNode).toHaveBeenCalledWith(scene.rootNodeId,expect.objectContaining({toggle:true,range:false}))
    expect(container.querySelector('[aria-label="Disable layer"]')).not.toBeNull()
  })

  it('search keeps ancestor context instead of flattening matching descendants',()=>{
    const callbacks=props(); act(()=>root.render(<LayerPanel {...callbacks}/>))
    const input=container.querySelector<HTMLInputElement>('[aria-label="Search layers"]')!
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!
    act(()=>{setter.call(input,'word');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))})
    expect(container.querySelector(`[data-layer-node-id="${scene.rootNodeId}"]`)).not.toBeNull()
    expect(container.querySelectorAll('[data-layer-node-id]').length).toBeGreaterThan(1)
  })

  it('toolbar keeps one callback per high-value multi action',()=>{
    const selected=createMotionSelectionState(projection.preorderNodeIds.slice(1,3),projection.preorderNodeIds[2]!,projection.preorderNodeIds[1]!)
    const callbacks={...props(),selection:selected}; act(()=>root.render(<LayerPanel {...callbacks}/>))
    const click=(label:string)=>{const button=[...container.querySelectorAll('button')].find(entry=>entry.textContent?.trim()===label);if(!button)throw new Error(label);button.dispatchEvent(new MouseEvent('click',{bubbles:true}))}
    act(()=>click('Duplicate')); expect(callbacks.onDuplicateSelection).toHaveBeenCalledTimes(1)
    act(()=>click('Group')); expect(callbacks.onGroup).toHaveBeenCalledTimes(1)
    act(()=>click('Eye')); expect(callbacks.onToggleSelectionEnabled).toHaveBeenCalledTimes(1)
    act(()=>click('Lock')); expect(callbacks.onToggleSelectionLock).toHaveBeenCalledTimes(1)
    act(()=>click('Delete')); expect(callbacks.onDelete).toHaveBeenCalledTimes(1)
  })
})
