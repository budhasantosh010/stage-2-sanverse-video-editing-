import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import type { EditOperation, VisualProperties } from '@sanverse/edit-domain'

import { createInspectorOperationId } from '../inspector/inspector-operation-id'
import { CanvasAlignmentGuides } from './CanvasAlignmentGuides'
import { CanvasInteractionToolbar } from './CanvasInteractionToolbar'
import { CanvasSelectionBox } from './CanvasSelectionBox'
import type {
  CanvasCropEdge,
  CanvasHitTarget,
  CanvasInteractionMode,
  CanvasInteractionSession,
  CanvasPoint,
  CanvasRect,
  CanvasResizeCorner,
  CanvasSelectionResult,
  CanvasVisualSelection,
  SharedVisualDraftController,
} from './canvas-contract'
import { measureCanvasNode } from './canvas-dom-geometry'
import {
  cropFromClientDelta,
  moveTransformByClientDelta,
  rectCenter,
  resizeUniformFromCorner,
  rotateFromClientPoint,
} from './canvas-geometry'
import { beginCanvasInteraction, updateCanvasInteraction } from './canvas-gesture-state'
import { buildCanvasVisualOperation, canvasAnimatedPropertyConflict } from './canvas-operation-builder'
import { snapCanvasRect } from './canvas-snap'
import './CanvasInteractionLayer.css'

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value))

const propertiesWithTransform = (
  properties: VisualProperties,
  transform: VisualProperties['transform'],
): VisualProperties => Object.freeze({ ...properties, transform })

const localPoint = (event: Pick<PointerEvent, 'clientX' | 'clientY'>, layer: HTMLElement): CanvasPoint => {
  const rect = layer.getBoundingClientRect()
  return Object.freeze({ x: event.clientX - rect.left, y: event.clientY - rect.top })
}

const sameRects = (left: ReadonlyMap<string, CanvasRect>, right: ReadonlyMap<string, CanvasRect>): boolean => {
  if (left.size !== right.size) return false
  for (const [key, value] of left) {
    const candidate = right.get(key)
    if (!candidate || candidate.x !== value.x || candidate.y !== value.y || candidate.width !== value.width || candidate.height !== value.height) return false
  }
  return true
}

export type CanvasInteractionLayerProps = Readonly<{
  contentLayerRef: RefObject<HTMLDivElement | null>
  selectionResult: CanvasSelectionResult
  targets: readonly CanvasHitTarget[]
  draftController: SharedVisualDraftController
  busy: boolean
  narrow: boolean
  cropMode: boolean
  onCropModeChange(active: boolean): void
  onSelectTimelineItem(itemId: string | null): void
  onApply(operation: EditOperation): Promise<string | null>
  onProposalPreviewPoint(point: CanvasPoint | null): void
  onProposalPointCommit(point: CanvasPoint): void
  onPausePlayback(): void
  onFocusInspector(): void
}>

