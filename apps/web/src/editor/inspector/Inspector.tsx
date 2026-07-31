import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EditOperation, MediaAsset } from '@sanverse/edit-domain'

import type { InspectorSelection } from './inspector-contract'
import {
  CalloutEditorialSections,
  CaptionEditorialSections,
  ClipEditorialSections,
  MediaOverlayEditorialSections,
  MusicEditorialSections,
  NameplateEditorialSections,
  TitleEditorialSections,
} from './InspectorEditorialSections'
import { InspectorEmptyState, InspectorGapState } from './InspectorEmptyState'
import { InspectorHeader } from './InspectorHeader'
import { InspectorRow } from './InspectorRow'
import { InspectorSection } from './InspectorSection'
import { InspectorBlockedState, InspectorProposalState } from './InspectorUnsupportedState'
import { InspectorVisualSections } from './InspectorVisualSections'
import './Inspector.css'

export type InspectorProps = Readonly<{
  selection: InspectorSelection
  assets: readonly MediaAsset[]
  busy: boolean
  proposalActionsBusy: boolean
  playheadTicks: number
  pendingSelectionChange: Readonly<{ nextLabel: string }> | null
  onDirtyChange(dirty: boolean): void
  onStaySelection(): void
  onDiscardSelection(): void
  onAcceptProposal(): void
  onRejectProposal(): void
  onOpenProposal(): void
  onSeek(ticks: number): void
  onApply(operation: EditOperation): Promise<string | null>
}>

const selectionKey = (selection: InspectorSelection): string =>
  selection.kind === 'nothing'
    ? `nothing:${selection.projectRevision}:${selection.reason}`
    : `${selection.timelineItemId}:${selection.projectRevision}`

const summaryType = (selection: Exclude<InspectorSelection, { kind: 'nothing' }>): string => {
  if (selection.kind === 'video') return 'Video clip'
  if (selection.kind === 'dialogue') return 'Dialogue linked to video'
  if (selection.kind === 'caption') return 'Caption cue'
  if (selection.kind === 'media-overlay') return 'Media overlay'
  if (selection.kind === 'nameplate') return 'Nameplate'
  if (selection.kind === 'proposal') return 'Pending proposal'
  if (selection.kind === 'blocked') return 'Blocked item'
  return selection.kind[0].toUpperCase() + selection.kind.slice(1)
}

function InspectorCommittedSummary({ selection }: {
  selection: Exclude<InspectorSelection, { kind: 'nothing' | 'gap' | 'blocked' | 'proposal' }>
}) {
  const assetLabel = 'assetLabel' in selection ? selection.assetLabel : null
  return (
    <InspectorSection title="Summary" defaultOpen>
      <dl className="inspector__facts">
        <InspectorRow label="Type">{summaryType(selection)}</InspectorRow>
        {assetLabel ? <InspectorRow label="Media">{assetLabel}</InspectorRow> : null}
        <InspectorRow label="Start">{selection.startTicks} ticks</InspectorRow>
        <InspectorRow label="Duration">{selection.durationTicks} ticks</InspectorRow>
        <InspectorRow label="State">Current project revision {selection.projectRevision}</InspectorRow>
      </dl>
    </InspectorSection>
  )
}

