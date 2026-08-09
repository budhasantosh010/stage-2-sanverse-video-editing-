import { useRef, useState } from 'react'
import type { MotionExposureLevel } from '@sanverse/motion-contract'
import {
  MOTION_BLEND_MODES,
  MOTION_EFFECT_REGISTRY,
  MOTION_EFFECT_TYPES,
  applyMotionOperation,
  constant,
  createDefaultEffect,
  createDefaultMask,
  deriveLayerTree,
  deriveNodeEffectRelationships,
  exposuresForLevel,
} from '@sanverse/motion-graph'
import type {
  MotionEffectTypeV1,
  MotionExposureV1,
  MotionGraphOperationV1,
  MotionLayerTreeNodeV1,
  MotionPropertyPrimitiveV1,
  MotionSceneV1,
  ResolvedMotionSceneV1,
} from '@sanverse/motion-graph'

export interface SchemaPropertyBindingValue {
  readonly value: MotionPropertyPrimitiveV1 | readonly MotionPropertyPrimitiveV1[] | null
}

interface GraphInspectorProps {
  readonly level: MotionExposureLevel
  readonly onLevelChange: (level: MotionExposureLevel) => void
  readonly compositorMode?: boolean
  readonly onCompositorModeChange?: (active: boolean) => void
  readonly exposures: readonly MotionExposureV1[]
  readonly scene: MotionSceneV1 | null
  readonly resolvedScene: ResolvedMotionSceneV1 | null
  readonly readExposure: (exposure: MotionExposureV1) => SchemaPropertyBindingValue
  readonly writeExposure: (exposure: MotionExposureV1, value: MotionPropertyPrimitiveV1) => void
  readonly selectedNodeId: string | null
  readonly onSelectNode: (nodeId: string | null) => void
  readonly onOperation: (operation: MotionGraphOperationV1) => void
}

const colorInputValue = (value: unknown): string => typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value) ? value : '#ffffff'

function ExposureControl({ exposure, value, onChange }: Readonly<{
  exposure: MotionExposureV1
  value: MotionPropertyPrimitiveV1 | readonly MotionPropertyPrimitiveV1[] | null
  onChange: (value: MotionPropertyPrimitiveV1) => void
}>) {
  const constraints = exposure.constraints
  const control = exposure.editor
  if (control.type === 'readonly') return <div className="motion-lab__schema-readonly">{Array.isArray(value) ? value.join(', ') : String(value ?? '—')}</div>
  if (control.type === 'toggle') return <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
  if (control.type === 'select') {
    return (
      <select value={String(value ?? control.options[0]?.value ?? '')} onChange={(event) => {
        const selected = control.options.find((option) => String(option.value) === event.target.value)
        if (selected) onChange(selected.value)
      }}>
        {control.options.map((option) => <option key={`${String(option.value)}:${option.label}`} value={String(option.value)}>{option.label}</option>)}
      </select>
    )
  }
  if (control.type === 'slider') {
    const numeric = typeof value === 'number' ? value : constraints?.minimum ?? 0
    return (
      <>
        <input type="range" min={constraints?.minimum} max={constraints?.maximum} step={constraints?.step ?? 0.01} value={numeric} onChange={(event) => onChange(Number(event.target.value))} />
        <small>{Number.isFinite(numeric) ? numeric.toFixed((constraints?.step ?? 1) < 1 ? 2 : 0) : '—'}</small>
      </>
    )
  }
  if (control.type === 'number') return <input type="number" min={constraints?.minimum} max={constraints?.maximum} step={constraints?.step ?? 1} value={typeof value === 'number' ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />
  if (control.type === 'color') return <input type="color" value={colorInputValue(value)} onChange={(event) => onChange(event.target.value)} />
  if (control.type === 'textarea') return <textarea rows={2} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} />
  return <input value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} onChange={(event) => onChange(event.target.value)} placeholder={control.type === 'asset' ? 'asset reference' : undefined} />
}

