import type { VisualEffect, VisualProperties } from '@sanverse/edit-domain'

import type { InspectorSelection } from '../inspector'
import type { SharedVisualDraftController } from '../canvas'
import type { StudioWorkspace } from './workspace-contract'

const visualSelection = (selection: InspectorSelection): boolean =>
  ['caption', 'nameplate', 'title', 'callout', 'media-overlay'].includes(selection.kind)

const effectDefault = (kind: VisualEffect['kind']): number => kind === 'contrast' || kind === 'saturation' ? 1 : 0

const withEffect = (properties: VisualProperties, kind: VisualEffect['kind'], amount: number): VisualProperties => {
  const remaining = properties.effects.filter((effect) => effect.kind !== kind)
  return Object.freeze({
    ...properties,
    effects: Object.freeze(amount === effectDefault(kind)
      ? remaining
      : [...remaining, Object.freeze({ kind, amount }) as VisualEffect]),
  })
}

const applyVisualPreset = (
  controller: SharedVisualDraftController,
  patch: (properties: VisualProperties) => VisualProperties,
) => {
  if (!controller.draft) return
  controller.update(patch(controller.draft.value))
}

export function StudioWorkspacePanel({
  workspace,
  selection,
  visualDraftController,
}: Readonly<{
  workspace: StudioWorkspace
  selection: InspectorSelection
  visualDraftController: SharedVisualDraftController
}>) {
  if (workspace === 'edit' || workspace === 'creative') return null

  if (workspace === 'audio') {
    const supported = selection.kind === 'video' || selection.kind === 'dialogue' || selection.kind === 'music'
    return (
      <section className="studio-workspace-panel" aria-labelledby="audio-workspace-heading">
        <h2 id="audio-workspace-heading">Audio tools</h2>
        {supported ? (
          <>
            <strong>{selection.label}</strong>
            <p>Use Audio controls in the Tool dock for gain, fades and enabled state.</p>
            <dl><div><dt>Source</dt><dd>{selection.assetLabel}</dd></div><div><dt>Timing</dt><dd>{Math.round(selection.durationTicks / 1_440_000)}s</dd></div></dl>
          </>
        ) : <p>Select V1, A1 or A2 to edit current audio controls.</p>}
        <p className="studio-workspace-panel__truth">Waveforms, EQ, compression, mixing and noise cleanup are not part of this milestone.</p>
      </section>
    )
  }

  const supported = visualSelection(selection) && visualDraftController.draft !== null
  if (workspace === 'effects') {
    return (
      <section className="studio-workspace-panel" aria-labelledby="effects-workspace-heading">
        <h2 id="effects-workspace-heading">Effects browser</h2>
        <p className="studio-workspace-panel__categories">All · Motion · Transform · Look · Mask · Transition</p>
        {supported ? <div className="studio-workspace-panel__cards">
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => withEffect(value, 'blur', 0.04))}>Blur</button>
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => withEffect(value, 'brightness', 0.12))}>Brightness</button>
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => withEffect(value, 'contrast', 1.2))}>Contrast</button>
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => withEffect(value, 'saturation', 1.25))}>Saturation</button>
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => withEffect(value, 'grayscale', 1))}>Grayscale</button>
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => Object.freeze({ ...value, mask: Object.freeze({ shape: 'rectangle', feather: 0.05 }) }))}>Rectangle mask</button>
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => Object.freeze({ ...value, mask: Object.freeze({ shape: 'ellipse', feather: 0.05 }) }))}>Ellipse mask</button>
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => Object.freeze({ ...value, transition: Object.freeze({ ...value.transition, enter: Object.freeze({ ...value.transition.enter, kind: 'fade', duration: Object.freeze({ ticks: 720_000, timescale: 1_440_000 }) }) }) }))}>Fade</button>
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => Object.freeze({ ...value, transition: Object.freeze({ ...value.transition, enter: Object.freeze({ ...value.transition.enter, kind: 'slide-left', duration: Object.freeze({ ticks: 720_000, timescale: 1_440_000 }) }) }) }))}>Slide</button>
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => Object.freeze({ ...value, transition: Object.freeze({ ...value.transition, enter: Object.freeze({ ...value.transition.enter, kind: 'zoom', duration: Object.freeze({ ticks: 720_000, timescale: 1_440_000 }) }) }) }))}>Zoom transition</button>
        </div> : <p>This item does not support visual effects yet.</p>}
        <p className="studio-workspace-panel__truth">Choosing an effect changes the existing local visual draft. Apply it once from Tool.</p>
      </section>
    )
  }

  return (
    <section className="studio-workspace-panel" aria-labelledby="color-workspace-heading">
      <h2 id="color-workspace-heading">Color tools</h2>
      {selection.kind === 'video' ? <p>Primary-video color controls are coming in the Creator Color milestone.</p> : supported ? (
        <div className="studio-workspace-panel__cards">
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => withEffect(withEffect(value, 'brightness', 0.08), 'saturation', 1.08))}>Clean lift</button>
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => withEffect(value, 'contrast', 1.18))}>Contrast</button>
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => withEffect(value, 'saturation', 1.3))}>Vivid</button>
          <button type="button" onClick={() => applyVisualPreset(visualDraftController, (value) => withEffect(value, 'grayscale', 1))}>Monochrome</button>
          <button type="button" onClick={() => visualDraftController.reset()}>Reset</button>
        </div>
      ) : <p>Color adjustment is not available for this item yet.</p>}
      <p className="studio-workspace-panel__truth">Scopes, LUTs, curves, HSL and color wheels are not implemented.</p>
    </section>
  )
}
