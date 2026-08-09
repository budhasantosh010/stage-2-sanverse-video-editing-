import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  animationCapabilitiesForTarget,
  animationKeyframesVisibleInPlacement,
  compositionTicksToAnimationKeyframeTicks,
  createEditorKeyframeClipboard,
  planAddEditorKeyframe,
  planDeleteEditorKeyframes,
  planMoveEditorKeyframes,
  planPasteEditorKeyframes,
  planRemoveAnimationTrack,
  planSetEditorKeyframeValues,
  projectAnimationKeyframeToCompositionTicks,
  type EditorAnimationPropertyIdV1,
  type EditorAnimationTrackPlanV1,
  type EditorAnimationTrackStateV1,
  type EditorKeyframeAddressV1,
  type EditorKeyframeClipboardV1,
  type EditorKeyframeSelectionV1,
  type VisualPropertyTrack,
} from '@sanverse/edit-domain'
import {
  ANIMATION_PROPERTY_LANE_HEIGHT_PX,
  animationTargetExpanded,
  extendEditorKeyframeSelection,
  keyframeAddressEqual,
  selectAllEditorKeyframesInProperty,
  selectOnlyEditorKeyframe,
  toggleEditorKeyframeSelection,
  type TimelineAnimationPresentationV1,
  type TimelineAnimationSubjectV1,
  type VisibleTickRange,
} from '../../features/timeline'
import { pixelsToTicks, ticksToPixels, type PrecisionFrameRateV1 } from '../../features/timeline'
import { TimelineKeyframeNumericPopover } from './TimelineKeyframeNumericPopover'

export type TimelineAnimationLanesProps = Readonly<{
  subject: TimelineAnimationSubjectV1
  presentation: TimelineAnimationPresentationV1
  selection: EditorKeyframeSelectionV1
  clipboard: EditorKeyframeClipboardV1 | null
  visibleRange: VisibleTickRange
  overscanTicks: number
  pixelsPerSecond: number
  timescale: number
  playheadTicks: number
  frameTicks: number
  frameRate: PrecisionFrameRateV1
  compositionDurationTicks: number
  busy: boolean
  onPresentationChange(next: TimelineAnimationPresentationV1): void
  onSelectionChange(next: EditorKeyframeSelectionV1): void
  onClipboardChange(next: EditorKeyframeClipboardV1 | null): void
  onDraft(next: EditorAnimationTrackStateV1 | null): void
  onCommit(next: EditorAnimationTrackStateV1): void
  onSeek(ticks: number): void
  onNotice(message: string | null): void
}>

type DragState = Readonly<{
  pointerId: number
  startClientX: number
  startClientY: number
  property: EditorAnimationPropertyIdV1
  selected: readonly EditorKeyframeAddressV1[]
  originalState: EditorAnimationTrackStateV1
  draftState: EditorAnimationTrackStateV1
  mode: 'time' | 'value'
  changed: boolean
}>

const PROPERTY_ORDER: readonly EditorAnimationPropertyIdV1[] = Object.freeze([
  'translate-x', 'translate-y', 'scale', 'rotation', 'opacity',
  'crop-top', 'crop-right', 'crop-bottom', 'crop-left',
])

const labelFor = (property: EditorAnimationPropertyIdV1): string => ({
  'translate-x': 'Position X',
  'translate-y': 'Position Y',
  scale: 'Scale',
  rotation: 'Rotation',
  opacity: 'Opacity',
  'crop-top': 'Crop Top',
  'crop-right': 'Crop Right',
  'crop-bottom': 'Crop Bottom',
  'crop-left': 'Crop Left',
})[property]

const valueText = (property: EditorAnimationPropertyIdV1, value: number): string =>
  property === 'rotation' ? `${Number(value.toFixed(2))}°` : `${Number((value * 100).toFixed(2))}%`

const planMessage = (plan: EditorAnimationTrackPlanV1): string | null => plan.ok ? null : plan.refusal.message

const address = (
  subject: TimelineAnimationSubjectV1,
  property: EditorAnimationPropertyIdV1,
  canonicalAtTicks: number,
): EditorKeyframeAddressV1 => Object.freeze({ target: subject.target, property, canonicalAtTicks })

