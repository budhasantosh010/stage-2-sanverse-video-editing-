import { useEffect, useMemo, useRef, useState } from 'react'
import type { MotionRenderContextV1 } from '@sanverse/motion-contract'
import {
  DEFAULT_MOTION_BEZIER_HANDLES,
  evaluateAnimatable,
  listMotionAnimatableTargetsForNode,
  motionKeyframeTargetKey,
} from '@sanverse/motion-graph'
import type {
  MotionAnimatableTargetRecordV1,
  MotionBezierHandlesV1,
  MotionGraphOperationV1,
  MotionKeyframeInterpolationV1,
  MotionPropertyPrimitiveV1,
  MotionSceneV1,
} from '@sanverse/motion-graph'

interface KeyframeTimelineProps {
  readonly scene: MotionSceneV1 | null
  readonly selectedNodeId: string | null
  readonly localTicks: number
  readonly durationTicks: number
  readonly context: MotionRenderContextV1
  readonly onSeek: (tick: number) => void
  readonly onOperation: (operation: MotionGraphOperationV1) => void
  readonly errorMessage?: string | null
}

const targetDisplay = (record: MotionAnimatableTargetRecordV1): string => `${record.nodeName} / ${record.label}`
const clampTick = (value: number, durationTicks: number): number => Math.max(0, Math.min(durationTicks, Number.isSafeInteger(value) ? value : 0))

const keyframeAtTick = (record: MotionAnimatableTargetRecordV1 | null, tick: number) => record?.animatable.kind === 'keyframes'
  ? record.animatable.keyframes.find((keyframe) => keyframe.tick === tick) ?? null
  : null

const keyframeById = (record: MotionAnimatableTargetRecordV1 | null, id: string | null) => record?.animatable.kind === 'keyframes' && id
  ? record.animatable.keyframes.find((keyframe) => keyframe.id === id) ?? null
  : null

const inputValue = (value: MotionPropertyPrimitiveV1): string => typeof value === 'boolean' ? String(value) : String(value)

