import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { MotionCompositionV1 } from '@sanverse/motion-contract'
import {
  buildAtomicMotionKeyframeMoveOperations,
  buildMotionKeyframeDeleteOperations,
  createMotionKeyframeSelection,
  projectMotionDopeSheet,
  selectMotionKeyframe,
  selectMotionKeyframeRange,
  snapMotionTimelineTick,
  toggleMotionKeyframeSelection,
} from '@sanverse/motion-graph'
import type {
  MotionDopeSheetKeyframeV1,
  MotionDopeSheetProjectionV1,
  MotionDopeSheetTrackV1,
  MotionGraphOperationV1,
  MotionKeyframeSelectionStateV1,
  MotionPropertyPrimitiveV1,
  MotionSceneV1,
} from '@sanverse/motion-graph'
import { frameForTicks, secondsForTicks, ticksForFrame } from '@sanverse/motion-primitives'

export interface AnimationDopeSheetEventV1 {
  readonly name: string
  readonly normalizedTime: number
}

export interface AnimationDopeSheetProps {
  readonly scene: MotionSceneV1 | null
  readonly selectedNodeId: string | null
  readonly localTicks: number
  readonly durationTicks: number
  readonly composition: MotionCompositionV1
  readonly events: readonly AnimationDopeSheetEventV1[]
  readonly initialSelectedKeyframeId?: string | null
  readonly errorMessage?: string | null
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly onSeek: (tick: number) => void
  readonly onSelectNode: (nodeId: string) => void
  readonly onOperations: (operations: readonly MotionGraphOperationV1[]) => boolean
  readonly nextOperationId: (prefix: string) => string
  readonly onUndo: () => void
  readonly onRedo: () => void
}

type RulerMode = 'seconds' | 'frames' | 'ticks'

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const interpolationGlyph = (interpolation: MotionDopeSheetKeyframeV1['interpolation']) => interpolation === 'hold' ? '■' : interpolation === 'bezier' ? '◆' : '◇'
const displayValue = (value: MotionPropertyPrimitiveV1) => typeof value === 'number' ? String(Number(value.toFixed(4))) : String(value)

