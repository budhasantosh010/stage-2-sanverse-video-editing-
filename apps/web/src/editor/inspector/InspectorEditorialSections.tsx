import { useState } from 'react'

import {
  CAPTION_STYLE_IDS,
  MAX_CLIP_GAIN_DB,
  MAX_MUSIC_GAIN_DB,
  MIN_CLIP_GAIN_DB,
  MIN_MUSIC_GAIN_DB,
  PROJECT_TIMESCALE,
  TITLE_PLACEMENTS,
  TITLE_STYLE_IDS,
  isVisualAsset,
  type EditOperation,
  type MediaAsset,
} from '@sanverse/edit-domain'

import type {
  InspectorCaptionSelection,
  InspectorCalloutSelection,
  InspectorDialogueSelection,
  InspectorMediaOverlaySelection,
  InspectorMusicSelection,
  InspectorNameplateSelection,
  InspectorTitleSelection,
  InspectorVideoClipSelection,
} from './inspector-contract'
import { createInspectorOperationId } from './inspector-operation-id'
import {
  buildCaptionCueOperation,
  buildCaptionStyleOperation,
  buildCalloutOperation,
  buildClipAudioOperation,
  buildClipEnabledOperation,
  buildClipTransitionOperation,
  buildMediaOverlayOperation,
  buildMusicOperation,
  buildTitleOperation,
  type InspectorOperationBuildResult,
} from './inspector-operations'
import { InspectorRow } from './InspectorRow'
import { InspectorSection } from './InspectorSection'
import { InspectorSectionActions } from './InspectorSectionActions'
import { useInspectorSectionDraft } from './useInspectorSectionDraft'

export type InspectorEditorCommonProps = Readonly<{
  busy: boolean
  onApply(operation: EditOperation): Promise<string | null>
  onDirtyChange(sectionId: string, dirty: boolean): void
}>

const seconds = (ticks: number): number => Number((ticks / PROJECT_TIMESCALE).toFixed(3))
const ticks = (value: number): number => Math.max(0, Math.round(value * PROJECT_TIMESCALE))

const selectionKey = (selection: { timelineItemId: string; projectRevision: number }) =>
  `${selection.timelineItemId}:${selection.projectRevision}`

