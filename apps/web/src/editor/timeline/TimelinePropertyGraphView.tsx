import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  animationCapabilityForProperty,
  planMoveEditorKeyframes,
  planSetEditorKeyframeEasing,
  planSetEditorKeyframeValues,
  type EditorAnimationPropertyIdV1,
  type EditorAnimationTrackStateV1,
  type EditorKeyframeAddressV1,
  type EditorKeyframeSelectionV1,
  type VisualKeyframe,
} from '@sanverse/edit-domain'
import {
  editorGraphBezierHandlePoint,
  editorGraphBezierValueFromPoint,
  editorGraphPath,
  editorGraphPoint,
  editorGraphRange,
  selectOnlyEditorKeyframe,
  toggleEditorKeyframeSelection,
  type TimelineAnimationPresentationV1,
  type TimelineAnimationSubjectV1,
} from '../../features/timeline'
import { TimelineGraphInterpolationControls } from './TimelineGraphInterpolationControls'

export type TimelinePropertyGraphViewProps = Readonly<{
  subject: TimelineAnimationSubjectV1
  presentation: TimelineAnimationPresentationV1
  selection: EditorKeyframeSelectionV1
  busy: boolean
  onPresentationChange(next: TimelineAnimationPresentationV1): void
  onSelectionChange(next: EditorKeyframeSelectionV1): void
  onDraft(next: EditorAnimationTrackStateV1 | null): void
  onCommit(next: EditorAnimationTrackStateV1): void
  onNotice(message: string | null): void
}>

type Drag = Readonly<{
  kind: 'point' | 'pan' | 'marquee' | 'bezier-1' | 'bezier-2'
  pointerId: number
  startX: number
  startY: number
  originalState: EditorAnimationTrackStateV1
  draftState: EditorAnimationTrackStateV1
  selected: readonly EditorKeyframeAddressV1[]
  nextSelected: readonly EditorKeyframeAddressV1[]
  property: EditorAnimationPropertyIdV1
  changed: boolean
  panX: number
  panY: number
}>

const GRAPH_CHROME_HEIGHT = 78
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
const sameTarget = (entry: EditorKeyframeAddressV1, subject: TimelineAnimationSubjectV1): boolean =>
  entry.target.kind === subject.target.kind && (
    entry.target.kind === 'visual-properties'
      ? subject.target.kind === 'visual-properties' && entry.target.visualId === subject.target.visualId
      : subject.target.kind === 'primary-footage-motion' && entry.target.motionId === subject.target.motionId && entry.target.assetId === subject.target.assetId
  )
const keyAddress = (subject: TimelineAnimationSubjectV1, property: EditorAnimationPropertyIdV1, ticks: number): EditorKeyframeAddressV1 =>
  Object.freeze({ target: subject.target, property, canonicalAtTicks: ticks })
const trackFor = (state: EditorAnimationTrackStateV1, property: EditorAnimationPropertyIdV1) =>
  state.tracks.find((track) => track.property === property) ?? null