export function AnimationDopeSheet({
  scene,
  selectedNodeId,
  localTicks,
  durationTicks,
  composition,
  events,
  initialSelectedKeyframeId = null,
  errorMessage,
  canUndo,
  canRedo,
  onSeek,
  onSelectNode,
  onOperations,
  nextOperationId,
  onUndo,
  onRedo,
}: AnimationDopeSheetProps) {
  const projection = useMemo(() => scene ? projectMotionDopeSheet(scene) : null, [scene])
  const [selection, setSelection] = useState<MotionKeyframeSelectionStateV1>(() => createMotionKeyframeSelection())
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [collapsedLayers, setCollapsedLayers] = useState<ReadonlySet<string>>(() => new Set())
  const [rulerMode, setRulerMode] = useState<RulerMode>('seconds')
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [panTicks, setPanTicks] = useState(0)
  const [dragPreviewDelta, setDragPreviewDelta] = useState<number | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const keyframeCounter = useRef(1)
  const initialSelectionAppliedRef = useRef(false)

  const visibleDurationTicks = Math.max(1, Math.round(durationTicks / zoom))
  const maximumPan = Math.max(0, durationTicks - visibleDurationTicks)
  const visibleStartTicks = clamp(Math.round(panTicks), 0, maximumPan)
  const visibleEndTicks = Math.min(durationTicks, visibleStartTicks + visibleDurationTicks)
  const eventTicks = useMemo(() => events.map((event) => Math.round(event.normalizedTime * durationTicks)), [events, durationTicks])
  const orderedKeyframeIds = useMemo(() => projection ? projection.layers.flatMap((layer) => layer.tracks.flatMap((track) => track.keyframeRefs.map((keyframe) => keyframe.selectionId))) : [], [projection])

  useEffect(() => {
    if (!projection) { setSelection(createMotionKeyframeSelection()); setSelectedTrackId(null); return }
    setSelection((current) => {
      const retained = current.selectedIds.filter((id) => Boolean(projection.keyframesById[id]))
      const primary = current.primaryId && projection.keyframesById[current.primaryId] ? current.primaryId : retained.at(-1) ?? null
      const anchor = current.anchorId && projection.keyframesById[current.anchorId] ? current.anchorId : retained[0] ?? null
      return createMotionKeyframeSelection(retained, primary, anchor)
    })
    if (selectedTrackId && !projection.tracksById[selectedTrackId]) setSelectedTrackId(null)
    if (!initialSelectionAppliedRef.current && initialSelectedKeyframeId) {
      const keyframe = Object.values(projection.keyframesById).find((candidate) => candidate.keyframeId === initialSelectedKeyframeId)
      if (keyframe) {
        initialSelectionAppliedRef.current = true
        setSelection(selectMotionKeyframe(keyframe.selectionId))
        setSelectedTrackId(keyframe.trackId)
        onSelectNode(keyframe.nodeId)
        onSeek(keyframe.tick)
      }
    }
  }, [projection, selectedTrackId, initialSelectedKeyframeId, onSelectNode, onSeek])

  useEffect(() => {
    if (!projection || !selectedNodeId) return
    const currentTrack = selectedTrackId ? projection.tracksById[selectedTrackId] : null
    if (currentTrack?.nodeId === selectedNodeId) return
    const layer = projection.layers.find((candidate) => candidate.nodeId === selectedNodeId)
    if (layer?.tracks[0]) setSelectedTrackId(layer.tracks[0].trackId)
  }, [projection, selectedNodeId, selectedTrackId])

  const displayLayers = useMemo(() => {
    if (!projection || !selectedNodeId) return projection?.layers ?? []
    const focused = projection.layers.find((layer) => layer.nodeId === selectedNodeId)
    return focused ? [focused, ...projection.layers.filter((layer) => layer.nodeId !== selectedNodeId)] : projection.layers
  }, [projection, selectedNodeId])

  const primaryKeyframe = selection.primaryId && projection ? projection.keyframesById[selection.primaryId] ?? null : null
  const selectedTrack = selectedTrackId && projection ? projection.tracksById[selectedTrackId] ?? null : primaryKeyframe && projection ? projection.tracksById[primaryKeyframe.trackId] ?? null : null

  const tickToPercent = (tick: number) => ((tick - visibleStartTicks) / visibleDurationTicks) * 100
  const tickFromClientX = (clientX: number) => {
    const bounds = timelineRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width <= 0) return localTicks
    return Math.round(visibleStartTicks + clamp((clientX - bounds.left) / bounds.width, 0, 1) * visibleDurationTicks)
  }

  const setZoomAroundPlayhead = (nextZoom: number) => {
    const normalized = clamp(nextZoom, 1, 16)
    const oldVisible = visibleDurationTicks
    const relative = oldVisible > 0 ? clamp((localTicks - visibleStartTicks) / oldVisible, 0, 1) : .5
    const nextVisible = Math.max(1, Math.round(durationTicks / normalized))
    const nextMaximumPan = Math.max(0, durationTicks - nextVisible)
    setPanTicks(clamp(Math.round(localTicks - relative * nextVisible), 0, nextMaximumPan))
    setZoom(normalized)
  }

  const selectKey = (keyframe: MotionDopeSheetKeyframeV1, modifiers: Readonly<{ toggle: boolean; range: boolean }>) => {
    setSelection((current) => modifiers.range
      ? selectMotionKeyframeRange(current, keyframe.selectionId, orderedKeyframeIds)
      : modifiers.toggle
        ? toggleMotionKeyframeSelection(current, keyframe.selectionId)
        : selectMotionKeyframe(keyframe.selectionId))
    setSelectedTrackId(keyframe.trackId)
    onSelectNode(keyframe.nodeId)
    onSeek(keyframe.tick)
  }

  const selectedRefs = () => !projection ? [] : selection.selectedIds.map((id) => projection.keyframesById[id]).filter((ref): ref is MotionDopeSheetKeyframeV1 => Boolean(ref))

  const moveSelectedByDelta = (deltaTicks: number): boolean => {
    if (!projection || selection.selectedIds.length === 0 || deltaTicks === 0) return false
    try {
      const operations = buildAtomicMotionKeyframeMoveOperations({ projection, selectionIds: selection.selectedIds, deltaTicks, durationTicks, nextOperationId })
      return onOperations(operations)
    } catch {
      return false
    }
  }

  const deleteSelected = () => {
    if (!projection || selection.selectedIds.length === 0) return
    const operations = buildMotionKeyframeDeleteOperations({ projection, selectionIds: selection.selectedIds, nextOperationId })
    if (onOperations(operations)) setSelection(createMotionKeyframeSelection())
  }

  const addKeyframe = () => {
    if (!selectedTrack || selectedTrack.animationKind !== 'keyframes') return
    if (selectedTrack.keyframeRefs.some((keyframe) => keyframe.tick === localTicks)) return
    const keyframeId = `c4-key:${keyframeCounter.current++}`
    if (onOperations([Object.freeze({ operationId: nextOperationId('c4-add-keyframe'), type: 'add-keyframe', target: selectedTrack.target, keyframeId, tick: localTicks, interpolation: 'linear' })])) {
      const selectionId = `${selectedTrack.trackId}::${keyframeId}`
      setSelection(createMotionKeyframeSelection([selectionId], selectionId, selectionId))
    }
  }

  const nudgeSelection = (direction: -1 | 1, frameCount: number) => {
    const delta = ticksForFrame(frameCount, composition) - ticksForFrame(0, composition)
    moveSelectedByDelta(direction * delta)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.matches('input,textarea,select,[contenteditable="true"]')) return
    if (event.key === 'Delete' || event.key === 'Backspace') { if (selection.selectedIds.length) { event.preventDefault(); deleteSelected() }; return }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (!selection.selectedIds.length) return
      event.preventDefault()
      nudgeSelection(event.key === 'ArrowLeft' ? -1 : 1, event.shiftKey ? 10 : 1)
    }
  }

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, keyframe: MotionDopeSheetKeyframeV1) => {
    event.preventDefault()
    const toggle = event.ctrlKey || event.metaKey
    const range = event.shiftKey
    const clickedAlreadySelected = selection.selectedIds.includes(keyframe.selectionId)
    const dragSelection = clickedAlreadySelected && !toggle && !range ? selection : range ? selectMotionKeyframeRange(selection, keyframe.selectionId, orderedKeyframeIds) : toggle ? toggleMotionKeyframeSelection(selection, keyframe.selectionId) : selectMotionKeyframe(keyframe.selectionId)
    setSelection(dragSelection)
    setSelectedTrackId(keyframe.trackId)
    onSelectNode(keyframe.nodeId)
    const startX = event.clientX
    const startTick = keyframe.tick
    const activeIds = dragSelection.selectedIds.includes(keyframe.selectionId) ? dragSelection.selectedIds : [keyframe.selectionId]
    let previewDelta = 0

    const onMove = (moveEvent: PointerEvent) => {
      const bounds = timelineRef.current?.getBoundingClientRect()
      if (!bounds || bounds.width <= 0) return
      previewDelta = Math.round(((moveEvent.clientX - startX) / bounds.width) * visibleDurationTicks)
      setDragPreviewDelta(previewDelta)
    }
    const onUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDragPreviewDelta(null)
      if (!projection) return
      let finalPrimaryTick = clamp(startTick + previewDelta, 0, durationTicks)
      if (snapEnabled) {
        const selectedSet = new Set(activeIds)
        const otherTicks = Object.values(projection.keyframesById).filter((ref) => !selectedSet.has(ref.selectionId)).map((ref) => ref.tick)
        finalPrimaryTick = snapMotionTimelineTick({ tick: finalPrimaryTick, durationTicks, composition, otherKeyframeTicks: otherTicks, eventTicks }).tick
      }
      const delta = finalPrimaryTick - startTick
      if (delta === 0) { onSeek(startTick); return }
      try {
        const operations = buildAtomicMotionKeyframeMoveOperations({ projection, selectionIds: activeIds, deltaTicks: delta, durationTicks, nextOperationId })
        if (onOperations(operations)) onSeek(finalPrimaryTick)
      } catch { onSeek(startTick) }
      void upEvent
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  const setPrimaryTick = (tick: number) => {
    if (!primaryKeyframe || !projection || !Number.isSafeInteger(tick)) return
    const delta = tick - primaryKeyframe.tick
    if (selection.selectedIds.length > 1) moveSelectedByDelta(delta)
    else onOperations([Object.freeze({ operationId: nextOperationId('c4-inspector-tick'), type: 'move-keyframe', target: primaryKeyframe.target, keyframeId: primaryKeyframe.keyframeId, tick })])
    onSeek(tick)
  }

  const setPrimaryValue = (value: MotionPropertyPrimitiveV1) => {
    if (!primaryKeyframe) return
    onOperations([Object.freeze({ operationId: nextOperationId('c4-key-value'), type: 'set-keyframe-value', target: primaryKeyframe.target, keyframeId: primaryKeyframe.keyframeId, value })])
  }

  const setPrimaryInterpolation = (interpolation: MotionDopeSheetKeyframeV1['interpolation']) => {
    if (!primaryKeyframe) return
    onOperations([Object.freeze({ operationId: nextOperationId('c4-key-interpolation'), type: 'set-keyframe-interpolation', target: primaryKeyframe.target, keyframeId: primaryKeyframe.keyframeId, interpolation })])
  }

  const setBezierValue = (key: 'inX' | 'inY' | 'outX' | 'outY', value: number) => {
    if (!primaryKeyframe || !Number.isFinite(value)) return
    const base = primaryKeyframe.bezier ?? { inX: .7, inY: 1, outX: .2, outY: .8 }
    onOperations([Object.freeze({ operationId: nextOperationId('c4-key-bezier'), type: 'set-keyframe-bezier', target: primaryKeyframe.target, keyframeId: primaryKeyframe.keyframeId, bezier: Object.freeze({ ...base, [key]: value }) })])
  }

  const rulerLabels = Array.from({ length: 9 }, (_, index) => {
    const tick = Math.round(visibleStartTicks + visibleDurationTicks * index / 8)
    const label = rulerMode === 'ticks' ? tick.toLocaleString() : rulerMode === 'frames' ? `${frameForTicks(tick, composition)}f` : `${secondsForTicks(tick).toFixed(2)}s`
    return { tick, label, left: `${index * 12.5}%` }
  })

  if (!projection) return <section className="c4-dope-sheet c4-dope-sheet--empty"><strong>Animation Timeline</strong><span>No Motion Graph scene.</span></section>

  return (
    <section className="c4-dope-sheet" tabIndex={0} onKeyDown={handleKeyDown} data-c4-dope-sheet="true">
      <div className="c4-dope-sheet__toolbar">
        <div className="c4-dope-sheet__title"><strong>Animation Timeline</strong><small>{projection.totalTracks} tracks · {projection.totalKeyframes} keys · C2 authority</small></div>
        <div className="c4-dope-sheet__segmented" aria-label="C4 ruler mode">{(['seconds', 'frames', 'ticks'] as const).map((mode) => <button type="button" key={mode} aria-pressed={rulerMode === mode} onClick={() => setRulerMode(mode)}>{mode}</button>)}</div>
        <label className="c4-dope-sheet__snap"><input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /> Snap</label>
        <button type="button" onClick={addKeyframe} disabled={!selectedTrack || selectedTrack.animationKind !== 'keyframes'} title={selectedTrack?.animationKind === 'motion' ? 'Motion-driver tracks must be baked/reset before keyframing.' : ''}>+ Key</button>
        <button type="button" onClick={deleteSelected} disabled={!selection.selectedIds.length}>Delete keys</button>
        <button type="button" onClick={onUndo} disabled={!canUndo}>Undo</button>
        <button type="button" onClick={onRedo} disabled={!canRedo}>Redo</button>
        <button type="button" onClick={() => { setZoom(1); setPanTicks(0) }}>Fit</button>
        <button type="button" onClick={() => setZoomAroundPlayhead(zoom / 1.5)} disabled={zoom <= 1}>−</button>
        <span className="c4-dope-sheet__zoom">{zoom.toFixed(2)}×</span>
        <button type="button" onClick={() => setZoomAroundPlayhead(zoom * 1.5)} disabled={zoom >= 16}>+</button>
      </div>

      <div className="c4-dope-sheet__ruler-row">
        <div className="c4-dope-sheet__corner"><span>{selection.selectedIds.length} selected</span><small>tick {localTicks.toLocaleString()}</small></div>
        <div className="c4-dope-sheet__ruler" ref={timelineRef} onPointerDown={(event) => { if ((event.target as HTMLElement).closest('button')) return; onSeek(tickFromClientX(event.clientX)) }}>
          {rulerLabels.map((label) => <span key={label.tick} style={{ left: label.left }}><i />{label.label}</span>)}
          {events.map((event, index) => { const tick = eventTicks[index]!; const left = tickToPercent(tick); return left >= 0 && left <= 100 ? <button type="button" className="c4-dope-sheet__event" key={`${event.name}:${index}`} style={{ left: `${left}%` }} onClick={() => onSeek(tick)} title={`${event.name} · tick ${tick}`}><i />{event.name}</button> : null })}
          <div className="c4-dope-sheet__playhead" style={{ left: `${clamp(tickToPercent(localTicks), 0, 100)}%` }}><i /></div>
        </div>
      </div>

      <div className="c4-dope-sheet__scroll" onWheel={(event) => { if (event.ctrlKey) { event.preventDefault(); setZoomAroundPlayhead(event.deltaY > 0 ? zoom / 1.15 : zoom * 1.15) } else if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) { const pixelDelta = event.deltaY + event.deltaX; const tickDelta = Math.round(pixelDelta * visibleDurationTicks / 900); setPanTicks((current) => clamp(current + tickDelta, 0, maximumPan)) } }}>
        {displayLayers.map((layer) => {
          const collapsed = collapsedLayers.has(layer.nodeId)
          const focused = layer.nodeId === selectedNodeId
          return <div className={`c4-dope-sheet__layer${focused ? ' is-focused' : ''}`} key={layer.nodeId} data-c4-layer={layer.nodeId}>
            <button type="button" className="c4-dope-sheet__layer-row" onClick={() => { setCollapsedLayers((current) => { const next = new Set(current); if (next.has(layer.nodeId)) next.delete(layer.nodeId); else next.add(layer.nodeId); return next }); onSelectNode(layer.nodeId) }}><span>{collapsed ? '▸' : '▾'}</span><strong>{layer.nodeName}</strong><small>{layer.tracks.length}</small></button>
            {!collapsed ? layer.tracks.map((track) => {
              const activeTrack = track.trackId === selectedTrackId
              return <div className={`c4-dope-sheet__track${activeTrack ? ' is-selected' : ''}`} key={track.trackId} data-c4-track={track.trackId}>
                <button type="button" className="c4-dope-sheet__track-label" onClick={() => { setSelectedTrackId(track.trackId); onSelectNode(track.nodeId) }}><span>{track.animationKind === 'keyframes' ? '◆' : track.animationKind === 'motion' ? '~' : '↗'}</span><strong>{track.label}</strong><small>{track.animationKind === 'keyframes' ? `${track.keyframeRefs.length} KEYS` : track.animationKind.toUpperCase()}</small></button>
                <div className="c4-dope-sheet__track-lane" onPointerDown={(event) => { if ((event.target as HTMLElement).closest('button')) return; onSeek(tickFromClientX(event.clientX)); setSelectedTrackId(track.trackId); onSelectNode(track.nodeId) }}>
                  {track.keyframeRefs.map((keyframe) => {
                    const renderedTick = keyframe.tick + (selection.selectedIds.includes(keyframe.selectionId) ? dragPreviewDelta ?? 0 : 0)
                    const left = tickToPercent(renderedTick)
                    if (left < -2 || left > 102) return null
                    const selected = selection.selectedIds.includes(keyframe.selectionId)
                    return <button type="button" key={keyframe.selectionId} className={`c4-dope-sheet__key c4-dope-sheet__key--${keyframe.interpolation}${selected ? ' is-selected' : ''}`} aria-pressed={selected} style={{ left: `${left}%` }} title={`${keyframe.keyframeId} · ${keyframe.tick} · ${keyframe.interpolation}`} onPointerDown={(event) => beginDrag(event, keyframe)}>{interpolationGlyph(keyframe.interpolation)}</button>
                  })}
                  {track.animationKind === 'motion' ? <div className="c4-dope-sheet__driver-band">AUTHORED MOTION DRIVER</div> : null}
                  <div className="c4-dope-sheet__row-playhead" style={{ left: `${clamp(tickToPercent(localTicks), 0, 100)}%` }} />
                </div>
              </div>
            }) : null}
          </div>
        })}
      </div>

      <div className="c4-dope-sheet__bottom">
        <label><span>Pan</span><input aria-label="C4 timeline pan" type="range" min={0} max={maximumPan} step={1} value={visibleStartTicks} onChange={(event) => setPanTicks(Number(event.target.value))} disabled={maximumPan === 0} /></label>
        <label><span>Zoom</span><input aria-label="C4 timeline zoom" type="range" min={1} max={16} step={.25} value={zoom} onChange={(event) => setZoomAroundPlayhead(Number(event.target.value))} /></label>
        <div className="c4-dope-sheet__nudge"><button type="button" onClick={() => nudgeSelection(-1, 1)} disabled={!selection.selectedIds.length}>← 1f</button><button type="button" onClick={() => nudgeSelection(1, 1)} disabled={!selection.selectedIds.length}>1f →</button><button type="button" onClick={() => nudgeSelection(-1, 10)} disabled={!selection.selectedIds.length}>← 10f</button><button type="button" onClick={() => nudgeSelection(1, 10)} disabled={!selection.selectedIds.length}>10f →</button></div>
        {errorMessage ? <div className="c4-dope-sheet__error">{errorMessage}</div> : null}
      </div>

      <aside className="c4-dope-sheet__inspector" aria-label="C4 keyframe inspector">
        <strong>Keyframe Inspector</strong>
        {primaryKeyframe && selectedTrack ? <>
          <small>{selectedTrack.nodeName} · {selectedTrack.label}</small>
          <label><span>Tick</span><input aria-label="C4 selected keyframe tick" type="number" min={0} max={durationTicks} step={1} value={primaryKeyframe.tick} onChange={(event) => setPrimaryTick(Number(event.target.value))} /></label>
          <div className="c4-dope-sheet__time-readout"><span>{secondsForTicks(primaryKeyframe.tick).toFixed(4)}s</span><span>frame {frameForTicks(primaryKeyframe.tick, composition)}</span></div>
          <label><span>Value</span>{typeof primaryKeyframe.value === 'boolean' ? <select aria-label="C4 selected keyframe value" value={String(primaryKeyframe.value)} onChange={(event) => setPrimaryValue(event.target.value === 'true')}><option value="true">true</option><option value="false">false</option></select> : <input aria-label="C4 selected keyframe value" type={typeof primaryKeyframe.value === 'number' ? 'number' : 'text'} value={displayValue(primaryKeyframe.value)} onChange={(event) => setPrimaryValue(typeof primaryKeyframe.value === 'number' ? Number(event.target.value) : event.target.value)} />}</label>
          <label><span>Interpolation</span><select aria-label="C4 selected keyframe interpolation" value={primaryKeyframe.interpolation} onChange={(event) => setPrimaryInterpolation(event.target.value as MotionDopeSheetKeyframeV1['interpolation'])}>{selectedTrack.interpolation.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          {primaryKeyframe.interpolation === 'bezier' ? <div className="c4-dope-sheet__bezier-grid">{(['inX', 'inY', 'outX', 'outY'] as const).map((key) => <label key={key}><span>{key}</span><input aria-label={`C4 ${key}`} type="number" step={.05} min={0} max={1} value={(primaryKeyframe.bezier ?? { inX: .7, inY: 1, outX: .2, outY: .8 })[key]} onChange={(event) => setBezierValue(key, Number(event.target.value))} /></label>)}</div> : null}
        </> : <small>Select a keyframe. Hold = ■, Linear = ◇, Bezier = ◆.</small>}
      </aside>
    </section>
  )
}
