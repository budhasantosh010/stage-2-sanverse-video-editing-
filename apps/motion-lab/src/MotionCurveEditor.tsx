import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  DEFAULT_MOTION_BEZIER_HANDLES,
  buildMotionCurveBezierOperation,
  buildMotionCurvePresetOperations,
  buildMotionCurveSvgPath,
  fitMotionCurveValueRange,
  projectMotionCurves,
  sampleMotionCurveTrack,
  selectMotionKeyframe,
} from '@sanverse/motion-graph'
import type {
  MotionBezierHandlesV1,
  MotionCurveKeyframeProjectionV1,
  MotionCurvePresetIdV1,
  MotionCurveTrackProjectionV1,
  MotionCurveValueRangeV1,
  MotionGraphOperationV1,
  MotionKeyframeSelectionStateV1,
  MotionSceneV1,
} from '@sanverse/motion-graph'
import { secondsForTicks } from '@sanverse/motion-primitives'

export interface MotionCurveEditorProps {
  readonly scene: MotionSceneV1 | null
  readonly selectedNodeId: string | null
  readonly localTicks: number
  readonly durationTicks: number
  readonly selection: MotionKeyframeSelectionStateV1
  readonly selectedTrackId: string | null
  readonly initialSelectedKeyframeId?: string | null
  readonly errorMessage?: string | null
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly onSeek: (tick: number) => void
  readonly onSelectNode: (nodeId: string) => void
  readonly onSelectionChange: (selection: MotionKeyframeSelectionStateV1) => void
  readonly onTrackChange: (trackId: string | null) => void
  readonly onOperations: (operations: readonly MotionGraphOperationV1[]) => boolean
  readonly nextOperationId: (prefix: string) => string
  readonly onUndo: () => void
  readonly onRedo: () => void
}

const WIDTH = 1000
const HEIGHT = 330
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const presets: readonly MotionCurvePresetIdV1[] = ['linear', 'bezier', 'flat', 'auto', 'soft', 'smooth', 'snappy', 'heavy', 'ease-in', 'ease-out', 'ease-in-out', 'overshoot']
const displayValue = (value: number) => Number(value.toFixed(4)).toString()

const rangeAround = (range: MotionCurveValueRangeV1, scale: number): MotionCurveValueRangeV1 => {
  const center = (range.minimum + range.maximum) / 2, span = Math.max(1e-9, range.maximum - range.minimum) / scale
  return Object.freeze({ minimum: center - span / 2, maximum: center + span / 2 })
}