export function TimelinePropertyGraphView(props: TimelinePropertyGraphViewProps) {
  const { subject, presentation, selection, busy, onPresentationChange, onSelectionChange, onDraft, onCommit, onNotice } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [width, setWidth] = useState(720)
  const [graphMarquee, setGraphMarquee] = useState<Readonly<{ left: number; top: number; width: number; height: number }> | null>(null)
  const state = drag?.draftState ?? subject.state
  const available = useMemo(() => [
    'translate-x', 'translate-y', 'scale', 'rotation', 'opacity',
    'crop-top', 'crop-right', 'crop-bottom', 'crop-left',
  ].filter((property) => animationCapabilityForProperty(state.targetKind, property as EditorAnimationPropertyIdV1, state)) as EditorAnimationPropertyIdV1[], [state])
  const property = presentation.activeProperty && available.includes(presentation.activeProperty)
    ? presentation.activeProperty
    : state.tracks[0]?.property ?? available[0] ?? null
  const track = property ? trackFor(state, property) : null
  const capability = property ? animationCapabilityForProperty(state.targetKind, property, state) : null
  const graphHeight = Math.max(96, presentation.graphHeightPx - GRAPH_CHROME_HEIGHT)
  const range = property ? editorGraphRange({ subject, state, property, viewport: presentation.graphViewport }) : null
  const curve = useMemo(() => track && range
    ? editorGraphPath({ track, width, height: graphHeight, range })
    : Object.freeze({ d: '', sampleCount: 0 }), [graphHeight, range, track, width])

  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return
    const update = () => setWidth(Math.max(280, Math.round(host.getBoundingClientRect().width)))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])
  useEffect(() => { dragRef.current = drag }, [drag])
  useEffect(() => {
    if (!drag) return
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      dragRef.current = null
      setDrag(null)
      setGraphMarquee(null)
      onDraft(null)
      onNotice('Graph edit cancelled. Nothing changed.')
    }
    addEventListener('keydown', cancel)
    return () => removeEventListener('keydown', cancel)
  }, [drag, onDraft, onNotice])

  if (!presentation.graphOpen) return null

  const setPresentation = (patch: Partial<TimelineAnimationPresentationV1>) =>
    onPresentationChange(Object.freeze({ ...presentation, ...patch }))
  const setViewport = (patch: Partial<TimelineAnimationPresentationV1['graphViewport']>) =>
    setPresentation({ graphViewport: Object.freeze({ ...presentation.graphViewport, ...patch }) })
  const selectTicks = property
    ? selection.addresses.filter((entry) => entry.property === property && sameTarget(entry, subject)).map((entry) => entry.canonicalAtTicks)
    : []
  const selectedFrame = property && selectTicks.length === 1
    ? track?.keyframes.find((frame) => frame.at.ticks === selectTicks[0]) ?? null
    : null
  const selectedIndex = selectedFrame && track ? track.keyframes.findIndex((frame) => frame.at.ticks === selectedFrame.at.ticks) : -1
  const nextFrame = selectedIndex >= 0 ? track?.keyframes[selectedIndex + 1] ?? null : null

  const beginPoint = (event: ReactPointerEvent<SVGCircleElement>, frame: VisualKeyframe) => {
    if (!property || busy) return
    const candidate = keyAddress(subject, property, frame.at.ticks)
    const nextSelection = event.ctrlKey || event.metaKey
      ? toggleEditorKeyframeSelection(selection, candidate)
      : selection.addresses.some((entry) => entry.property === property && entry.canonicalAtTicks === frame.at.ticks && sameTarget(entry, subject))
        ? selection
        : selectOnlyEditorKeyframe(candidate)
    onSelectionChange(nextSelection)
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* optional */ }
    const next: Drag = Object.freeze({
      kind: 'point', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      originalState: state, draftState: state,
      selected: Object.freeze(nextSelection.addresses.filter((entry) => entry.property === property && sameTarget(entry, subject))),
      nextSelected: Object.freeze(nextSelection.addresses.filter((entry) => entry.property === property && sameTarget(entry, subject))),
      property, changed: false, panX: presentation.graphViewport.panX, panY: presentation.graphViewport.panY,
    })
    dragRef.current = next
    setDrag(next)
    event.stopPropagation()
  }

  const beginPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!property || event.target !== event.currentTarget) return
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* optional */ }
    const next: Drag = Object.freeze({
      kind: event.shiftKey ? 'marquee' : 'pan', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      originalState: state, draftState: state, selected: Object.freeze([]), nextSelected: Object.freeze([]), property, changed: false,
      panX: presentation.graphViewport.panX, panY: presentation.graphViewport.panY,
    })
    dragRef.current = next
    setDrag(next)
  }

  const beginBezier = (event: ReactPointerEvent<SVGCircleElement>, kind: 'bezier-1' | 'bezier-2') => {
    if (!property || !selectedFrame || selectedFrame.easing.kind !== 'cubic-bezier' || busy) return
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* optional */ }
    const next: Drag = Object.freeze({
      kind, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      originalState: state, draftState: state,
      selected: Object.freeze([keyAddress(subject, property, selectedFrame.at.ticks)]),
      nextSelected: Object.freeze([keyAddress(subject, property, selectedFrame.at.ticks)]), property, changed: false,
      panX: presentation.graphViewport.panX, panY: presentation.graphViewport.panY,
    })
    dragRef.current = next
    setDrag(next)
  }

  const move = (event: ReactPointerEvent<SVGElement>) => {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId || !range || !capability) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    if (current.kind === 'marquee') {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      const startX = current.startX - rect.left
      const startY = current.startY - rect.top
      const currentX = event.clientX - rect.left
      const currentY = event.clientY - rect.top
      setGraphMarquee(Object.freeze({
        left: Math.min(startX, currentX),
        top: Math.min(startY, currentY),
        width: Math.abs(currentX - startX),
        height: Math.abs(currentY - startY),
      }))
      return
    }
    if (current.kind === 'pan') {
      setViewport({
        panX: current.panX - dx / Math.max(1, width) * (range.timeMax - range.timeMin),
        panY: current.panY + dy / Math.max(1, graphHeight) * (range.valueMax - range.valueMin),
      })
      return
    }
    if (current.kind === 'point') {
      const deltaTicks = Math.round(dx / Math.max(1, width) * (range.timeMax - range.timeMin))
      const deltaValue = -dy / Math.max(1, graphHeight) * (range.valueMax - range.valueMin)
      const originalTrack = trackFor(current.originalState, current.property)
      if (!originalTrack) return
      const moved = planMoveEditorKeyframes({
        state: current.originalState,
        moves: current.selected.map((entry) => Object.freeze({ property: current.property, fromTicks: entry.canonicalAtTicks, toTicks: entry.canonicalAtTicks + deltaTicks })),
      })
      if (!moved.ok) { onNotice(moved.refusal.message); return }
      const valued = planSetEditorKeyframeValues({
        state: moved.state,
        updates: current.selected.map((entry) => {
          const frame = originalTrack.keyframes.find((candidate) => candidate.at.ticks === entry.canonicalAtTicks)!
          return Object.freeze({ property: current.property, canonicalAtTicks: entry.canonicalAtTicks + deltaTicks, value: frame.value + deltaValue })
        }),
      })
      if (!valued.ok) { onNotice(valued.refusal.message); return }
      const nextSelected = Object.freeze(current.selected.map((entry) => keyAddress(subject, current.property, entry.canonicalAtTicks + deltaTicks)))
      const next = Object.freeze({ ...current, draftState: valued.state, nextSelected, changed: true })
      dragRef.current = next
      setDrag(next)
      onDraft(valued.state)
      onNotice('Graph keyframe preview. Release to apply; Escape cancels.')
      return
    }
    if (!selectedFrame || !nextFrame || selectedFrame.easing.kind !== 'cubic-bezier' || !svgRef.current) return
    const left = editorGraphPoint({ ticks: selectedFrame.at.ticks, value: selectedFrame.value, width, height: graphHeight, range })
    const right = editorGraphPoint({ ticks: nextFrame.at.ticks, value: nextFrame.value, width, height: graphHeight, range })
    const rect = svgRef.current.getBoundingClientRect()
    const normalized = editorGraphBezierValueFromPoint({ point: { x: event.clientX - rect.left, y: event.clientY - rect.top }, left, right })
    if (!normalized) { onNotice('Bezier handles are unavailable when the segment has no visible value change.'); return }
    const easing = current.kind === 'bezier-1'
      ? Object.freeze({ ...selectedFrame.easing, x1: normalized.x, y1: normalized.y })
      : Object.freeze({ ...selectedFrame.easing, x2: normalized.x, y2: normalized.y })
    const planned = planSetEditorKeyframeEasing({ state: current.originalState, property: current.property, canonicalAtTicks: [selectedFrame.at.ticks], easing })
    if (!planned.ok) { onNotice(planned.refusal.message); return }
    const next = Object.freeze({ ...current, draftState: planned.state, changed: true })
    dragRef.current = next
    setDrag(next)
    onDraft(planned.state)
  }

  const finish = (event: ReactPointerEvent<SVGElement>, accept: boolean) => {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* optional */ }
    dragRef.current = null
    setDrag(null)
    onDraft(null)
    if (current.kind === 'marquee') {
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect && track && range && property) {
        const left = Math.min(current.startX, event.clientX) - rect.left
        const right = Math.max(current.startX, event.clientX) - rect.left
        const top = Math.min(current.startY, event.clientY) - rect.top
        const bottom = Math.max(current.startY, event.clientY) - rect.top
        const addresses = track.keyframes.flatMap((frame) => {
          const point = editorGraphPoint({ ticks: frame.at.ticks, value: frame.value, width, height: graphHeight, range })
          return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom
            ? [keyAddress(subject, property, frame.at.ticks)]
            : []
        })
        onSelectionChange(Object.freeze({ addresses: Object.freeze(addresses), anchor: addresses[0] ?? null }))
        onNotice(`${addresses.length} keyframe${addresses.length === 1 ? '' : 's'} selected in graph.`)
      }
      setGraphMarquee(null)
      return
    }
    if (current.kind !== 'pan' && accept && current.changed) {
      onCommit(current.draftState)
      if (current.nextSelected.length > 0) {
        onSelectionChange(Object.freeze({ addresses: current.nextSelected, anchor: current.nextSelected[0] ?? null }))
      }
      onNotice('Graph animation edit applied. Undo takes back the whole gesture.')
    } else if (current.kind !== 'pan') onNotice('Graph edit cancelled. Nothing changed.')
  }

  const fitSelection = () => {
    if (!property || !capability || !track) return
    const frames = selectTicks.map((ticks) => track.keyframes.find((frame) => frame.at.ticks === ticks)).filter((frame): frame is VisualKeyframe => Boolean(frame))
    if (frames.length === 0) { onNotice('Select keyframes before fitting the graph to the selection.'); return }
    const minT = Math.min(...frames.map((frame) => frame.at.ticks))
    const maxT = Math.max(...frames.map((frame) => frame.at.ticks))
    const minV = Math.min(...frames.map((frame) => frame.value))
    const maxV = Math.max(...frames.map((frame) => frame.value))
    setViewport({
      zoomX: clamp(state.durationTicks / Math.max(1, (maxT - minT) * 1.4), 0.5, 10),
      zoomY: clamp((capability.maximum - capability.minimum) / Math.max(0.000001, (maxV - minV) * 1.4), 0.5, 10),
      panX: (minT + maxT) / 2 - state.durationTicks / 2,
      panY: (minV + maxV) / 2 - (capability.minimum + capability.maximum) / 2,
    })
  }

  const cubic = selectedFrame?.easing.kind === 'cubic-bezier' && nextFrame ? selectedFrame.easing : null
  const leftPoint = cubic && range ? editorGraphPoint({ ticks: selectedFrame!.at.ticks, value: selectedFrame!.value, width, height: graphHeight, range }) : null
  const rightPoint = cubic && range ? editorGraphPoint({ ticks: nextFrame!.at.ticks, value: nextFrame!.value, width, height: graphHeight, range }) : null
  const handle1 = cubic && leftPoint && rightPoint ? editorGraphBezierHandlePoint({ left: leftPoint, right: rightPoint, x: cubic.x1, y: cubic.y1 }) : null
  const handle2 = cubic && leftPoint && rightPoint ? editorGraphBezierHandlePoint({ left: leftPoint, right: rightPoint, x: cubic.x2, y: cubic.y2 }) : null
  const constantBezier = selectedFrame && nextFrame ? Math.abs(selectedFrame.value - nextFrame.value) < 1e-12 : false

  return (
    <section ref={hostRef} className="timeline-graph" aria-label="Editor property graph" style={{ height: `${presentation.graphHeightPx}px` }} data-graph-samples={curve.sampleCount}>
      <div className="timeline-graph__toolbar">
        <strong>Property Graph</strong>
        <select aria-label="Graph property" value={property ?? ''} onChange={(event) => setPresentation({ activeProperty: event.currentTarget.value as EditorAnimationPropertyIdV1 })}>
          {available.map((candidate) => <option key={candidate} value={candidate}>{animationCapabilityForProperty(state.targetKind, candidate, state)?.label}</option>)}
        </select>
        <button type="button" onClick={() => setViewport({ panX: 0, panY: 0, zoomX: 1, zoomY: 1 })}>Fit All</button>
        <button type="button" onClick={fitSelection}>Fit Selection</button>
        <label>Zoom X <input aria-label="Graph horizontal zoom" type="range" min="0.5" max="10" step="0.1" value={presentation.graphViewport.zoomX} onChange={(event) => setViewport({ zoomX: Number(event.currentTarget.value) })} /></label>
        <label>Zoom Y <input aria-label="Graph vertical zoom" type="range" min="0.5" max="10" step="0.1" value={presentation.graphViewport.zoomY} onChange={(event) => setViewport({ zoomY: Number(event.currentTarget.value) })} /></label>
        <button type="button" onClick={() => setPresentation({ graphOpen: false })}>Close Graph</button>
      </div>
      {property ? <TimelineGraphInterpolationControls state={state} property={property} selectedTicks={selectTicks} selectedFrame={selectedFrame} hasNextFrame={nextFrame !== null} busy={busy} onCommit={onCommit} onNotice={(message) => onNotice(message)} /> : null}
      {track && range && capability ? (
        <svg ref={svgRef} className="timeline-graph__svg" viewBox={`0 0 ${width} ${graphHeight}`} role="img" aria-label={`${capability.label} animation curve`} onPointerDown={beginPan} onPointerMove={move} onPointerUp={(event) => finish(event, true)} onPointerCancel={(event) => finish(event, false)}>
          {graphMarquee ? <rect x={graphMarquee.left} y={graphMarquee.top} width={graphMarquee.width} height={graphMarquee.height} className="timeline-graph__marquee" aria-hidden="true" /> : null}
          <path d={curve.d} className="timeline-graph__curve" fill="none" />
          {track.keyframes.map((frame) => {
            const point = editorGraphPoint({ ticks: frame.at.ticks, value: frame.value, width, height: graphHeight, range })
            const candidate = keyAddress(subject, property, frame.at.ticks)
            const selected = selection.addresses.some((entry) => entry.property === property && entry.canonicalAtTicks === frame.at.ticks && sameTarget(entry, subject))
            return <circle key={frame.at.ticks} cx={point.x} cy={point.y} r={selected ? 6 : 5} className="timeline-graph__point" data-selected={selected ? 'yes' : 'no'} tabIndex={0} role="button" aria-label={`${capability.label} keyframe at ${frame.at.ticks} ticks`} onClick={(event) => onSelectionChange(event.ctrlKey || event.metaKey ? toggleEditorKeyframeSelection(selection, candidate) : selectOnlyEditorKeyframe(candidate))} onPointerDown={(event) => beginPoint(event, frame)} onPointerMove={move} onPointerUp={(event) => finish(event, true)} onPointerCancel={(event) => finish(event, false)} />
          })}
          {cubic && leftPoint && rightPoint && handle1 && handle2 && !constantBezier ? <>
            <line x1={leftPoint.x} y1={leftPoint.y} x2={handle1.x} y2={handle1.y} className="timeline-graph__tangent" />
            <line x1={leftPoint.x} y1={leftPoint.y} x2={handle2.x} y2={handle2.y} className="timeline-graph__tangent" />
            <circle cx={handle1.x} cy={handle1.y} r={5} className="timeline-graph__bezier-handle" tabIndex={0} role="button" aria-label="Bezier first handle" onPointerDown={(event) => beginBezier(event, 'bezier-1')} onPointerMove={move} onPointerUp={(event) => finish(event, true)} onPointerCancel={(event) => finish(event, false)} />
            <circle cx={handle2.x} cy={handle2.y} r={5} className="timeline-graph__bezier-handle" tabIndex={0} role="button" aria-label="Bezier second handle" onPointerDown={(event) => beginBezier(event, 'bezier-2')} onPointerMove={move} onPointerUp={(event) => finish(event, true)} onPointerCancel={(event) => finish(event, false)} />
          </> : null}
          {constantBezier && cubic ? <text x="12" y="20" className="timeline-graph__hint">Equal values — easing cannot change this visible segment.</text> : null}
        </svg>
      ) : <p className="timeline-graph__empty">Animate the active property to draw its curve.</p>}
    </section>
  )
}