function LayerTree({ node, selectedNodeId, onSelectNode }: Readonly<{ node: MotionLayerTreeNodeV1; selectedNodeId: string | null; onSelectNode: (id: string) => void }>) {
  return (
    <div className="motion-lab__graph-tree-node">
      <button type="button" aria-pressed={selectedNodeId === node.nodeId} onClick={() => onSelectNode(node.nodeId)}>
        <span>{node.type}</span>
        <strong>{node.name}</strong>
      </button>
      {node.children.length > 0 ? <div className="motion-lab__graph-tree-children">{node.children.map((child) => <LayerTree key={child.nodeId} node={child} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} />)}</div> : null}
    </div>
  )
}

export function GraphInspector({ level, onLevelChange, compositorMode = false, onCompositorModeChange, exposures, scene, resolvedScene, readExposure, writeExposure, selectedNodeId, onSelectNode, onOperation }: GraphInspectorProps) {
  const [effectType, setEffectType] = useState<MotionEffectTypeV1>('glow')
  const effectCounter = useRef(1)
  const maskCounter = useRef(1)
  const operationCounter = useRef(1)
  const nextOperationId = (kind: string): string => `lab-inspector:${kind}:${operationCounter.current++}`
  const visibleExposures = exposuresForLevel(exposures, level)
  const groups = [...new Set(visibleExposures.map((exposure) => exposure.group))]
  const selectedNode = selectedNodeId && scene ? scene.nodes[selectedNodeId] ?? null : null
  const resolvedSelectedNode = selectedNodeId && resolvedScene ? resolvedScene.nodes[selectedNodeId] ?? null : null
  const layerTree = scene ? deriveLayerTree(scene) : null
  const relationships = scene ? deriveNodeEffectRelationships(scene) : []
  const relationship = selectedNodeId ? relationships.find((entry) => entry.nodeId === selectedNodeId) ?? null : null

  const addEffect = () => {
    if (!selectedNodeId) return
    const id = `lab-${effectType}-${effectCounter.current++}`
    onOperation({ operationId: nextOperationId('add-effect'), type: 'add-effect', nodeId: selectedNodeId, effect: createDefaultEffect(id, effectType) })
  }

  const addMask = (type: 'rectangle' | 'rounded-rectangle' | 'ellipse') => {
    if (!selectedNodeId) return
    const id = `lab-${type}-mask-${maskCounter.current++}`
    onOperation({ operationId: nextOperationId('add-mask'), type: 'add-mask', nodeId: selectedNodeId, mask: createDefaultMask(id, type) })
  }

  return (
    <>
      <section className="motion-lab__inspector-section">
        <h2>Editing level</h2>
        <div className="motion-lab__segmented motion-lab__level-switcher" aria-label="Exposure level">
          {(['creator', 'designer', 'advanced'] as const).map((candidate) => <button key={candidate} type="button" aria-pressed={!compositorMode && level === candidate} onClick={() => { onCompositorModeChange?.(false); onLevelChange(candidate) }}>{candidate[0]!.toUpperCase() + candidate.slice(1)}</button>)}
          {onCompositorModeChange ? <button type="button" aria-pressed={compositorMode} onClick={() => { onLevelChange('advanced'); onCompositorModeChange(true) }}>Compositor</button> : null}
        </div>
        <small>One Motion Graph. Each level reveals more of the same underlying composition.</small>
      </section>

      {groups.map((group) => (
        <section key={group} className="motion-lab__inspector-section" data-exposure-group={group}>
          <h2>{group}</h2>
          {visibleExposures.filter((exposure) => exposure.group === group).map((exposure) => {
            const binding = readExposure(exposure)
            return (
              <label key={exposure.id} data-exposure-id={exposure.id}>
                <span className="motion-lab__field-label">{exposure.label}</span>
                <ExposureControl exposure={exposure} value={binding.value} onChange={(value) => writeExposure(exposure, value)} />
              </label>
            )
          })}
        </section>
      ))}

      {level === 'advanced' && scene ? (
        <>
          <section className="motion-lab__inspector-section">
            <h2>Parts</h2>
            <div className="motion-lab__part-list">
              {scene.semanticParts.map((part) => (
                <button key={part.id} type="button" onClick={() => onSelectNode(part.nodeIds[0] ?? null)}>
                  <strong>{part.label}</strong><span>{part.role} · {part.nodeIds.length} node{part.nodeIds.length === 1 ? '' : 's'}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="motion-lab__inspector-section">
            <h2>Layer debug</h2>
            {layerTree ? <LayerTree node={layerTree} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} /> : null}
          </section>

          <section className="motion-lab__inspector-section">
            <h2>Selected node</h2>
            {selectedNode ? (
              <>
                <div className="motion-lab__node-summary"><strong>{selectedNode.name}</strong><span>{selectedNode.id}</span><small>{selectedNode.type}</small></div>
                <label>
                  <span className="motion-lab__field-label">Blend mode</span>
                  <select value={selectedNode.blendMode} onChange={(event) => onOperation({ operationId: nextOperationId('blend'), type: 'set-blend-mode', nodeId: selectedNode.id, blendMode: event.target.value as typeof selectedNode.blendMode })}>
                    {MOTION_BLEND_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                  </select>
                </label>
              </>
            ) : <small>Select a semantic part or layer.</small>}
          </section>

          <section className="motion-lab__inspector-section" data-inspector-section="effects">
            <h2>Effects</h2>
            {selectedNode ? (
              <>
                <div className="motion-lab__advanced-add-row">
                  <select value={effectType} onChange={(event) => setEffectType(event.target.value as MotionEffectTypeV1)}>{MOTION_EFFECT_TYPES.map((type) => <option key={type} value={type}>{MOTION_EFFECT_REGISTRY[type].name}</option>)}</select>
                  <button type="button" onClick={addEffect}>+ Add</button>
                </div>
                {selectedNode.effects.map((effect, index) => {
                  const definition = MOTION_EFFECT_REGISTRY[effect.effectType]
                  const resolvedEffect = resolvedSelectedNode?.effects.find((candidate) => candidate.id === effect.id)
                  return (
                    <div key={effect.id} className="motion-lab__advanced-card">
                      <div className="motion-lab__advanced-card-header">
                        <label className="motion-lab__toggle"><input type="checkbox" checked={effect.enabled} onChange={(event) => onOperation({ operationId: nextOperationId('effect-enabled'), type: 'set-effect-enabled', nodeId: selectedNode.id, effectId: effect.id, enabled: event.target.checked })} /><span>{definition.name}</span></label>
                        <div><button type="button" disabled={index === 0} onClick={() => onOperation({ operationId: nextOperationId('effect-up'), type: 'reorder-effect', nodeId: selectedNode.id, effectId: effect.id, index: index - 1 })}>↑</button><button type="button" disabled={index === selectedNode.effects.length - 1} onClick={() => onOperation({ operationId: nextOperationId('effect-down'), type: 'reorder-effect', nodeId: selectedNode.id, effectId: effect.id, index: index + 1 })}>↓</button><button type="button" onClick={() => onOperation({ operationId: nextOperationId('remove-effect'), type: 'remove-effect', nodeId: selectedNode.id, effectId: effect.id })}>×</button></div>
                      </div>
                      {definition.parameters.map((parameter) => {
                        const current = resolvedEffect?.parameters[parameter.id] ?? parameter.defaultValue
                        return (
                          <label key={parameter.id}>
                            <span className="motion-lab__field-label">{parameter.id}</span>
                            {parameter.type === 'color'
                              ? <input type="color" value={colorInputValue(current)} onChange={(event) => onOperation({ operationId: nextOperationId('effect-property'), type: 'set-effect-property', nodeId: selectedNode.id, effectId: effect.id, parameter: parameter.id, value: constant(event.target.value) })} />
                              : <input type="range" min={parameter.minimum} max={parameter.maximum} step={parameter.step ?? 0.01} value={typeof current === 'number' ? current : Number(parameter.defaultValue)} onChange={(event) => onOperation({ operationId: nextOperationId('effect-property'), type: 'set-effect-property', nodeId: selectedNode.id, effectId: effect.id, parameter: parameter.id, value: constant(Number(event.target.value)) })} />}
                            {parameter.type === 'number' ? <small>{String(current)}</small> : null}
                          </label>
                        )
                      })}
                    </div>
                  )
                })}
              </>
            ) : <small>Select a node to add effects.</small>}
          </section>

          <section className="motion-lab__inspector-section" data-inspector-section="masks">
            <h2>Masks</h2>
            {selectedNode ? (
              <>
                <div className="motion-lab__advanced-add-row">
                  <button type="button" onClick={() => addMask('rectangle')}>+ Rectangle</button>
                  <button type="button" onClick={() => addMask('rounded-rectangle')}>+ Rounded</button>
                  <button type="button" onClick={() => addMask('ellipse')}>+ Ellipse</button>
                </div>
                {selectedNode.masks.map((mask) => {
                  const resolvedMask = resolvedSelectedNode?.masks.find((candidate) => candidate.id === mask.id)
                  return (
                    <div key={mask.id} className="motion-lab__advanced-card">
                      <div className="motion-lab__advanced-card-header"><strong>{mask.type}</strong><button type="button" onClick={() => onOperation({ operationId: nextOperationId('remove-mask'), type: 'remove-mask', nodeId: selectedNode.id, maskId: mask.id })}>×</button></div>
                      <label className="motion-lab__toggle"><input type="checkbox" checked={mask.invert} onChange={(event) => onOperation({ operationId: nextOperationId('mask-invert'), type: 'set-mask-property', nodeId: selectedNode.id, maskId: mask.id, property: 'invert', value: event.target.checked })} /><span>Invert</span></label>
                      {(['opacity', 'feather', 'expansion'] as const).map((property) => {
                        const current = resolvedMask?.[property] ?? (property === 'opacity' ? 1 : 0)
                        return <label key={property}><span className="motion-lab__field-label">{property}</span><input type="range" min={property === 'expansion' ? -0.5 : 0} max={property === 'expansion' ? 0.5 : 1} step={0.01} value={current} onChange={(event) => onOperation({ operationId: nextOperationId('mask-property'), type: 'set-mask-property', nodeId: selectedNode.id, maskId: mask.id, property, value: constant(Number(event.target.value)) })} /><small>{current.toFixed(2)}</small></label>
                      })}
                    </div>
                  )
                })}
              </>
            ) : <small>Select a node to add masks.</small>}
          </section>

          <section className="motion-lab__inspector-section">
            <h2>Node / effect debug</h2>
            {relationship ? <div className="motion-lab__node-debug"><strong>{relationship.nodeName}</strong>{relationship.effects.length ? relationship.effects.map((effect) => <span key={effect.id}>↓ {effect.type}{effect.enabled ? '' : ' (off)'}</span>) : <span>↓ no effects</span>}{relationship.masks.map((mask) => <span key={mask.id}>mask ← {mask.type}</span>)}</div> : <small>Select a node.</small>}
          </section>
        </>
      ) : null}
    </>
  )
}

export const previewOperatedScene = (scene: MotionSceneV1, operations: readonly MotionGraphOperationV1[], durationTicks?: number): Readonly<{ scene: MotionSceneV1; operations: readonly MotionGraphOperationV1[] }> => {
  let current = scene
  const applied: MotionGraphOperationV1[] = []
  for (const operation of operations) {
    const result = applyMotionOperation(current, operation, { durationTicks })
    if (!result.ok) continue
    current = result.scene
    applied.push(operation)
  }
  return { scene: current, operations: Object.freeze(applied) }
}