function InspectorCommittedContent({
  selection,
  assets,
  busy,
  playheadTicks,
  onSeek,
  onApply,
  onSectionDirty,
}: Readonly<{
  selection: Exclude<InspectorSelection, { kind: 'nothing' | 'gap' | 'blocked' | 'proposal' }>
  assets: readonly MediaAsset[]
  busy: boolean
  playheadTicks: number
  onSeek(ticks: number): void
  onApply(operation: EditOperation): Promise<string | null>
  onSectionDirty(sectionId: string, dirty: boolean): void
}>) {
  const common = { busy, onApply, onDirtyChange: onSectionDirty }
  return (
    <>
      <InspectorCommittedSummary selection={selection} />
      {selection.kind === 'video' || selection.kind === 'dialogue' ? (
        <ClipEditorialSections {...common} selection={selection} />
      ) : null}
      {selection.kind === 'caption' ? (
        <>
          <CaptionEditorialSections {...common} selection={selection} />
          <InspectorVisualSections {...common} selection={selection} playheadTicks={playheadTicks} onSeek={onSeek} />
        </>
      ) : null}
      {selection.kind === 'nameplate' ? (
        <>
          <NameplateEditorialSections selection={selection} />
          <InspectorVisualSections {...common} selection={selection} playheadTicks={playheadTicks} onSeek={onSeek} />
        </>
      ) : null}
      {selection.kind === 'title' ? (
        <>
          <TitleEditorialSections {...common} selection={selection} />
          <InspectorVisualSections {...common} selection={selection} playheadTicks={playheadTicks} onSeek={onSeek} />
        </>
      ) : null}
      {selection.kind === 'callout' ? (
        <>
          <CalloutEditorialSections {...common} selection={selection} />
          <InspectorVisualSections {...common} selection={selection} playheadTicks={playheadTicks} onSeek={onSeek} />
        </>
      ) : null}
      {selection.kind === 'media-overlay' ? (
        <>
          <MediaOverlayEditorialSections {...common} selection={selection} assets={assets} />
          <InspectorVisualSections {...common} selection={selection} playheadTicks={playheadTicks} onSeek={onSeek} />
        </>
      ) : null}
      {selection.kind === 'music' ? <MusicEditorialSections {...common} selection={selection} /> : null}
    </>
  )
}

export function Inspector({
  selection,
  assets,
  busy,
  proposalActionsBusy,
  playheadTicks,
  pendingSelectionChange,
  onDirtyChange,
  onStaySelection,
  onDiscardSelection,
  onAcceptProposal,
  onRejectProposal,
  onOpenProposal,
  onSeek,
  onApply,
}: InspectorProps) {
  const [dirtySections, setDirtySections] = useState<ReadonlySet<string>>(() => new Set())
  const key = selectionKey(selection)

  useEffect(() => {
    setDirtySections(new Set())
  }, [key])

  useEffect(() => {
    onDirtyChange(dirtySections.size > 0)
  }, [dirtySections, onDirtyChange])

  const reportSectionDirty = useCallback((sectionId: string, dirty: boolean) => {
    setDirtySections((current) => {
      const next = new Set(current)
      if (dirty) next.add(sectionId)
      else next.delete(sectionId)
      if (next.size === current.size && [...next].every((item) => current.has(item))) return current
      return next
    })
  }, [])

  const content = useMemo(() => {
    if (selection.kind === 'nothing') return <InspectorEmptyState selection={selection} />
    if (selection.kind === 'gap') return <InspectorGapState selection={selection} />
    if (selection.kind === 'blocked') return <InspectorBlockedState selection={selection} />
    if (selection.kind === 'proposal') {
      return (
        <InspectorProposalState
          selection={selection}
          busy={proposalActionsBusy}
          onAccept={onAcceptProposal}
          onReject={onRejectProposal}
          onOpen={onOpenProposal}
        />
      )
    }
    return (
      <InspectorCommittedContent
        selection={selection}
        assets={assets}
        busy={busy}
        playheadTicks={playheadTicks}
        onSeek={onSeek}
        onApply={onApply}
        onSectionDirty={reportSectionDirty}
      />
    )
  }, [assets, busy, onApply, onAcceptProposal, onOpenProposal, onRejectProposal, onSeek, playheadTicks, proposalActionsBusy, reportSectionDirty, selection])

  return (
    <div className="inspector" data-inspector-selection={key}>
      <InspectorHeader selection={selection} />
      {pendingSelectionChange ? (
        <div
          className="inspector__discard-confirmation"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="inspector-discard-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onStaySelection()
            }
          }}
        >
          <strong id="inspector-discard-title">Discard unapplied changes?</strong>
          <p>Continue to {pendingSelectionChange.nextLabel} and lose this local draft?</p>
          <div className="inspector__actions">
            <button type="button" onClick={onStaySelection}>Stay</button>
            <button type="button" onClick={onDiscardSelection}>Discard and continue</button>
          </div>
        </div>
      ) : null}
      <div className="inspector__body">{content}</div>
    </div>
  )
}