const selectedFor = (
  selection: EditorKeyframeSelectionV1,
  candidate: EditorKeyframeAddressV1,
): boolean => selection.addresses.some((entry) => keyframeAddressEqual(entry, candidate))

const trackFor = (
  state: EditorAnimationTrackStateV1,
  property: EditorAnimationPropertyIdV1,
): VisualPropertyTrack | null => state.tracks.find((track) => track.property === property) ?? null

export function TimelineAnimationLanes({
  subject,
  presentation,
  selection,
  clipboard,
  visibleRange,
  overscanTicks,
  pixelsPerSecond,
  timescale,
  playheadTicks,
  frameTicks,
  frameRate,
  compositionDurationTicks,
  busy,
  onPresentationChange,
  onSelectionChange,
  onClipboardChange,
  onDraft,
  onCommit,
  onSeek,
  onNotice,
}: TimelineAnimationLanesProps) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [marquee, setMarquee] = useState<Readonly<{ property: EditorAnimationPropertyIdV1; pointerId: number; startX: number; currentX: number; add: boolean }> | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const state = drag?.draftState ?? subject.state
  const capabilities = useMemo(
    () => animationCapabilitiesForTarget(subject.state.targetKind, subject.state),
    [subject.state],
  )
  const animated = new Set(state.tracks.map((track) => track.property))
  const visibleProperties = capabilities
    .filter((capability) => presentation.visibleMode === 'all' || animated.has(capability.property))
    .sort((left, right) => PROPERTY_ORDER.indexOf(left.property) - PROPERTY_ORDER.indexOf(right.property))
  const expanded = animationTargetExpanded(presentation, subject.target)

  useEffect(() => {
    dragRef.current = drag
  }, [drag])

  useEffect(() => {
    if (!drag) return
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onDraft(null)
      setDrag(null)
      onNotice('Animation change cancelled. Nothing changed.')
    }
    globalThis.addEventListener('keydown', cancel)
    return () => globalThis.removeEventListener('keydown', cancel)
  }, [drag, onDraft, onNotice])

  const setActiveProperty = (property: EditorAnimationPropertyIdV1) => {
    onPresentationChange(Object.freeze({ ...presentation, activeProperty: property }))
  }

  const playheadCanonical = (): number | null =>
    compositionTicksToAnimationKeyframeTicks(subject.timeContext, playheadTicks)

  const commitPlan = (plan: EditorAnimationTrackPlanV1, message: string) => {
    if (!plan.ok) {
      onNotice(plan.refusal.message)
      return
    }
    onCommit(plan.state)
    if (plan.selectedTicks.length > 0 && presentation.activeProperty) {
      onSelectionChange(selectAllEditorKeyframesInProperty(subject.target, presentation.activeProperty, plan.selectedTicks))
    }
    onNotice(message)
  }

  const activeProperty = presentation.activeProperty && capabilities.some((capability) => capability.property === presentation.activeProperty)
    ? presentation.activeProperty
    : visibleProperties[0]?.property ?? capabilities[0]?.property ?? null

  const addAtPlayhead = () => {
    if (!activeProperty) return
    const canonical = playheadCanonical()
    if (canonical === null) {
      onNotice('Move the playhead inside this animation before adding a keyframe.')
      return
    }
    const existing = trackFor(state, activeProperty)?.keyframes.find((frame) => frame.at.ticks === canonical)
    if (existing) {
      onSelectionChange(selectOnlyEditorKeyframe(address(subject, activeProperty, canonical)))
      onNotice('Keyframe selected at the playhead.')
      return
    }
    commitPlan(planAddEditorKeyframe({ state, property: activeProperty, canonicalAtTicks: canonical }), 'Keyframe added. Undo removes this animation edit.')
  }

  const toggleAtPlayhead = () => {
    if (!activeProperty) return
    const canonical = playheadCanonical()
    if (canonical === null) {
      onNotice('Move the playhead inside this animation before toggling a keyframe.')
      return
    }
    const exists = trackFor(state, activeProperty)?.keyframes.some((frame) => frame.at.ticks === canonical)
    if (!exists) {
      addAtPlayhead()
      return
    }
    commitPlan(planDeleteEditorKeyframes({ state, property: activeProperty, canonicalAtTicks: [canonical] }), 'Keyframe removed. Undo restores it.')
  }

  const selectedInActiveProperty = activeProperty
    ? selection.addresses.filter((entry) => entry.property === activeProperty && entry.target.kind === subject.target.kind)
    : []
  const selectedAddress = selectedInActiveProperty.length === 1 ? selectedInActiveProperty[0] : null

  const deleteSelected = () => {
    if (!activeProperty) return
    commitPlan(planDeleteEditorKeyframes({
      state,
      property: activeProperty,
      canonicalAtTicks: selectedInActiveProperty.map((entry) => entry.canonicalAtTicks),
    }), 'Selected keyframes removed.')
  }

  const removeAnimation = () => {
    if (!activeProperty) return
    commitPlan(planRemoveAnimationTrack({ state, property: activeProperty }), 'Animation removed. Static property value is unchanged.')
  }

  const copySelected = (): EditorKeyframeClipboardV1 | null => {
    if (!activeProperty) return null
    const track = trackFor(state, activeProperty)
    if (!track) return null
    const next = createEditorKeyframeClipboard({ track, canonicalAtTicks: selectedInActiveProperty.map((entry) => entry.canonicalAtTicks) })
    onClipboardChange(next)
    onNotice(next ? `${next.keyframes.length} keyframe${next.keyframes.length === 1 ? '' : 's'} copied.` : 'Select keyframes to copy.')
    return next
  }

  const cutSelected = () => {
    const copied = copySelected()
    if (!copied || !activeProperty) return
    commitPlan(planDeleteEditorKeyframes({ state, property: activeProperty, canonicalAtTicks: selectedInActiveProperty.map((entry) => entry.canonicalAtTicks) }), 'Keyframes cut. Undo restores them.')
  }

  const pasteAt = (anchorTicks: number) => {
    if (!activeProperty || !clipboard) {
      onNotice('Copy compatible keyframes before pasting.')
      return
    }
    commitPlan(planPasteEditorKeyframes({ state, property: activeProperty, clipboard, anchorTicks }), 'Keyframes pasted.')
  }

  const pasteAtPlayhead = () => {
    const canonical = playheadCanonical()
    if (canonical === null) {
      onNotice('Move the playhead inside this animation before pasting.')
      return
    }
    pasteAt(canonical)
  }

  const duplicateSelected = () => {
    const copied = copySelected()
    if (!copied || !activeProperty || selectedInActiveProperty.length === 0) return
    const ticks = selectedInActiveProperty.map((entry) => entry.canonicalAtTicks).sort((a, b) => a - b)
    const span = ticks.at(-1)! - ticks[0]
    const anchor = ticks.at(-1)! + Math.max(frameTicks, span + frameTicks)
    commitPlan(planPasteEditorKeyframes({ state, property: activeProperty, clipboard: copied, anchorTicks: anchor }), 'Keyframes duplicated.')
  }

  const seekAdjacent = (direction: -1 | 1) => {
    if (!activeProperty) return
    const track = trackFor(state, activeProperty)
    if (!track) return
    const current = playheadCanonical()
    if (current === null) return
    const candidate = direction < 0
      ? track.keyframes.filter((frame) => frame.at.ticks < current).at(-1)
      : track.keyframes.find((frame) => frame.at.ticks > current)
    if (!candidate) return
    const composition = projectAnimationKeyframeToCompositionTicks(subject.timeContext, candidate.at.ticks)
    if (composition !== null) onSeek(composition)
  }

  const beginDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    property: EditorAnimationPropertyIdV1,
    canonicalAtTicks: number,
  ) => {
    if (busy) return
    const candidate = address(subject, property, canonicalAtTicks)
    let nextSelection = selection
    if (event.shiftKey) {
      const ordered = trackFor(state, property)?.keyframes.map((frame) => frame.at.ticks) ?? []
      nextSelection = extendEditorKeyframeSelection(selection, candidate, ordered)
    } else if (event.ctrlKey || event.metaKey) {
      nextSelection = toggleEditorKeyframeSelection(selection, candidate)
    } else if (!selectedFor(selection, candidate)) {
      nextSelection = selectOnlyEditorKeyframe(candidate)
    }
    onSelectionChange(nextSelection)
    setActiveProperty(property)
    const selected = nextSelection.addresses.filter((entry) => entry.property === property)
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* browser may not implement capture in tests */ }
    const next: DragState = Object.freeze({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      property,
      selected,
      originalState: state,
      draftState: state,
      mode: event.altKey ? 'value' : 'time',
      changed: false,
    })
    dragRef.current = next
    setDrag(next)
    event.preventDefault()
    event.stopPropagation()
  }

  const updateDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    let plan: EditorAnimationTrackPlanV1
    if (current.mode === 'time') {
      const deltaComposition = pixelsToTicks(event.clientX - current.startClientX, timescale, pixelsPerSecond)
      const moves = current.selected.map((selected) => {
        const originalComposition = projectAnimationKeyframeToCompositionTicks(subject.timeContext, selected.canonicalAtTicks)
        const nextCanonical = originalComposition === null
          ? null
          : compositionTicksToAnimationKeyframeTicks(subject.timeContext, Math.max(0, originalComposition + deltaComposition))
        return nextCanonical === null ? null : Object.freeze({
          property: selected.property,
          fromTicks: selected.canonicalAtTicks,
          toTicks: nextCanonical,
        })
      })
      if (moves.some((move) => move === null)) {
        onNotice('That move would place a keyframe outside this visible source interval.')
        return
      }
      plan = planMoveEditorKeyframes({ state: current.originalState, moves: moves as NonNullable<typeof moves[number]>[] })
    } else {
      const capability = capabilities.find((entry) => entry.property === current.property)
      const propertySelection = current.selected.filter((entry) => entry.property === current.property)
      const track = trackFor(current.originalState, current.property)
      if (!capability || !track || propertySelection.length === 0) return
      const range = capability.maximum - capability.minimum
      const delta = -(event.clientY - current.startClientY) * range / 500
      plan = planSetEditorKeyframeValues({
        state: current.originalState,
        updates: propertySelection.map((selected) => {
          const frame = track.keyframes.find((candidate) => candidate.at.ticks === selected.canonicalAtTicks)!
          return Object.freeze({ property: current.property, canonicalAtTicks: selected.canonicalAtTicks, value: frame.value + delta })
        }),
      })
    }
    if (!plan.ok) {
      onNotice(plan.refusal.message)
      return
    }
    const next = Object.freeze({ ...current, draftState: plan.state, changed: true })
    dragRef.current = next
    setDrag(next)
    onDraft(plan.state)
    onNotice(current.mode === 'time' ? 'Keyframe timing preview. Release to apply; Escape cancels.' : 'Keyframe value preview. Release to apply; Escape cancels.')
  }

  const keyboardEdit = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    property: EditorAnimationPropertyIdV1,
    canonicalAtTicks: number,
  ) => {
    if (busy) return
    const candidate = address(subject, property, canonicalAtTicks)
    const currentSelection = selectedFor(selection, candidate)
      ? selection.addresses.filter((entry) => entry.property === property)
      : [candidate]
    if (!selectedFor(selection, candidate)) onSelectionChange(selectOnlyEditorKeyframe(candidate))
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      commitPlan(planDeleteEditorKeyframes({ state, property, canonicalAtTicks: currentSelection.map((entry) => entry.canonicalAtTicks) }), 'Selected keyframes removed.')
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      const stepComposition = frameTicks * direction * (event.shiftKey ? 10 : 1)
      const moves = currentSelection.map((entry) => {
        const composition = projectAnimationKeyframeToCompositionTicks(subject.timeContext, entry.canonicalAtTicks)
        const nextCanonical = composition === null ? null : compositionTicksToAnimationKeyframeTicks(subject.timeContext, Math.max(0, composition + stepComposition))
        return nextCanonical === null ? null : Object.freeze({ property, fromTicks: entry.canonicalAtTicks, toTicks: nextCanonical })
      })
      if (moves.some((move) => move === null)) {
        onNotice('That keyboard move would place a keyframe outside the available animation range.')
        return
      }
      const planned = planMoveEditorKeyframes({ state, moves: moves as NonNullable<typeof moves[number]>[] })
      if (!planned.ok) { onNotice(planned.refusal.message); return }
      onCommit(planned.state)
      const nextAddresses = currentSelection.map((entry, index) => address(subject, property, (moves[index] as NonNullable<typeof moves[number]>).toTicks))
      onSelectionChange(Object.freeze({ addresses: Object.freeze(nextAddresses), anchor: nextAddresses[0] ?? null }))
      onNotice(`Keyframes moved ${direction < 0 ? 'earlier' : 'later'} by ${event.shiftKey ? 10 : 1} frame${event.shiftKey ? 's' : ''}.`)
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const capability = capabilities.find((entry) => entry.property === property)
      const propertyTrack = trackFor(state, property)
      if (!capability || !propertyTrack) return
      const direction = event.key === 'ArrowUp' ? 1 : -1
      const step = (capability.maximum - capability.minimum) * (event.shiftKey ? 0.05 : 0.01) * direction
      const planned = planSetEditorKeyframeValues({
        state,
        updates: currentSelection.map((entry) => {
          const frame = propertyTrack.keyframes.find((candidateFrame) => candidateFrame.at.ticks === entry.canonicalAtTicks)!
          return Object.freeze({ property, canonicalAtTicks: entry.canonicalAtTicks, value: frame.value + step })
        }),
      })
      if (!planned.ok) { onNotice(planned.refusal.message); return }
      onCommit(planned.state)
      onNotice(`Keyframe value ${direction > 0 ? 'increased' : 'decreased'}.`)
    }
  }

  const beginLaneMarquee = (
    event: ReactPointerEvent<HTMLDivElement>,
    property: EditorAnimationPropertyIdV1,
  ) => {
    if (!event.shiftKey || event.target !== event.currentTarget || busy) return
    const rect = event.currentTarget.getBoundingClientRect()
    const startX = event.clientX - rect.left
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* optional */ }
    setMarquee(Object.freeze({ property, pointerId: event.pointerId, startX, currentX: startX, add: event.ctrlKey || event.metaKey }))
    event.preventDefault()
    event.stopPropagation()
  }

  const updateLaneMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!marquee || marquee.pointerId !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    setMarquee(Object.freeze({ ...marquee, currentX: event.clientX - rect.left }))
  }

  const finishLaneMarquee = (event: ReactPointerEvent<HTMLDivElement>, accept: boolean) => {
    if (!marquee || marquee.pointerId !== event.pointerId) return
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* optional */ }
    if (accept) {
      const track = trackFor(state, marquee.property)
      if (track) {
        const left = Math.min(marquee.startX, marquee.currentX)
        const right = Math.max(marquee.startX, marquee.currentX)
        const projected = animationKeyframesVisibleInPlacement(subject.timeContext, track)
        const picked = projected
          .filter((entry) => {
            const x = ticksToPixels(entry.compositionTicks, timescale, pixelsPerSecond)
            return x >= left && x <= right
          })
          .map((entry) => address(subject, marquee.property, entry.keyframe.at.ticks))
        const addresses = marquee.add
          ? Object.freeze([...selection.addresses, ...picked.filter((candidate) => !selectedFor(selection, candidate))])
          : Object.freeze(picked)
        onSelectionChange(Object.freeze({ addresses, anchor: addresses[0] ?? null }))
        onNotice(`${picked.length} keyframe${picked.length === 1 ? '' : 's'} selected.`)
      }
    }
    setMarquee(null)
  }

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>, accept: boolean) => {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* optional */ }
    dragRef.current = null
    setDrag(null)
    onDraft(null)
    if (accept && current.changed) {
      onCommit(current.draftState)
      onNotice('Animation keyframes applied. Undo takes back the whole gesture.')
      const addresses = current.selected.map((entry) => {
        const originalComposition = projectAnimationKeyframeToCompositionTicks(subject.timeContext, entry.canonicalAtTicks)
        const deltaComposition = pixelsToTicks(event.clientX - current.startClientX, timescale, pixelsPerSecond)
        const nextCanonical = current.mode === 'time' && originalComposition !== null
          ? compositionTicksToAnimationKeyframeTicks(subject.timeContext, Math.max(0, originalComposition + deltaComposition)) ?? entry.canonicalAtTicks
          : entry.canonicalAtTicks
        return address(subject, entry.property, nextCanonical)
      })
      onSelectionChange(Object.freeze({ addresses: Object.freeze(addresses), anchor: addresses[0] ?? null }))
    } else {
      onNotice('Animation change cancelled. Nothing changed.')
    }
  }

  if (!expanded) return null

  return (
    <section className="timeline-animation" aria-label={`${subject.label} animation properties`} data-animation-target={subject.itemId}>
      <div className="timeline-animation__toolbar">
        <strong>{subject.sourceAnchored ? 'Source animation' : 'Animation'}</strong>
        {subject.sourceAnchored ? <span title="Source animation — follows this footage wherever this source range is used.">Follows source</span> : null}
        <label>
          <span className="timeline-v1__visually-hidden">Animation property visibility</span>
          <select
            aria-label="Animation properties shown"
            value={presentation.visibleMode}
            onChange={(event) => onPresentationChange(Object.freeze({ ...presentation, visibleMode: event.currentTarget.value as 'animated' | 'all' }))}
          >
            <option value="animated">Animated properties</option>
            <option value="all">All available properties</option>
          </select>
        </label>
        <label>
          <span className="timeline-v1__visually-hidden">Active animation property</span>
          <select
            aria-label="Active animation property"
            value={activeProperty ?? ''}
            onChange={(event) => setActiveProperty(event.currentTarget.value as EditorAnimationPropertyIdV1)}
          >
            {capabilities.map((capability) => <option key={capability.property} value={capability.property}>{capability.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={addAtPlayhead} disabled={busy || !activeProperty}>Add Keyframe at Playhead</button>
        <button type="button" onClick={toggleAtPlayhead} disabled={busy || !activeProperty}>Toggle Keyframe at Playhead</button>
        <button type="button" onClick={() => seekAdjacent(-1)} disabled={!activeProperty}>Previous Keyframe</button>
        <button type="button" onClick={() => seekAdjacent(1)} disabled={!activeProperty}>Next Keyframe</button>
        <button type="button" onClick={deleteSelected} disabled={busy || selectedInActiveProperty.length === 0}>Delete Selected Keyframe(s)</button>
        <button type="button" onClick={removeAnimation} disabled={busy || !activeProperty || !trackFor(state, activeProperty)}>Remove Animation</button>
        <button type="button" onClick={copySelected} disabled={selectedInActiveProperty.length === 0}>Copy</button>
        <button type="button" onClick={cutSelected} disabled={busy || selectedInActiveProperty.length === 0}>Cut</button>
        <button type="button" onClick={pasteAtPlayhead} disabled={busy || !clipboard || !activeProperty}>Paste at Playhead</button>
        <button type="button" onClick={duplicateSelected} disabled={busy || selectedInActiveProperty.length === 0}>Duplicate</button>
      </div>

      <TimelineKeyframeNumericPopover
        subject={subject}
        state={state}
        address={selectedAddress}
        timescale={timescale}
        frameRate={frameRate}
        compositionDurationTicks={compositionDurationTicks}
        busy={busy}
        onCommit={onCommit}
        onSelectionTimeChange={(canonicalAtTicks) => {
          if (!activeProperty) return
          onSelectionChange(selectOnlyEditorKeyframe(address(subject, activeProperty, canonicalAtTicks)))
        }}
        onNotice={(message) => onNotice(message)}
      />

      <div className="timeline-animation__rows">
        {visibleProperties.length === 0 ? (
          <p className="timeline-animation__empty">No animated properties yet. Show all available properties or add a keyframe.</p>
        ) : visibleProperties.map((capability) => {
          const track = trackFor(state, capability.property)
          const projected = track ? animationKeyframesVisibleInPlacement(subject.timeContext, track) : []
          const orderedTicks = track?.keyframes.map((frame) => frame.at.ticks) ?? []
          const visible = projected.filter((entry) =>
            entry.compositionTicks >= visibleRange.startTicks - overscanTicks && entry.compositionTicks <= visibleRange.endTicks + overscanTicks,
          )
          return (
            <div
              className={`timeline-animation__row${activeProperty === capability.property ? ' timeline-animation__row--active' : ''}`}
              key={capability.property}
              data-animation-property={capability.property}
              style={{ height: `${ANIMATION_PROPERTY_LANE_HEIGHT_PX}px` }}
              onClick={() => setActiveProperty(capability.property)}
            >
              <div className="timeline-animation__row-label">
                <button type="button" onClick={() => setActiveProperty(capability.property)}>{capability.label}</button>
                <span>{track ? `${track.keyframes.length} keyframe${track.keyframes.length === 1 ? '' : 's'}` : 'Static'}</span>
              </div>
              <div
                className="timeline-animation__row-time"
                aria-label={`${capability.label} keyframes`}
                onPointerDown={(event) => beginLaneMarquee(event, capability.property)}
                onPointerMove={updateLaneMarquee}
                onPointerUp={(event) => finishLaneMarquee(event, true)}
                onPointerCancel={(event) => finishLaneMarquee(event, false)}
              >
                {marquee?.property === capability.property ? (
                  <span
                    className="timeline-animation__marquee"
                    aria-hidden="true"
                    style={{
                      left: `${Math.min(marquee.startX, marquee.currentX)}px`,
                      width: `${Math.abs(marquee.currentX - marquee.startX)}px`,
                    }}
                  />
                ) : null}
                {track && track.keyframes.length > 1 ? <span className="timeline-animation__segment-line" aria-hidden="true" /> : null}
                {visible.map(({ keyframe, compositionTicks }) => {
                  const keyframeAddress = address(subject, capability.property, keyframe.at.ticks)
                  const selected = selectedFor(selection, keyframeAddress)
                  const atPlayhead = Math.abs(compositionTicks - playheadTicks) <= Math.max(1, frameTicks / 2)
                  const leftPx = ticksToPixels(compositionTicks, timescale, pixelsPerSecond)
                  return (
                    <button
                      type="button"
                      key={`${capability.property}:${keyframe.at.ticks}`}
                      className="timeline-animation__diamond-hit"
                      style={{ left: `${leftPx}px` }}
                      aria-pressed={selected}
                      aria-label={`${capability.label} keyframe, ${keyframe.at.ticks} ticks, ${valueText(capability.property, keyframe.value)}, ${keyframe.easing.kind}`}
                      title={`${capability.label} · ${valueText(capability.property, keyframe.value)} · ${keyframe.easing.kind}`}
                      data-keyframe-selected={selected ? 'yes' : 'no'}
                      data-keyframe-playhead={atPlayhead ? 'yes' : 'no'}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (event.shiftKey) {
                          onSelectionChange(extendEditorKeyframeSelection(selection, keyframeAddress, orderedTicks))
                        } else if (event.ctrlKey || event.metaKey) {
                          onSelectionChange(toggleEditorKeyframeSelection(selection, keyframeAddress))
                        } else {
                          onSelectionChange(selectOnlyEditorKeyframe(keyframeAddress))
                        }
                        setActiveProperty(capability.property)
                      }}
                      onDoubleClick={() => onSelectionChange(selectAllEditorKeyframesInProperty(subject.target, capability.property, orderedTicks))}
                      onKeyDown={(event) => keyboardEdit(event, capability.property, keyframe.at.ticks)}
                      onPointerDown={(event) => beginDrag(event, capability.property, keyframe.at.ticks)}
                      onPointerMove={updateDrag}
                      onPointerUp={(event) => finishDrag(event, true)}
                      onPointerCancel={(event) => finishDrag(event, false)}
                    >
                      <span className="timeline-animation__diamond" aria-hidden="true" />
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {drag ? <p className="timeline-animation__drag-status" role="status">{planMessage({ ok: true, state: drag.draftState, selectedTicks: [] }) ?? (drag.mode === 'time' ? 'Moving keyframe timing' : 'Changing keyframe value')}</p> : null}
    </section>
  )
}