export function KeyframeTimeline({ scene, selectedNodeId, localTicks, durationTicks, context, onSeek, onOperation, errorMessage = null }: KeyframeTimelineProps) {
  const operationCounter = useRef(1)
  const keyframeCounter = useRef(1)
  const nextOperationId = (kind: string): string => `lab-keyframe:${kind}:${operationCounter.current++}`
  const targets = useMemo(() => selectedNodeId && scene ? listMotionAnimatableTargetsForNode(scene, selectedNodeId) : Object.freeze([]), [scene, selectedNodeId])
  const numericTargets = useMemo(() => targets.filter((target) => target.capability.valueType === 'number'), [targets])
  const [targetKey, setTargetKey] = useState('')
  const selectedTarget = numericTargets.find((target) => motionKeyframeTargetKey(target.target) === targetKey) ?? numericTargets[0] ?? null
  const effectiveTargetKey = selectedTarget ? motionKeyframeTargetKey(selectedTarget.target) : ''
  const currentDiamond = keyframeAtTick(selectedTarget, localTicks)
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null)
  const selectedKeyframe = keyframeById(selectedTarget, selectedKeyframeId) ?? currentDiamond

  useEffect(() => {
    if (!selectedTarget) {
      setTargetKey('')
      setSelectedKeyframeId(null)
      return
    }
    if (targetKey !== effectiveTargetKey) setTargetKey(effectiveTargetKey)
    if (selectedKeyframeId && !keyframeById(selectedTarget, selectedKeyframeId)) setSelectedKeyframeId(null)
  }, [effectiveTargetKey, selectedKeyframeId, selectedTarget, targetKey])

  const currentResolvedValue = selectedTarget ? evaluateAnimatable(selectedTarget.animatable, context) : 0
  const [draftValue, setDraftValue] = useState('0')
  const [draftTick, setDraftTick] = useState(localTicks)
  const [draftInterpolation, setDraftInterpolation] = useState<MotionKeyframeInterpolationV1>('linear')
  const [draftBezier, setDraftBezier] = useState<MotionBezierHandlesV1>(DEFAULT_MOTION_BEZIER_HANDLES)

  useEffect(() => {
    const source = selectedKeyframe?.value ?? currentResolvedValue
    setDraftValue(inputValue(source))
    setDraftTick(selectedKeyframe?.tick ?? localTicks)
    setDraftInterpolation(selectedKeyframe?.interpolation ?? 'linear')
    setDraftBezier(selectedKeyframe?.bezier ?? DEFAULT_MOTION_BEZIER_HANDLES)
  }, [currentResolvedValue, localTicks, selectedKeyframe?.bezier, selectedKeyframe?.id, selectedKeyframe?.interpolation, selectedKeyframe?.tick, selectedKeyframe?.value])

  const emit = (operation: MotionGraphOperationV1): void => onOperation(Object.freeze(operation))

  const addKeyframe = (): void => {
    if (!selectedTarget) return
    const keyframeId = `lab-kf-${keyframeCounter.current++}`
    emit({
      operationId: nextOperationId('add'),
      type: 'add-keyframe',
      target: selectedTarget.target,
      keyframeId,
      tick: localTicks,
      interpolation: 'linear',
    })
    setSelectedKeyframeId(keyframeId)
  }

  const removeKeyframe = (): void => {
    if (!selectedTarget || !selectedKeyframe) return
    emit({ operationId: nextOperationId('remove'), type: 'remove-keyframe', target: selectedTarget.target, keyframeId: selectedKeyframe.id })
    setSelectedKeyframeId(null)
  }

  const applyValue = (): void => {
    if (!selectedTarget || !selectedKeyframe) return
    const value = Number(draftValue)
    if (!Number.isFinite(value)) return
    emit({ operationId: nextOperationId('value'), type: 'set-keyframe-value', target: selectedTarget.target, keyframeId: selectedKeyframe.id, value })
  }

  const applyTick = (): void => {
    if (!selectedTarget || !selectedKeyframe) return
    const tick = clampTick(draftTick, durationTicks)
    emit({ operationId: nextOperationId('move'), type: 'move-keyframe', target: selectedTarget.target, keyframeId: selectedKeyframe.id, tick })
    onSeek(tick)
  }

  const applyInterpolation = (interpolation: MotionKeyframeInterpolationV1): void => {
    setDraftInterpolation(interpolation)
    if (!selectedTarget || !selectedKeyframe) return
    emit({ operationId: nextOperationId('interpolation'), type: 'set-keyframe-interpolation', target: selectedTarget.target, keyframeId: selectedKeyframe.id, interpolation })
  }

  const applyBezier = (): void => {
    if (!selectedTarget || !selectedKeyframe) return
    emit({ operationId: nextOperationId('bezier'), type: 'set-keyframe-bezier', target: selectedTarget.target, keyframeId: selectedKeyframe.id, bezier: draftBezier })
  }

  const keyframes = selectedTarget?.animatable.kind === 'keyframes' ? selectedTarget.animatable.keyframes : Object.freeze([])

  return (
    <section className="motion-lab__inspector-section motion-lab__keyframe-timeline" data-motion-keyframe-timeline="true">
      <h2>Animation · C2 keyframes</h2>
      <small>Developer proof only. One property owns one Animatable authority; manual keyframes use exact Sanverse ticks.</small>
      {selectedNodeId && numericTargets.length > 0 ? (
        <>
          <label>
            <span className="motion-lab__field-label">Property</span>
            <select aria-label="Keyframe property" value={effectiveTargetKey} onChange={(event) => { setTargetKey(event.target.value); setSelectedKeyframeId(null) }}>
              {numericTargets.map((target) => <option key={motionKeyframeTargetKey(target.target)} value={motionKeyframeTargetKey(target.target)}>{targetDisplay(target)}</option>)}
            </select>
          </label>
          <div className="motion-lab__keyframe-readout">
            <span className="motion-lab__diamond" data-keyframe-at-current-tick={currentDiamond ? 'true' : 'false'}>{currentDiamond ? '◆' : '◇'}</span>
            <div><strong>{currentDiamond ? 'Keyframe at current tick' : 'No keyframe at current tick'}</strong><small>{localTicks.toLocaleString()} ticks · resolved {String(currentResolvedValue)}</small></div>
            <button type="button" disabled={Boolean(currentDiamond)} onClick={addKeyframe}>+ Keyframe</button>
          </div>
          {keyframes.length > 0 ? (
            <div className="motion-lab__keyframe-strip" aria-label="Keyframe strip">
              {keyframes.map((keyframe) => (
                <button
                  key={keyframe.id}
                  type="button"
                  aria-pressed={selectedKeyframe?.id === keyframe.id}
                  style={{ left: `${durationTicks > 0 ? (keyframe.tick / durationTicks) * 100 : 0}%` }}
                  title={`${keyframe.id} · ${keyframe.tick}`}
                  onClick={() => { setSelectedKeyframeId(keyframe.id); onSeek(keyframe.tick) }}
                >◆</button>
              ))}
            </div>
          ) : <small>This property is currently {selectedTarget?.animatable.kind ?? 'unknown'}. Constants can become keyframes directly; motion drivers require a later explicit bake/reset.</small>}
          {selectedKeyframe ? (
            <div className="motion-lab__advanced-card motion-lab__keyframe-editor" data-selected-keyframe-id={selectedKeyframe.id}>
              <div className="motion-lab__advanced-card-header"><strong>{selectedKeyframe.id}</strong><button type="button" onClick={removeKeyframe}>Remove</button></div>
              <label><span className="motion-lab__field-label">Tick</span><div className="motion-lab__keyframe-inline"><input aria-label="Keyframe tick" type="number" min={0} max={durationTicks} step={1} value={draftTick} onChange={(event) => setDraftTick(Number(event.target.value))} /><button type="button" onClick={applyTick}>Move</button></div></label>
              <label><span className="motion-lab__field-label">Value</span><div className="motion-lab__keyframe-inline"><input aria-label="Keyframe value" type="number" step="any" value={draftValue} onChange={(event) => setDraftValue(event.target.value)} /><button type="button" onClick={applyValue}>Set</button></div></label>
              <label><span className="motion-lab__field-label">Interpolation</span><select aria-label="Keyframe interpolation" value={draftInterpolation} onChange={(event) => applyInterpolation(event.target.value as MotionKeyframeInterpolationV1)}>{selectedTarget?.capability.interpolation.map((interpolation) => <option key={interpolation} value={interpolation}>{interpolation}</option>)}</select></label>
              {draftInterpolation === 'bezier' ? (
                <div className="motion-lab__keyframe-bezier">
                  {(['outX', 'outY', 'inX', 'inY'] as const).map((key) => <label key={key}><span className="motion-lab__field-label">{key}</span><input aria-label={`Bezier ${key}`} type="number" min={key.endsWith('X') ? 0 : -4} max={key.endsWith('X') ? 1 : 4} step={0.01} value={draftBezier[key]} onChange={(event) => setDraftBezier((current) => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}
                  <button type="button" onClick={applyBezier}>Apply Bezier</button>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : <small>Select a graph layer with a numeric animatable property.</small>}
      {errorMessage ? <div className="motion-lab__operation-error" role="status">{errorMessage}</div> : null}
    </section>
  )
}