export function CanvasInteractionLayer({
  contentLayerRef,
  selectionResult,
  targets,
  draftController,
  busy,
  narrow,
  cropMode,
  onCropModeChange,
  onSelectTimelineItem,
  onApply,
  onProposalPreviewPoint,
  onProposalPointCommit,
  onPausePlayback,
  onFocusInspector,
}: CanvasInteractionLayerProps) {
  const [rects, setRects] = useState<ReadonlyMap<string, CanvasRect>>(() => new Map())
  const [session, setSession] = useState<CanvasInteractionSession | null>(null)
  const [safeAreas, setSafeAreas] = useState(false)
  const [saving, setSaving] = useState(false)
  const sessionRef = useRef<CanvasInteractionSession | null>(null)
  const proposalPointRef = useRef<CanvasPoint | null>(null)

  const selected = selectionResult.kind === 'supported' ? selectionResult.selection : null
  const properties = selected?.state === 'committed'
    ? draftController.draft?.value ?? selected.visualProperties
    : selected?.visualProperties ?? null
  const selectedRect = selected ? rects.get(selected.nodeId) ?? null : null

  const refreshRects = useCallback(() => {
    const layer = contentLayerRef.current
    if (!layer) {
      setRects(new Map())
      return
    }
    const next = new Map<string, CanvasRect>()
    for (const target of targets) {
      const rect = measureCanvasNode(layer, target.nodeId)
      if (rect) next.set(target.nodeId, rect)
    }
    if (selected && !next.has(selected.nodeId)) {
      const rect = measureCanvasNode(layer, selected.nodeId)
      if (rect) next.set(selected.nodeId, rect)
    }
    setRects((current) => sameRects(current, next) ? current : next)
  }, [contentLayerRef, selected, targets])

  useLayoutEffect(() => {
    const layer = contentLayerRef.current
    if (!layer) return
    const frame = requestAnimationFrame(refreshRects)
    const mutation = typeof MutationObserver === 'undefined' ? null : new MutationObserver(refreshRects)
    mutation?.observe(layer, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
    window.addEventListener('resize', refreshRects)
    return () => {
      cancelAnimationFrame(frame)
      mutation?.disconnect()
      window.removeEventListener('resize', refreshRects)
    }
  }, [contentLayerRef, draftController.draft?.value, refreshRects, selectionResult, targets])

  const updateSession = useCallback((next: CanvasInteractionSession | null) => {
    sessionRef.current = next
    setSession(next)
  }, [])

  const cancelInteraction = useCallback(() => {
    updateSession(null)
    proposalPointRef.current = null
    onProposalPreviewPoint(null)
    if (selected?.state === 'committed') {
      draftController.reset()
      draftController.endInteraction()
    }
    if (cropMode) onCropModeChange(false)
  }, [cropMode, draftController, onCropModeChange, onProposalPreviewPoint, selected, updateSession])

  const commitProperties = useCallback(async (
    selection: CanvasVisualSelection,
    finalProperties: VisualProperties,
    mode: CanvasInteractionMode,
  ) => {
    const built = buildCanvasVisualOperation(selection, finalProperties, createInspectorOperationId())
    if (!built.ok) {
      draftController.reset()
      draftController.reportNotice(built.message)
      draftController.endInteraction()
      updateSession(null)
      if (mode === 'crop') onCropModeChange(false)
      return
    }
    setSaving(true)
    const failure = await onApply(built.operation)
    setSaving(false)
    if (failure) {
      draftController.reset()
      draftController.reportNotice('The move could not be saved. Your accepted project was not changed.')
    } else {
      draftController.markApplied()
      draftController.reportNotice('Saved. Undo restores the previous canvas position.')
    }
    draftController.endInteraction()
    updateSession(null)
    if (mode === 'crop') onCropModeChange(false)
  }, [draftController, onApply, onCropModeChange, updateSession])

  useEffect(() => {
    if (!cropMode) return
    if (!selected || selected.state !== 'committed' || !selected.supportsCrop || busy || narrow) {
      onCropModeChange(false)
      return
    }
    if (draftController.draft?.interaction === 'crop') return
    if (!draftController.beginInteraction('crop')) {
      onFocusInspector()
      onCropModeChange(false)
    }
  }, [busy, cropMode, draftController, narrow, onCropModeChange, onFocusInspector, selected])

  useEffect(() => {
    if (!session && !cropMode) return
    const cancel = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      cancelInteraction()
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [cancelInteraction, cropMode, session])

  const startPointer = (
    mode: CanvasInteractionMode,
    event: ReactPointerEvent<HTMLButtonElement>,
    resizeCorner: CanvasResizeCorner | null = null,
    cropEdge: CanvasCropEdge | null = null,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const layer = contentLayerRef.current
    if (!layer || !selected || !selectedRect || busy || saving || narrow) return
    if (selected.state === 'proposed' && mode !== 'move') return
    if (selected.state === 'committed') {
      const conflict = canvasAnimatedPropertyConflict(selected, mode)
      if (conflict) {
        draftController.reportNotice(conflict)
        onFocusInspector()
        return
      }
      if (mode !== 'crop' && !draftController.beginInteraction(mode)) {
        onFocusInspector()
        return
      }
      if (mode === 'crop' && draftController.draft?.interaction !== 'crop') return
    }
    const startProperties = selected.state === 'committed'
      ? draftController.draft?.value ?? selected.visualProperties
      : selected.visualProperties
    const next = beginCanvasInteraction({
      mode,
      pointerId: event.pointerId,
      startClient: localPoint(event.nativeEvent, layer),
      startRect: selectedRect,
      properties: startProperties,
      resizeCorner,
      cropEdge,
    })
    if (!next) return
    onPausePlayback()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    proposalPointRef.current = selected.proposalPoint
    updateSession(next)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = sessionRef.current
    const layer = contentLayerRef.current
    if (!current || !layer || current.pointerId !== event.pointerId || !selected) return
    const point = localPoint(event.nativeEvent, layer)
    const frame: CanvasRect = { x: 0, y: 0, width: layer.clientWidth, height: layer.clientHeight }
    if (frame.width <= 0 || frame.height <= 0) return

    if (selected.state === 'proposed') {
      const origin = selected.proposalPoint
      if (!origin) return
      const nextPoint = Object.freeze({
        x: clamp(origin.x + (point.x - current.startClient.x) / frame.width, 0, 1),
        y: clamp(origin.y + (point.y - current.startClient.y) / frame.height, 0, 1),
      })
      proposalPointRef.current = nextPoint
      onProposalPreviewPoint(nextPoint)
      return
    }

    let nextProperties: VisualProperties | null = null
    let guides = current.guides
    if (current.mode === 'move') {
      let dx = point.x - current.startClient.x
      let dy = point.y - current.startClient.y
      if (event.shiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0
        else dx = 0
      }
      const snapped = snapCanvasRect({
        rect: { x: current.startRect.x + dx, y: current.startRect.y + dy, width: current.startRect.width, height: current.startRect.height },
        frame,
        thresholdPx: 6,
        disabled: event.altKey,
      })
      dx += snapped.deltaX
      dy += snapped.deltaY
      const transform = moveTransformByClientDelta(current.startProperties.transform, { x: dx, y: dy }, frame)
      nextProperties = transform ? propertiesWithTransform(current.startProperties, transform) : null
      guides = snapped.guides
    } else if (current.mode === 'resize' && current.resizeCorner) {
      nextProperties = resizeUniformFromCorner({
        properties: current.startProperties,
        startRect: current.startRect,
        corner: current.resizeCorner,
        currentClient: point,
        contentRect: frame,
        fromCenter: event.altKey,
      })
    } else if (current.mode === 'rotate') {
      const rotation = rotateFromClientPoint({
        startRotationDegrees: current.startProperties.transform.rotationDegrees,
        center: rectCenter(current.startRect),
        startClient: current.startClient,
        currentClient: point,
        snap15: event.shiftKey,
      })
      nextProperties = rotation === null ? null : propertiesWithTransform(current.startProperties, Object.freeze({
        ...current.startProperties.transform,
        rotationDegrees: rotation,
      }))
    } else if (current.mode === 'crop' && current.cropEdge) {
      const horizontal = current.cropEdge === 'left' || current.cropEdge === 'right'
      const delta = horizontal ? point.x - current.startClient.x : point.y - current.startClient.y
      const crop = cropFromClientDelta({
        crop: current.startProperties.crop,
        edge: current.cropEdge,
        deltaPx: delta,
        visualSizePx: horizontal ? current.startRect.width : current.startRect.height,
      })
      if (!crop) {
        draftController.reportNotice('The crop would remove the entire image.')
        return
      }
      nextProperties = Object.freeze({ ...current.startProperties, crop })
    }
    if (!nextProperties) return
    const next = updateCanvasInteraction(current, nextProperties, guides)
    draftController.update(nextProperties)
    updateSession(next)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = sessionRef.current
    if (!current || current.pointerId !== event.pointerId || !selected) return
    event.preventDefault()
    if (selected.state === 'proposed') {
      const point = proposalPointRef.current
      updateSession(null)
      onProposalPreviewPoint(null)
      if (point) onProposalPointCommit(point)
      return
    }
    if (current.mode === 'crop') {
      updateSession(null)
      return
    }
    void commitProperties(selected, current.currentProperties, current.mode)
  }

  const onPointerCancel = () => cancelInteraction()

  const handleKeyboard = async (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelInteraction()
      return
    }
    if (cropMode && event.key === 'Enter' && selected?.state === 'committed' && draftController.draft) {
      event.preventDefault()
      await commitProperties(selected, draftController.draft.value, 'crop')
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const layer = contentLayerRef.current
    if (!layer || !selected || selected.state !== 'committed' || busy || saving || narrow) return
    const conflict = canvasAnimatedPropertyConflict(selected, 'move')
    if (conflict) {
      draftController.reportNotice(conflict)
      onFocusInspector()
      return
    }
    if (!draftController.beginInteraction('move')) {
      onFocusInspector()
      return
    }
    const amount = event.shiftKey ? 10 : 1
    const delta = {
      x: event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0,
      y: event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0,
    }
    const base = draftController.draft?.value ?? selected.visualProperties
    const transform = moveTransformByClientDelta(base.transform, delta, { x: 0, y: 0, width: layer.clientWidth, height: layer.clientHeight })
    if (!transform) return
    const next = propertiesWithTransform(base, transform)
    onPausePlayback()
    draftController.update(next)
    await commitProperties(selected, next, 'move')
  }

  const doneCrop = () => {
    if (!selected || selected.state !== 'committed' || !draftController.draft) return
    void commitProperties(selected, draftController.draft.value, 'crop')
  }
  const resetCrop = () => {
    if (!draftController.draft) return
    draftController.update(Object.freeze({ ...draftController.draft.value, crop: draftController.draft.authoritative.crop }))
  }

  const selectedDisplay = selected && properties ? Object.freeze({ ...selected, visualProperties: properties }) : selected
  const modeLabel = selected?.state === 'proposed'
    ? 'Pending — preview only'
    : cropMode
      ? 'Crop preview — not saved'
      : session
        ? `${session.mode[0].toUpperCase()}${session.mode.slice(1)} preview — not saved`
        : 'Editing base transform'

  return (
    <div
      className="canvas-interaction-layer"
      data-testid="canvas-interaction-layer"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {targets
        .slice()
        .sort((left, right) => left.layer - right.layer || left.timelineItemId.localeCompare(right.timelineItemId))
        .map((target) => {
          const rect = rects.get(target.nodeId)
          if (!rect || target.timelineItemId === selected?.timelineItemId) return null
          return (
            <button
              key={`${target.timelineItemId}:${target.nodeId}`}
              type="button"
              className={`canvas-hit-target${target.state === 'proposed' ? ' canvas-hit-target--proposed' : ''}`}
              aria-label={`Select ${target.label} on canvas`}
              style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, zIndex: 20 + target.layer }}
              onClick={(event) => {
                event.stopPropagation()
                onSelectTimelineItem(target.timelineItemId)
              }}
            />
          )
        })}

      {safeAreas || session?.mode === 'move' || session?.mode === 'resize' ? (
        <div className="canvas-safe-areas" aria-hidden="true">
          <span className="canvas-safe-area canvas-safe-area--action" />
          <span className="canvas-safe-area canvas-safe-area--title" />
          <span className="canvas-safe-area__horizontal" />
          <span className="canvas-safe-area__vertical" />
        </div>
      ) : null}
      <CanvasAlignmentGuides guides={session?.guides ?? []} />

      {selectedDisplay && selectedRect && !narrow ? (
        <>
          <CanvasSelectionBox
            rect={selectedRect}
            selection={selectedDisplay}
            cropMode={cropMode}
            narrow={narrow}
            rotationDegrees={properties?.transform.rotationDegrees ?? 0}
            crop={properties?.crop ?? selectedDisplay.visualProperties.crop}
            onStartMove={(event) => startPointer('move', event)}
            onStartResize={(corner, event) => startPointer('resize', event, corner)}
            onStartRotate={(event) => startPointer('rotate', event)}
            onStartCrop={(edge, event) => startPointer('crop', event, null, edge)}
            onKeyDown={handleKeyboard}
          />
          <CanvasInteractionToolbar
            canCrop={selectedDisplay.state === 'committed' && selectedDisplay.supportsCrop}
            cropMode={cropMode}
            safeAreas={safeAreas}
            busy={busy || saving}
            modeLabel={modeLabel}
            onToggleCrop={() => cropMode ? cancelInteraction() : onCropModeChange(true)}
            onToggleSafeAreas={() => setSafeAreas((current) => !current)}
            onDoneCrop={doneCrop}
            onResetCrop={resetCrop}
            onCancel={cancelInteraction}
          />
        </>
      ) : null}

      {selectionResult.kind === 'unsupported' ? (
        <p className="canvas-interaction-message" role="status">{selectionResult.reason}</p>
      ) : null}
      {narrow && selected ? (
        <p className="canvas-interaction-message" role="status">Canvas handles are available on a wider screen. Use the Inspector for precise values.</p>
      ) : null}
      {selected && !selectedRect ? (
        <p className="canvas-interaction-message" role="status">The selected object is not visible at this playhead position.</p>
      ) : null}
      {draftController.draft?.notice ? (
        <p className="canvas-interaction-error" role="alert">{draftController.draft.notice}</p>
      ) : null}
    </div>
  )
}
