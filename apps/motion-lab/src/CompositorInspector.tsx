import { constant, readMotionAnimatableTarget } from '@sanverse/motion-graph'
import type { MotionAuthoringMetadataV1, MotionGraphOperationV1, MotionNodePropertyNameV1, MotionSceneV1, MotionSelectionStateV1, ResolvedMotionSceneV1 } from '@sanverse/motion-graph'

export interface CompositorInspectorProps {
  readonly scene: MotionSceneV1 | null
  readonly resolvedScene: ResolvedMotionSceneV1 | null
  readonly authoringMetadata: MotionAuthoringMetadataV1
  readonly selection: MotionSelectionStateV1
  readonly onOperation: (operation: MotionGraphOperationV1) => void
  readonly nextOperationId: (kind: string) => string
}

const properties: readonly Readonly<{ property: MotionNodePropertyNameV1; label: string; step: number }>[] = Object.freeze([
  { property:'transform.positionX',label:'Position X',step:1 },
  { property:'transform.positionY',label:'Position Y',step:1 },
  { property:'transform.scaleX',label:'Scale X',step:.01 },
  { property:'transform.scaleY',label:'Scale Y',step:.01 },
  { property:'transform.rotationDeg',label:'Rotation',step:.5 },
  { property:'transform.anchorX',label:'Anchor X',step:.01 },
  { property:'transform.anchorY',label:'Anchor Y',step:.01 },
  { property:'opacity',label:'Opacity',step:.01 },
])

export function CompositorInspector({ scene, resolvedScene, authoringMetadata, selection, onOperation, nextOperationId }: CompositorInspectorProps) {
  if (!scene || !resolvedScene) return <section className="motion-lab__inspector-section"><h2>Compositor</h2><small>No graph scene.</small></section>
  if (selection.selectedNodeIds.length !== 1 || !selection.primaryNodeId) return <section className="motion-lab__inspector-section" data-compositor-inspector="multi"><h2>Compositor</h2><div className="motion-lab__node-summary"><strong>{selection.selectedNodeIds.length} layers selected</strong><span>Use Layers for Group, Delete, Duplicate, Enable and Lock. Property editing stays conservative in C3.</span></div></section>
  const nodeId = selection.primaryNodeId
  const node = scene.nodes[nodeId]
  const resolved = resolvedScene.nodes[nodeId]
  if (!node || !resolved) return <section className="motion-lab__inspector-section"><h2>Compositor</h2><small>Selected node is unavailable.</small></section>
  const directlyLocked = authoringMetadata.lockedNodeIds.includes(nodeId)
  let ancestor = node.parentId
  let lockedByAncestor: string | null = null
  while (ancestor) {
    if (authoringMetadata.lockedNodeIds.includes(ancestor)) { lockedByAncestor = ancestor; break }
    ancestor = scene.nodes[ancestor]?.parentId ?? null
  }
  const locked = directlyLocked || lockedByAncestor !== null
  return <section className="motion-lab__inspector-section" data-compositor-inspector="single">
    <h2>Node</h2>
    <div className="motion-lab__node-summary"><strong>{node.name}</strong><span>{node.id}</span><small>{node.type} · {resolved.effectiveEnabled ? 'render enabled' : 'effectively hidden'}{locked ? ' · locked' : ''}</small>{lockedByAncestor ? <span>Locked by ancestor: {scene.nodes[lockedByAncestor]?.name ?? lockedByAncestor}</span> : null}</div>
    <label><span className="motion-lab__field-label">Enable</span><div className="motion-lab__schema-readonly">{resolved.enabled ? 'On' : 'Off'} · effective {resolved.effectiveEnabled ? 'On' : 'Off'} · use Layer eye</div></label>
    <h2>Transform + Opacity</h2>
    {properties.map(({property,label,step})=>{
      const record=readMotionAnimatableTarget(scene,{kind:'node',nodeId,property})
      const resolvedValue = property === 'opacity' ? resolved.opacity : resolved.transform[property.slice('transform.'.length) as keyof typeof resolved.transform]
      const editable = record.animatable.kind === 'constant' && !locked
      return <label key={property} data-compositor-property={property}><span className="motion-lab__field-label">{label}</span>{editable ? <input type="number" step={step} value={typeof resolvedValue==='number'?resolvedValue:0} onChange={(event)=>onOperation({operationId:nextOperationId('compositor-property'),type:'set-property',target:{nodeId,property},value:constant(Number(event.target.value))})}/> : <div className="motion-lab__schema-readonly">{String(resolvedValue)} · {locked ? 'locked' : record.animatable.kind === 'keyframes' ? 'keyframed — edit in C2 Animation' : `${record.animatable.kind} authority — no silent overwrite`}</div>}</label>
    })}
    <label><span className="motion-lab__field-label">Blend</span><div className="motion-lab__schema-readonly">{node.blendMode} · edit in Advanced Effects/Blend section</div></label>
    <div className="motion-lab__node-debug"><strong>Processing</strong><span>{node.effects.length} effect{node.effects.length===1?'':'s'}</span><span>{node.masks.length} mask{node.masks.length===1?'':'s'}</span><span>{locked ? 'Mutations refused while locked' : 'Editable through C1 operations'}</span></div>
  </section>
}
