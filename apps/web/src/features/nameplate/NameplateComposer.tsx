import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_NAMEPLATE_ANCHOR,
  NAMEPLATE_COMPONENT_ID,
  mediaTimeFromMilliseconds,
  validateOperation,
  type AddNameplateOperation,
} from '@sanverse/edit-domain'

import {
  formatPointTargetTime,
  type CapturedPointTarget,
} from '../point-target/point-target'
import './NameplateComposer.css'

export type NameplateComposerProps = {
  target: CapturedPointTarget | null
  /** The clip this nameplate attaches to, so it survives later cuts. */
  clipId: string
  createOperationId(): string
  onProposal(proposal: AddNameplateOperation): void
}

const PRIMARY_ERROR_ID = 'nameplate-primary-error'
const DEFAULT_VISIBLE_MS = 5_000

export function NameplateComposer({
  target,
  clipId,
  createOperationId,
  onProposal,
}: NameplateComposerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [primaryText, setPrimaryText] = useState('')
  const [secondaryText, setSecondaryText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const primaryRef = useRef<HTMLInputElement>(null)
  const targetIdentity = target ? `${target.x}:${target.y}:${target.timeMs}` : 'no-target'
  const previousTargetIdentityRef = useRef(targetIdentity)

  useEffect(() => {
    if (isOpen) primaryRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (previousTargetIdentityRef.current === targetIdentity) return
    previousTargetIdentityRef.current = targetIdentity
    if (!isOpen) return

    setIsOpen(false)
    setPrimaryText('')
    setSecondaryText('')
    setError(null)
    queueMicrotask(() => addButtonRef.current?.focus())
  }, [isOpen, targetIdentity])

  function closeComposer(returnFocus = true) {
    setIsOpen(false)
    setPrimaryText('')
    setSecondaryText('')
    setError(null)
    if (returnFocus) queueMicrotask(() => addButtonRef.current?.focus())
  }

  function submitProposal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!target) return

    const primary = primaryText.trim()
    if (!primary) {
      setError('Main text is required.')
      primaryRef.current?.focus()
      return
    }

    let operationId: string
    try {
      operationId = createOperationId()
    } catch {
      setError('We could not create this proposal. Try again.')
      primaryRef.current?.focus()
      return
    }

    const sampledClipTime = mediaTimeFromMilliseconds(target.timeMs)
    const start = mediaTimeFromMilliseconds(target.timeMs)
    const duration = mediaTimeFromMilliseconds(DEFAULT_VISIBLE_MS)
    if (!sampledClipTime.ok || !start.ok || !duration.ok) {
      setError('We could not create this proposal. Try again.')
      primaryRef.current?.focus()
      return
    }

    const result = validateOperation({
      schemaVersion: 'sanverse.operation/v2',
      operationId,
      kind: 'add-nameplate',
      capabilityId: NAMEPLATE_COMPONENT_ID,
      clipId,
      // Evidence: where the user was pointing, on this clip's own timeline.
      sampledClipTime: sampledClipTime.value,
      // Instruction: when it is on screen, in finished-video time.
      compositionInterval: { start: start.value, duration: duration.value },
      target: {
        coordinateSpace: 'composition-normalized',
        point: { x: target.x, y: target.y },
        anchor: DEFAULT_NAMEPLATE_ANCHOR,
      },
      primaryText: primary,
      secondaryText: secondaryText.trim(),
      extensions: {},
    })

    if (!result.ok) {
      setError('We could not create this proposal. Try again.')
      primaryRef.current?.focus()
      return
    }

    onProposal(result.value)
    closeComposer(false)
  }

  return (
    <div className="nameplate-composer">
      <button
        ref={addButtonRef}
        className="nameplate-composer__open"
        type="button"
        disabled={!target}
        onClick={() => {
          setError(null)
          setIsOpen(true)
        }}
      >
        Add text here
      </button>

      {isOpen && target ? (
        <section
          className="nameplate-composer__sheet"
          role="dialog"
          aria-labelledby="nameplate-composer-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              closeComposer()
            }
          }}
        >
          <div className="nameplate-composer__heading">
            <div>
              <span className="nameplate-composer__eyebrow">Add text</span>
              <h2 id="nameplate-composer-title">Create nameplate</h2>
            </div>
            <span>Here · {formatPointTargetTime(target.timeMs)}</span>
          </div>

          <form onSubmit={submitProposal} noValidate>
            <label htmlFor="nameplate-primary">Main text</label>
            <input
              ref={primaryRef}
              id="nameplate-primary"
              value={primaryText}
              onChange={(event) => {
                setPrimaryText(event.target.value)
                if (error) setError(null)
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? PRIMARY_ERROR_ID : undefined}
            />

            <label htmlFor="nameplate-secondary">Smaller line (optional)</label>
            <input
              id="nameplate-secondary"
              value={secondaryText}
              onChange={(event) => setSecondaryText(event.target.value)}
            />

            <div className="nameplate-composer__timing" aria-label="Nameplate timing">
              <span>Starts here · {formatPointTargetTime(target.timeMs)}</span>
              <span>Visible for · 5 seconds</span>
            </div>

            {error ? (
              <p id={PRIMARY_ERROR_ID} className="nameplate-composer__error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="nameplate-composer__actions">
              <button type="button" onClick={() => closeComposer()}>Cancel</button>
              <button type="submit">Create proposal</button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  )
}