export function MotionCurveEditor({ scene, selectedNodeId, localTicks, durationTicks, selection, selectedTrackId, initialSelectedKeyframeId = null, errorMessage, canUndo, canRedo, onSeek, onSelectNode, onSelectionChange, onTrackChange, onOperations, nextOperationId, onUndo, onRedo }: MotionCurveEditorProps) {
  const projection = useMemo(() => scene ? projectMotionCurves(scene) : null, [scene])
  const selectedFromKey = useMemo(() => {
    if (!projection || !selection.primaryId) return null
    return projection.tracks.find((track) => track.keyframes.some((key) => key.selectionId === selection.primaryId)) ?? null
  }, [projection, selection.primaryId])
  const activeTrack = useMemo(() => {
    if (!projection) return null
    if (selectedTrackId && projection.tracksById[selectedTrackId]) return projection.tracksById[selectedTrackId]!
    if (selectedFromKey) return selectedFromKey
    return projection.tracks.find((track) => track.nodeId === selectedNodeId && track.editable)
      ?? projection.tracks.find((track) => track.nodeId === selectedNodeId)
      ?? projection.tracks.find((track) => track.editable)
      ?? projection.tracks[0]
      ?? null
  }, [projection, selectedTrackId, selectedFromKey, selectedNodeId])

  const [zoomX, setZoomX] = useState(1)
  const [panTicks, setPanTicks] = useState(0)
  const [valueRangeOverride, setValueRangeOverride] = useState<MotionCurveValueRangeV1 | null>(null)
  const [handlePreview, setHandlePreview] = useState<Readonly<{ keyframeId: string; bezier: MotionBezierHandlesV1 }> | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const initialSelectionAppliedRef = useRef(false)

  useEffect(() => {
    if (!projection || initialSelectionAppliedRef.current || !initialSelectedKeyframeId) return
    const track = projection.tracks.find((candidate) => candidate.keyframes.some((keyframe) => keyframe.keyframeId === initialSelectedKeyframeId))
    const keyframe = track?.keyframes.find((candidate) => candidate.keyframeId === initialSelectedKeyframeId)
    if (!track || !keyframe) return
    initialSelectionAppliedRef.current = true
    onSelectionChange(selectMotionKeyframe(keyframe.selectionId))
    onTrackChange(track.trackId)
    onSelectNode(track.nodeId)
    onSeek(keyframe.tick)
  }, [projection, initialSelectedKeyframeId, onSelectionChange, onTrackChange, onSelectNode, onSeek])

  useEffect(() => {
    if (activeTrack && activeTrack.trackId !== selectedTrackId) onTrackChange(activeTrack.trackId)
  }, [activeTrack, selectedTrackId, onTrackChange])
  useEffect(() => { setValueRangeOverride(null); setZoomX(1); setPanTicks(0); setHandlePreview(null) }, [activeTrack?.trackId, scene?.componentId])

  const samples = useMemo(() => scene && activeTrack?.editable ? sampleMotionCurveTrack(scene, activeTrack.trackId, 18) : [], [scene, activeTrack])
  const fittedTrackRange = useMemo(() => activeTrack ? fitMotionCurveValueRange(samples.length ? samples.map((point) => point.value) : activeTrack.keyframes.map((key) => key.value)) : Object.freeze({ minimum: 0, maximum: 1 }), [activeTrack, samples])
  const viewRange = valueRangeOverride ?? fittedTrackRange
  const visibleDurationTicks = Math.max(1, Math.round(durationTicks / zoomX))
  const maximumPan = Math.max(0, durationTicks - visibleDurationTicks)
  const visibleStartTicks = clamp(Math.round(panTicks), 0, maximumPan)
  const visibleEndTicks = Math.min(durationTicks, visibleStartTicks + visibleDurationTicks)

  const pathTrack = useMemo(() => {
    if (!activeTrack || !handlePreview) return activeTrack
    return Object.freeze({ ...activeTrack, keyframes: Object.freeze(activeTrack.keyframes.map((key) => key.keyframeId === handlePreview.keyframeId ? Object.freeze({ ...key, bezier: handlePreview.bezier }) : key)) })
  }, [activeTrack, handlePreview])
  const path = useMemo(() => pathTrack?.editable ? buildMotionCurveSvgPath(pathTrack, { startTicks: visibleStartTicks, endTicks: visibleEndTicks, valueRange: viewRange, width: WIDTH, height: HEIGHT }) : '', [pathTrack, visibleStartTicks, visibleEndTicks, viewRange])

  const xForTick = (tick: number) => ((tick - visibleStartTicks) / visibleDurationTicks) * WIDTH
  const yForValue = (value: number) => HEIGHT - ((value - viewRange.minimum) / Math.max(1e-9, viewRange.maximum - viewRange.minimum)) * HEIGHT
  const tickForX = (x: number) => Math.round(visibleStartTicks + clamp(x / WIDTH, 0, 1) * visibleDurationTicks)
  const valueForY = (y: number) => viewRange.minimum + (1 - y / HEIGHT) * (viewRange.maximum - viewRange.minimum)

  const keyIndex = activeTrack ? activeTrack.keyframes.findIndex((key) => key.selectionId === selection.primaryId) : -1
  const primary = keyIndex >= 0 ? activeTrack!.keyframes[keyIndex]! : null
  const previous = keyIndex > 0 ? activeTrack!.keyframes[keyIndex - 1]! : null
  const next = activeTrack && keyIndex >= 0 && keyIndex < activeTrack.keyframes.length - 1 ? activeTrack.keyframes[keyIndex + 1]! : null
  const previewBezier = primary && handlePreview?.keyframeId === primary.keyframeId ? handlePreview.bezier : primary?.bezier ?? DEFAULT_MOTION_BEZIER_HANDLES

  const selectKeyframe = (key: MotionCurveKeyframeProjectionV1) => {
    if (!activeTrack) return
    onSelectionChange(selectMotionKeyframe(key.selectionId))
    onTrackChange(activeTrack.trackId)
    onSelectNode(activeTrack.nodeId)
    onSeek(key.tick)
  }

  const applyPreset = (preset: MotionCurvePresetIdV1) => {
    if (!scene || !activeTrack || !primary || !next) return
    try { onOperations(buildMotionCurvePresetOperations({ scene, trackId: activeTrack.trackId, leftKeyframeId: primary.keyframeId, preset, nextOperationId })) } catch { return }
  }

  const beginHandleDrag = (event: ReactPointerEvent<SVGCircleElement>, mode: 'incoming' | 'outgoing') => {
    if (!scene || !activeTrack || !primary || (mode === 'outgoing' && !next) || (mode === 'incoming' && !previous)) return
    event.preventDefault()
    const keyframe = primary
    const segmentLeft = mode === 'outgoing' ? primary : previous!
    const segmentRight = mode === 'outgoing' ? next! : primary
    const starting = keyframe.bezier ?? DEFAULT_MOTION_BEZIER_HANDLES
    let pending = starting
    let cancelled = false
    const cleanup = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('keydown', keydown) }
    const move = (moveEvent: PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect(); if (!rect || rect.width <= 0 || rect.height <= 0) return
      const svgX = clamp((moveEvent.clientX - rect.left) / rect.width * WIDTH, 0, WIDTH)
      const svgY = clamp((moveEvent.clientY - rect.top) / rect.height * HEIGHT, 0, HEIGHT)
      const tick = tickForX(svgX), value = valueForY(svgY)
      const timeSpan = segmentRight.tick - segmentLeft.tick, valueSpan = segmentRight.value - segmentLeft.value
      const normalizedX = clamp((tick - segmentLeft.tick) / Math.max(1, timeSpan), 0, 1)
      const normalizedY = Math.abs(valueSpan) < 1e-9 ? (mode === 'outgoing' ? starting.outY : starting.inY) : clamp((value - segmentLeft.value) / valueSpan, -4, 4)
      pending = Object.freeze({ ...starting, ...(mode === 'outgoing' ? { outX: normalizedX, outY: normalizedY } : { inX: normalizedX, inY: normalizedY }) })
      setHandlePreview(Object.freeze({ keyframeId: keyframe.keyframeId, bezier: pending }))
    }
    const keydown = (keyEvent: KeyboardEvent) => { if (keyEvent.key === 'Escape') { cancelled = true; cleanup(); setHandlePreview(null) } }
    const up = () => {
      cleanup(); setHandlePreview(null)
      if (cancelled) return
      try { onOperations([buildMotionCurveBezierOperation({ scene, trackId: activeTrack.trackId, keyframeId: keyframe.keyframeId, bezier: pending, nextOperationId })]) } catch { return }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
    window.addEventListener('keydown', keydown)
  }

  const setPrimaryValue = (value: number) => {
    if (!activeTrack || !primary || !Number.isFinite(value)) return
    onOperations([Object.freeze({ operationId: nextOperationId('c5-value'), type: 'set-keyframe-value', target: activeTrack.target, keyframeId: primary.keyframeId, value })])
  }
  const setPrimaryTick = (tick: number) => {
    if (!activeTrack || !primary || !Number.isSafeInteger(tick) || tick < 0 || tick > durationTicks) return
    if (onOperations([Object.freeze({ operationId: nextOperationId('c5-time'), type: 'move-keyframe', target: activeTrack.target, keyframeId: primary.keyframeId, tick })])) onSeek(tick)
  }
  const setInterpolation = (interpolation: MotionCurveKeyframeProjectionV1['interpolation']) => {
    if (!activeTrack || !primary) return
    onOperations([Object.freeze({ operationId: nextOperationId('c5-interpolation'), type: 'set-keyframe-interpolation', target: activeTrack.target, keyframeId: primary.keyframeId, interpolation })])
  }

  const fitSelection = () => {
    if (!activeTrack) return
    const selectedValues = activeTrack.keyframes.filter((key) => selection.selectedIds.includes(key.selectionId)).map((key) => key.value)
    if (selectedValues.length) setValueRangeOverride(fitMotionCurveValueRange(selectedValues))
  }
  const panValue = (direction: -1 | 1) => {
    const span = viewRange.maximum - viewRange.minimum, delta = span * .12 * direction
    setValueRangeOverride(Object.freeze({ minimum: viewRange.minimum + delta, maximum: viewRange.maximum + delta }))
  }

  if (!projection || !scene) return <section className="c5-curve-editor c5-curve-editor--empty"><strong>Value Graph</strong><span>No Motion Graph scene.</span></section>

  const selectedNodeTracks = projection.tracks.filter((track) => !selectedNodeId || track.nodeId === selectedNodeId)
  const outgoingHandle = primary && next && primary.interpolation === 'bezier' ? {
    x: xForTick(primary.tick + (next.tick - primary.tick) * previewBezier.outX),
    y: yForValue(primary.value + (next.value - primary.value) * previewBezier.outY),
  } : null
  const incomingHandle = primary && previous && previous.interpolation === 'bezier' ? {
    x: xForTick(previous.tick + (primary.tick - previous.tick) * previewBezier.inX),
    y: yForValue(previous.value + (primary.value - previous.value) * previewBezier.inY),
  } : null

  return <section className="c5-curve-editor" data-c5-curve-editor="true">
    <div className="c5-curve-editor__toolbar">
      <div><strong>Value Graph</strong><small>{projection.totalTracks} numeric tracks · same C2 authority</small></div>
      <button type="button" onClick={() => { setZoomX(1); setPanTicks(0); setValueRangeOverride(fittedTrackRange) }}>Fit Track</button>
      <button type="button" onClick={fitSelection} disabled={!selection.selectedIds.length}>Fit Selection</button>
      <button type="button" onClick={() => setZoomX((value) => clamp(value / 1.5, 1, 16))} disabled={zoomX <= 1}>Time −</button>
      <span>{zoomX.toFixed(2)}×</span>
      <button type="button" onClick={() => setZoomX((value) => clamp(value * 1.5, 1, 16))} disabled={zoomX >= 16}>Time +</button>
      <button type="button" onClick={() => setValueRangeOverride(rangeAround(viewRange, .75))}>Value −</button>
      <button type="button" onClick={() => setValueRangeOverride(rangeAround(viewRange, 1.5))}>Value +</button>
      <button type="button" onClick={() => panValue(-1)}>Value ↓</button>
      <button type="button" onClick={() => panValue(1)}>Value ↑</button>
      <button type="button" onClick={onUndo} disabled={!canUndo}>Undo</button>
      <button type="button" onClick={onRedo} disabled={!canRedo}>Redo</button>
    </div>

    <div className="c5-curve-editor__body">
      <aside className="c5-curve-editor__tracks" aria-label="C5 numeric tracks">
        <strong>Numeric tracks</strong>
        {(selectedNodeTracks.length ? selectedNodeTracks : projection.tracks).map((track) => <button type="button" key={track.trackId} aria-pressed={track.trackId === activeTrack?.trackId} onClick={() => { onTrackChange(track.trackId); onSelectNode(track.nodeId) }}><span>{track.editable ? '◆' : '~'}</span><b>{track.label}</b><small>{track.animationKind}</small></button>)}
      </aside>

      <div className="c5-curve-editor__graph-wrap">
        <svg ref={svgRef} className="c5-curve-editor__graph" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="C5 Value Graph">
          {Array.from({ length: 9 }, (_, index) => <line key={`v${index}`} x1={index * WIDTH / 8} x2={index * WIDTH / 8} y1={0} y2={HEIGHT} className="c5-curve-editor__grid" />)}
          {Array.from({ length: 7 }, (_, index) => <line key={`h${index}`} x1={0} x2={WIDTH} y1={index * HEIGHT / 6} y2={index * HEIGHT / 6} className="c5-curve-editor__grid" />)}
          {viewRange.minimum <= 0 && viewRange.maximum >= 0 ? <line x1={0} x2={WIDTH} y1={yForValue(0)} y2={yForValue(0)} className="c5-curve-editor__zero" /> : null}
          {path ? <path d={path} className="c5-curve-editor__path" data-c5-path={activeTrack?.trackId} /> : null}
          {activeTrack?.keyframes.map((key) => {
            const x = xForTick(key.tick), y = yForValue(key.value); if (x < -20 || x > WIDTH + 20) return null
            return <circle key={key.selectionId} cx={x} cy={y} r={selection.selectedIds.includes(key.selectionId) ? 8 : 6} className={`c5-curve-editor__key${selection.selectedIds.includes(key.selectionId) ? ' is-selected' : ''}`} data-c5-key={key.keyframeId} onPointerDown={(event) => { event.preventDefault(); selectKeyframe(key) }} />
          })}
          {primary && outgoingHandle ? <><line x1={xForTick(primary.tick)} y1={yForValue(primary.value)} x2={outgoingHandle.x} y2={outgoingHandle.y} className="c5-curve-editor__handle-line" /><circle cx={outgoingHandle.x} cy={outgoingHandle.y} r={7} className="c5-curve-editor__handle" data-c5-handle="outgoing" onPointerDown={(event) => beginHandleDrag(event, 'outgoing')} /></> : null}
          {primary && incomingHandle ? <><line x1={xForTick(primary.tick)} y1={yForValue(primary.value)} x2={incomingHandle.x} y2={incomingHandle.y} className="c5-curve-editor__handle-line" /><circle cx={incomingHandle.x} cy={incomingHandle.y} r={7} className="c5-curve-editor__handle" data-c5-handle="incoming" onPointerDown={(event) => beginHandleDrag(event, 'incoming')} /></> : null}
          <line x1={xForTick(localTicks)} x2={xForTick(localTicks)} y1={0} y2={HEIGHT} className="c5-curve-editor__playhead" />
        </svg>
        <div className="c5-curve-editor__axis"><span>{secondsForTicks(visibleStartTicks).toFixed(2)}s</span><span>{secondsForTicks(visibleEndTicks).toFixed(2)}s</span><span>{displayValue(viewRange.maximum)} → {displayValue(viewRange.minimum)}</span></div>
        <input aria-label="C5 horizontal pan" type="range" min={0} max={maximumPan} step={1} value={visibleStartTicks} disabled={maximumPan === 0} onChange={(event) => setPanTicks(Number(event.target.value))} />
      </div>

      <aside className="c5-curve-editor__inspector" aria-label="C5 curve inspector">
        <strong>Curve Inspector</strong>
        {activeTrack ? <><small>{activeTrack.nodeName} · {activeTrack.label}</small>{!activeTrack.editable ? <p>{activeTrack.readOnlyReason}</p> : primary ? <>
          <label><span>Tick</span><input aria-label="C5 selected keyframe tick" type="number" min={0} max={durationTicks} value={primary.tick} onChange={(event) => setPrimaryTick(Number(event.target.value))} /></label>
          <label><span>Value</span><input aria-label="C5 selected keyframe value" type="number" value={displayValue(primary.value)} onChange={(event) => setPrimaryValue(Number(event.target.value))} /></label>
          <label><span>Interpolation</span><select aria-label="C5 selected interpolation" value={primary.interpolation} onChange={(event) => setInterpolation(event.target.value as MotionCurveKeyframeProjectionV1['interpolation'])}><option value="hold">Hold</option><option value="linear">Linear</option><option value="bezier">Bezier</option></select></label>
          <div className="c5-curve-editor__presets">{presets.map((preset) => <button type="button" key={preset} onClick={() => applyPreset(preset)} disabled={!next || (preset === 'overshoot' && (activeTrack.constraintMinimum !== undefined || activeTrack.constraintMaximum !== undefined))}>{preset}</button>)}</div>
          {primary.interpolation === 'bezier' ? <div className="c5-curve-editor__bezier-values">{(['inX', 'inY', 'outX', 'outY'] as const).map((key) => <label key={key}><span>{key}</span><input aria-label={`C5 ${key}`} type="number" step={.05} value={(primary.bezier ?? DEFAULT_MOTION_BEZIER_HANDLES)[key]} onChange={(event) => { if (!scene) return; const nextBezier = Object.freeze({ ...(primary.bezier ?? DEFAULT_MOTION_BEZIER_HANDLES), [key]: Number(event.target.value) }); try { onOperations([buildMotionCurveBezierOperation({ scene, trackId: activeTrack.trackId, keyframeId: primary.keyframeId, bezier: nextBezier, nextOperationId })]) } catch { return } }} /></label>)}</div> : null}
        </> : <p>Select a keyframe in C4 or C5.</p>}</> : <p>No numeric animation track.</p>}
        {errorMessage ? <div className="c5-curve-editor__error">{errorMessage}</div> : null}
      </aside>
    </div>
  </section>
}