function useApplyOperation(onApply: InspectorEditorCommonProps['onApply']) {
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (result: InspectorOperationBuildResult, markApplied: () => void) => {
    if (!result.ok) {
      setNotice(result.message)
      return
    }
    setWorking(true)
    setNotice(null)
    const failure = await onApply(result.operation)
    setWorking(false)
    if (failure) {
      setNotice(failure)
      return
    }
    markApplied()
    setNotice('Applied. Undo takes back only this change.')
  }

  return { working, notice, setNotice, submit }
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
}: Readonly<{
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange(value: number): void
}>) {
  return (
    <label className="inspector-field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  )
}

export function ClipEditorialSections({
  selection,
  busy,
  onApply,
  onDirtyChange,
}: InspectorEditorCommonProps & Readonly<{ selection: InspectorVideoClipSelection | InspectorDialogueSelection }>) {
  const enabled = useInspectorSectionDraft({
    sectionId: 'clip-enabled',
    selectionKey: selectionKey(selection),
    projectRevision: selection.projectRevision,
    authoritative: selection.clip.enabled,
    onDirtyChange,
  })
  const enabledApply = useApplyOperation(onApply)

  const audioAuthoritative = {
    gainDb: selection.clip.gainDb,
    fadeInTicks: selection.clip.fadeIn.ticks,
    fadeOutTicks: selection.clip.fadeOut.ticks,
  }
  const audio = useInspectorSectionDraft({
    sectionId: 'clip-audio',
    selectionKey: selectionKey(selection),
    projectRevision: selection.projectRevision,
    authoritative: audioAuthoritative,
    onDirtyChange,
  })
  const audioApply = useApplyOperation(onApply)

  const transitionAuthoritative = {
    style: selection.transition?.style ?? 'none' as const,
    durationTicks: selection.transition?.duration.ticks ?? 0,
    audio: selection.transition?.audio ?? 'cut' as const,
  }
  const transition = useInspectorSectionDraft({
    sectionId: 'clip-transition',
    selectionKey: selectionKey(selection),
    projectRevision: selection.projectRevision,
    authoritative: transitionAuthoritative,
    onDirtyChange,
  })
  const transitionApply = useApplyOperation(onApply)

  return (
    <>
      <InspectorSection title="Clip" defaultOpen>
        <label className="inspector-field inspector-field--checkbox">
          <input
            aria-label="Show this clip"
            type="checkbox"
            checked={enabled.draft.value}
            onChange={(event) => enabled.update(event.currentTarget.checked)}
          />
          <span>Show this clip</span>
        </label>
        <InspectorSectionActions
          dirty={enabled.draft.dirty}
          busy={busy}
          working={enabledApply.working}
          notice={enabledApply.notice}
          onReset={enabled.reset}
          onApply={() => void enabledApply.submit(
            buildClipEnabledOperation(selection, enabled.draft.value, createInspectorOperationId()),
            enabled.markApplied,
          )}
        />
      </InspectorSection>

      <InspectorSection title="Sound" defaultOpen>
        <NumberField
          label="Gain (dB)"
          value={audio.draft.value.gainDb}
          min={MIN_CLIP_GAIN_DB}
          max={MAX_CLIP_GAIN_DB}
          step={1}
          onChange={(gainDb) => audio.update({ ...audio.draft.value, gainDb })}
        />
        <NumberField
          label="Fade in (seconds)"
          value={seconds(audio.draft.value.fadeInTicks)}
          min={0}
          step={0.1}
          onChange={(value) => audio.update({ ...audio.draft.value, fadeInTicks: ticks(value) })}
        />
        <NumberField
          label="Fade out (seconds)"
          value={seconds(audio.draft.value.fadeOutTicks)}
          min={0}
          step={0.1}
          onChange={(value) => audio.update({ ...audio.draft.value, fadeOutTicks: ticks(value) })}
        />
        <InspectorSectionActions
          dirty={audio.draft.dirty}
          busy={busy}
          working={audioApply.working}
          notice={audioApply.notice}
          onReset={audio.reset}
          onApply={() => void audioApply.submit(
            buildClipAudioOperation(selection, audio.draft.value, createInspectorOperationId()),
            audio.markApplied,
          )}
        />
      </InspectorSection>

      <InspectorSection title="Transition">
        {selection.nextClipId ? (
          <>
            <label className="inspector-field">
              <span>Style</span>
              <select
                aria-label="Clip transition style"
                value={transition.draft.value.style}
                onChange={(event) => transition.update({
                  ...transition.draft.value,
                  style: event.currentTarget.value as 'none' | 'dip-to-black',
                })}
              >
                <option value="none">None</option>
                <option value="dip-to-black">Dip to black</option>
              </select>
            </label>
            {transition.draft.value.style !== 'none' ? (
              <>
                <NumberField
                  label="Transition length (seconds)"
                  value={seconds(transition.draft.value.durationTicks)}
                  min={0.05}
                  max={2}
                  step={0.05}
                  onChange={(value) => transition.update({ ...transition.draft.value, durationTicks: ticks(value) })}
                />
                <label className="inspector-field">
                  <span>Sound</span>
                  <select
                    aria-label="Transition sound"
                    value={transition.draft.value.audio}
                    onChange={(event) => transition.update({
                      ...transition.draft.value,
                      audio: event.currentTarget.value as 'cut' | 'fade-through-silence',
                    })}
                  >
                    <option value="cut">Cut</option>
                    <option value="fade-through-silence">Fade through silence</option>
                  </select>
                </label>
              </>
            ) : null}
            <InspectorSectionActions
              dirty={transition.draft.dirty}
              busy={busy}
              working={transitionApply.working}
              notice={transitionApply.notice}
              onReset={transition.reset}
              onApply={() => void transitionApply.submit(
                buildClipTransitionOperation(selection, transition.draft.value, createInspectorOperationId()),
                transition.markApplied,
              )}
            />
          </>
        ) : (
          <p className="inspector__guidance">This is the last clip, so it has no next clip to transition into.</p>
        )}
      </InspectorSection>

      <InspectorSection title="Picture controls">
        <p className="inspector__guidance">
          Position, scale, rotation, crop, opacity, masks, layers and effects are not targetable on source clips in the current project schema. No fake controls are shown.
        </p>
      </InspectorSection>
    </>
  )
}

export function CaptionEditorialSections({
  selection,
  busy,
  onApply,
  onDirtyChange,
}: InspectorEditorCommonProps & Readonly<{ selection: InspectorCaptionSelection }>) {
  const cueAuthoritative = {
    text: selection.cue.lines.join('\n'),
    startTicks: selection.cue.sourceInterval.start.ticks,
    endTicks: selection.cue.sourceInterval.start.ticks + selection.cue.sourceInterval.duration.ticks,
  }
  const cue = useInspectorSectionDraft({
    sectionId: 'caption-cue',
    selectionKey: selectionKey(selection),
    projectRevision: selection.projectRevision,
    authoritative: cueAuthoritative,
    onDirtyChange,
  })
  const cueApply = useApplyOperation(onApply)
  const style = useInspectorSectionDraft({
    sectionId: 'caption-style',
    selectionKey: selectionKey(selection),
    projectRevision: selection.projectRevision,
    authoritative: selection.captionSet.styleId,
    onDirtyChange,
  })
  const styleApply = useApplyOperation(onApply)

  return (
    <>
      <InspectorSection title="Caption" defaultOpen>
        <label className="inspector-field">
          <span>Text</span>
          <textarea
            aria-label="Caption text"
            rows={3}
            value={cue.draft.value.text}
            onChange={(event) => cue.update({ ...cue.draft.value, text: event.currentTarget.value })}
          />
        </label>
        <div className="inspector-field-grid">
          <NumberField
            label="Source start (seconds)"
            value={seconds(cue.draft.value.startTicks)}
            min={0}
            step={0.01}
            onChange={(value) => cue.update({ ...cue.draft.value, startTicks: ticks(value) })}
          />
          <NumberField
            label="Source end (seconds)"
            value={seconds(cue.draft.value.endTicks)}
            min={0}
            step={0.01}
            onChange={(value) => cue.update({ ...cue.draft.value, endTicks: ticks(value) })}
          />
        </div>
        <InspectorSectionActions
          dirty={cue.draft.dirty}
          busy={busy}
          working={cueApply.working}
          notice={cueApply.notice}
          onReset={cue.reset}
          onApply={() => void cueApply.submit(
            buildCaptionCueOperation(selection, {
              lines: cue.draft.value.text.split(/\r?\n/),
              startTicks: cue.draft.value.startTicks,
              endTicks: cue.draft.value.endTicks,
            }, createInspectorOperationId()),
            cue.markApplied,
          )}
        />
      </InspectorSection>
      <InspectorSection title="Caption style">
        <label className="inspector-field">
          <span>Look</span>
          <select
            aria-label="Caption style"
            value={style.draft.value}
            onChange={(event) => style.update(event.currentTarget.value as typeof style.draft.value)}
          >
            {CAPTION_STYLE_IDS.map((styleId) => (
              <option key={styleId} value={styleId}>{styleId.includes('boxed') ? 'Boxed' : 'Plain'}</option>
            ))}
          </select>
        </label>
        <p className="inspector__guidance">Placement, safe margins, grouping and line-width presets do not exist as separate accepted properties yet.</p>
        <InspectorSectionActions
          dirty={style.draft.dirty}
          busy={busy}
          working={styleApply.working}
          notice={styleApply.notice}
          onReset={style.reset}
          onApply={() => void styleApply.submit(
            buildCaptionStyleOperation(selection, style.draft.value, createInspectorOperationId()),
            style.markApplied,
          )}
        />
      </InspectorSection>
    </>
  )
}

export function NameplateEditorialSections({ selection }: Readonly<{ selection: InspectorNameplateSelection }>) {
  return (
    <InspectorSection title="Text" defaultOpen>
      <dl className="inspector__facts">
        <InspectorRow label="Name">{selection.operation.primaryText}</InspectorRow>
        <InspectorRow label="Role">{selection.operation.secondaryText || 'None'}</InspectorRow>
      </dl>
      <p className="inspector__guidance">
        Accepted nameplate text is read-only because the current engine has no set-nameplate operation. Visual properties below remain editable.
      </p>
    </InspectorSection>
  )
}

export function TitleEditorialSections({
  selection,
  busy,
  onApply,
  onDirtyChange,
}: InspectorEditorCommonProps & Readonly<{ selection: InspectorTitleSelection }>) {
  const authoritative = {
    headline: selection.operation.headline,
    subhead: selection.operation.subhead,
    placement: selection.operation.placement,
    styleId: selection.operation.styleId,
    startTicks: selection.operation.sourceInterval.start.ticks,
    endTicks: selection.operation.sourceInterval.start.ticks + selection.operation.sourceInterval.duration.ticks,
  }
  const draft = useInspectorSectionDraft({
    sectionId: 'title',
    selectionKey: selectionKey(selection),
    projectRevision: selection.projectRevision,
    authoritative,
    onDirtyChange,
  })
  const apply = useApplyOperation(onApply)

  return (
    <InspectorSection title="Title" defaultOpen>
      <label className="inspector-field"><span>Headline</span><input aria-label="Title headline" maxLength={60} value={draft.draft.value.headline} onChange={(event) => draft.update({ ...draft.draft.value, headline: event.currentTarget.value })} /></label>
      <label className="inspector-field"><span>Subtitle</span><input aria-label="Title subtitle" maxLength={90} value={draft.draft.value.subhead} onChange={(event) => draft.update({ ...draft.draft.value, subhead: event.currentTarget.value })} /></label>
      <div className="inspector-field-grid">
        <label className="inspector-field"><span>Placement</span><select aria-label="Title placement" value={draft.draft.value.placement} onChange={(event) => draft.update({ ...draft.draft.value, placement: event.currentTarget.value as typeof draft.draft.value.placement })}>{TITLE_PLACEMENTS.map((value) => <option key={value} value={value}>{value === 'lower-third' ? 'Lower third' : 'Center'}</option>)}</select></label>
        <label className="inspector-field"><span>Style</span><select aria-label="Title style" value={draft.draft.value.styleId} onChange={(event) => draft.update({ ...draft.draft.value, styleId: event.currentTarget.value as typeof draft.draft.value.styleId })}>{TITLE_STYLE_IDS.map((value) => <option key={value} value={value}>{value.includes('boxed') ? 'Boxed' : 'Plain'}</option>)}</select></label>
      </div>
      <div className="inspector-field-grid">
        <NumberField label="Source start (seconds)" value={seconds(draft.draft.value.startTicks)} min={0} step={0.01} onChange={(value) => draft.update({ ...draft.draft.value, startTicks: ticks(value) })} />
        <NumberField label="Source end (seconds)" value={seconds(draft.draft.value.endTicks)} min={0} step={0.01} onChange={(value) => draft.update({ ...draft.draft.value, endTicks: ticks(value) })} />
      </div>
      <p className="inspector__guidance">Typography and alignment are owned by the selected versioned style; separate font controls do not exist yet.</p>
      <InspectorSectionActions dirty={draft.draft.dirty} busy={busy} working={apply.working} notice={apply.notice} onReset={draft.reset} onApply={() => void apply.submit(buildTitleOperation(selection, draft.draft.value, createInspectorOperationId()), draft.markApplied)} />
    </InspectorSection>
  )
}

export function CalloutEditorialSections({
  selection,
  busy,
  onApply,
  onDirtyChange,
}: InspectorEditorCommonProps & Readonly<{ selection: InspectorCalloutSelection }>) {
  const authoritative = {
    label: selection.operation.label,
    styleId: selection.operation.styleId,
    region: selection.operation.region,
    startTicks: selection.operation.sourceInterval.start.ticks,
    endTicks: selection.operation.sourceInterval.start.ticks + selection.operation.sourceInterval.duration.ticks,
  }
  const draft = useInspectorSectionDraft({ sectionId: 'callout', selectionKey: selectionKey(selection), projectRevision: selection.projectRevision, authoritative, onDirtyChange })
  const apply = useApplyOperation(onApply)
  const updateRegion = (key: 'x' | 'y' | 'width' | 'height', value: number) => draft.update({ ...draft.draft.value, region: { ...draft.draft.value.region, [key]: value / 100 } })

  return (
    <InspectorSection title="Callout" defaultOpen>
      <label className="inspector-field"><span>Label</span><input aria-label="Callout label" maxLength={60} value={draft.draft.value.label} onChange={(event) => draft.update({ ...draft.draft.value, label: event.currentTarget.value })} /></label>
      <div className="inspector-field-grid inspector-field-grid--four">
        {(['x', 'y', 'width', 'height'] as const).map((key) => <NumberField key={key} label={`${key === 'x' ? 'Left' : key === 'y' ? 'Top' : key[0].toUpperCase() + key.slice(1)} (%)`} value={Number((draft.draft.value.region[key] * 100).toFixed(2))} min={key === 'width' || key === 'height' ? 1 : 0} max={100} step={1} onChange={(value) => updateRegion(key, value)} />)}
      </div>
      <div className="inspector-field-grid">
        <NumberField label="Source start (seconds)" value={seconds(draft.draft.value.startTicks)} min={0} step={0.01} onChange={(value) => draft.update({ ...draft.draft.value, startTicks: ticks(value) })} />
        <NumberField label="Source end (seconds)" value={seconds(draft.draft.value.endTicks)} min={0} step={0.01} onChange={(value) => draft.update({ ...draft.draft.value, endTicks: ticks(value) })} />
      </div>
      <InspectorSectionActions dirty={draft.draft.dirty} busy={busy} working={apply.working} notice={apply.notice} onReset={draft.reset} onApply={() => void apply.submit(buildCalloutOperation(selection, draft.draft.value, createInspectorOperationId()), draft.markApplied)} />
    </InspectorSection>
  )
}

export function MediaOverlayEditorialSections({
  selection,
  assets,
  busy,
  onApply,
  onDirtyChange,
}: InspectorEditorCommonProps & Readonly<{ selection: InspectorMediaOverlaySelection; assets: readonly MediaAsset[] }>) {
  const authoritative = {
    overlayAssetId: selection.operation.overlayAssetId,
    region: selection.operation.region,
    opacity: selection.operation.opacity,
    useOverlayAudio: selection.operation.useOverlayAudio,
    startTicks: selection.operation.sourceInterval.start.ticks,
    endTicks: selection.operation.sourceInterval.start.ticks + selection.operation.sourceInterval.duration.ticks,
    overlaySourceStartTicks: selection.operation.overlaySourceStart.ticks,
  }
  const draft = useInspectorSectionDraft({ sectionId: 'media-overlay', selectionKey: selectionKey(selection), projectRevision: selection.projectRevision, authoritative, onDirtyChange })
  const apply = useApplyOperation(onApply)
  const visualAssets = assets.filter(isVisualAsset).filter((asset) => asset.assetId !== selection.operation.assetId)
  const updateRegion = (key: 'x' | 'y' | 'width' | 'height', value: number) => draft.update({ ...draft.draft.value, region: { ...draft.draft.value.region, [key]: value / 100 } })

  return (
    <InspectorSection title="Overlay media" defaultOpen>
      <label className="inspector-field"><span>Asset</span><select aria-label="Overlay asset" value={draft.draft.value.overlayAssetId} onChange={(event) => draft.update({ ...draft.draft.value, overlayAssetId: event.currentTarget.value })}>{visualAssets.map((asset) => <option key={asset.assetId} value={asset.assetId}>{asset.assetId === selection.operation.overlayAssetId ? selection.assetLabel : asset.mediaKind === 'image' ? 'Image asset' : 'Video asset'}</option>)}</select></label>
      <div className="inspector-field-grid inspector-field-grid--four">{(['x', 'y', 'width', 'height'] as const).map((key) => <NumberField key={key} label={`${key === 'x' ? 'Left' : key === 'y' ? 'Top' : key[0].toUpperCase() + key.slice(1)} (%)`} value={Number((draft.draft.value.region[key] * 100).toFixed(2))} min={key === 'width' || key === 'height' ? 1 : 0} max={100} step={1} onChange={(value) => updateRegion(key, value)} />)}</div>
      <NumberField label="Overlay opacity (%)" value={Math.round(draft.draft.value.opacity * 100)} min={1} max={100} step={1} onChange={(value) => draft.update({ ...draft.draft.value, opacity: value / 100 })} />
      <label className="inspector-field inspector-field--checkbox"><input aria-label="Hear overlay audio" type="checkbox" checked={draft.draft.value.useOverlayAudio} onChange={(event) => draft.update({ ...draft.draft.value, useOverlayAudio: event.currentTarget.checked })} /><span>Hear overlay audio</span></label>
      <div className="inspector-field-grid">
        <NumberField label="Source start (seconds)" value={seconds(draft.draft.value.startTicks)} min={0} step={0.01} onChange={(value) => draft.update({ ...draft.draft.value, startTicks: ticks(value) })} />
        <NumberField label="Source end (seconds)" value={seconds(draft.draft.value.endTicks)} min={0} step={0.01} onChange={(value) => draft.update({ ...draft.draft.value, endTicks: ticks(value) })} />
        <NumberField label="Overlay media start (seconds)" value={seconds(draft.draft.value.overlaySourceStartTicks)} min={0} step={0.01} onChange={(value) => draft.update({ ...draft.draft.value, overlaySourceStartTicks: ticks(value) })} />
      </div>
      <InspectorSectionActions dirty={draft.draft.dirty} busy={busy} working={apply.working} notice={apply.notice} onReset={draft.reset} onApply={() => void apply.submit(buildMediaOverlayOperation(selection, draft.draft.value, createInspectorOperationId()), draft.markApplied)} />
    </InspectorSection>
  )
}

export function MusicEditorialSections({
  selection,
  busy,
  onApply,
  onDirtyChange,
}: InspectorEditorCommonProps & Readonly<{ selection: InspectorMusicSelection }>) {
  const authoritative = {
    compositionStartTicks: selection.operation.compositionStart.ticks,
    sourceStartTicks: selection.operation.sourceStart.ticks,
    gainDb: selection.operation.gainDb,
    fadeInTicks: selection.operation.fadeIn.ticks,
    fadeOutTicks: selection.operation.fadeOut.ticks,
    rememberedGainDb: selection.operation.gainDb > MIN_MUSIC_GAIN_DB ? selection.operation.gainDb : -18,
  }
  const draft = useInspectorSectionDraft({ sectionId: 'music', selectionKey: selectionKey(selection), projectRevision: selection.projectRevision, authoritative, onDirtyChange })
  const apply = useApplyOperation(onApply)
  const muted = draft.draft.value.gainDb === MIN_MUSIC_GAIN_DB

  return (
    <InspectorSection title="Music" defaultOpen>
      <div className="inspector-field-grid">
        <NumberField label="Video start (seconds)" value={seconds(draft.draft.value.compositionStartTicks)} min={0} step={0.01} onChange={(value) => draft.update({ ...draft.draft.value, compositionStartTicks: ticks(value) })} />
        <NumberField label="Song start (seconds)" value={seconds(draft.draft.value.sourceStartTicks)} min={0} step={0.01} onChange={(value) => draft.update({ ...draft.draft.value, sourceStartTicks: ticks(value) })} />
      </div>
      <NumberField label="Music gain (dB)" value={draft.draft.value.gainDb} min={MIN_MUSIC_GAIN_DB} max={MAX_MUSIC_GAIN_DB} step={1} onChange={(gainDb) => draft.update({ ...draft.draft.value, gainDb, rememberedGainDb: gainDb > MIN_MUSIC_GAIN_DB ? gainDb : draft.draft.value.rememberedGainDb })} />
      <label className="inspector-field inspector-field--checkbox"><input aria-label="Mute music" type="checkbox" checked={muted} onChange={(event) => draft.update({ ...draft.draft.value, gainDb: event.currentTarget.checked ? MIN_MUSIC_GAIN_DB : draft.draft.value.rememberedGainDb })} /><span>Mute music</span></label>
      <div className="inspector-field-grid">
        <NumberField label="Music fade in (seconds)" value={seconds(draft.draft.value.fadeInTicks)} min={0} step={0.1} onChange={(value) => draft.update({ ...draft.draft.value, fadeInTicks: ticks(value) })} />
        <NumberField label="Music fade out (seconds)" value={seconds(draft.draft.value.fadeOutTicks)} min={0} step={0.1} onChange={(value) => draft.update({ ...draft.draft.value, fadeOutTicks: ticks(value) })} />
      </div>
      <dl className="inspector__facts"><InspectorRow label="Current audible end">{seconds(selection.startTicks + selection.durationTicks)} seconds</InspectorRow></dl>
      <p className="inspector__guidance">The current music operation has no independent end field. Its end is derived from the remaining song and finished video.</p>
      <InspectorSectionActions dirty={draft.draft.dirty} busy={busy} working={apply.working} notice={apply.notice} onReset={draft.reset} onApply={() => void apply.submit(buildMusicOperation(selection, draft.draft.value, createInspectorOperationId()), draft.markApplied)} />
    </InspectorSection>
  )
}
