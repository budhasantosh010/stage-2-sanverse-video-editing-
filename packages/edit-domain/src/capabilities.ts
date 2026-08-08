/**
 * What the system can be asked to do.
 *
 * Three levels exist so the AI can choose from a short, reliable list while
 * users still get the expressive power of the deep list underneath. A workflow
 * expands deterministically into components, and a component into primitives.
 * The AI never names a primitive directly, and never invents a capability.
 */
export type CapabilityLevel = 'primitive' | 'component' | 'workflow'

export type CapabilityDescriptor = Readonly<{
  capabilityId: string
  version: number
  level: CapabilityLevel
  /** Human-readable statement of what this capability accepts. */
  accepts: string
  /** Operation kinds this capability may produce. */
  produces: readonly string[]
  /** Capability IDs this one expands into. Empty for primitives. */
  requires: readonly string[]
}>

export const NAMEPLATE_PRIMITIVE_ID = 'sanverse.nameplate.primitive/v1'
export const NAMEPLATE_COMPONENT_ID = 'sanverse.nameplate.component/v1'

export const SPLIT_PRIMITIVE_ID = 'sanverse.timeline.split.primitive/v1'
export const TRIM_PRIMITIVE_ID = 'sanverse.timeline.trim.primitive/v1'
export const REMOVE_PRIMITIVE_ID = 'sanverse.timeline.remove.primitive/v1'
export const REORDER_PRIMITIVE_ID = 'sanverse.timeline.reorder.primitive/v1'
/** "Put this recording into the main sequence." */
export const PLACE_PRIMARY_CLIP_PRIMITIVE_ID = 'sanverse.timeline.place-primary.primitive/v1'
export const MOVE_PRIMARY_CLIP_PRIMITIVE_ID = 'sanverse.timeline.move-primary.primitive/v1'
export const CLIP_ENABLED_PRIMITIVE_ID = 'sanverse.timeline.enabled.primitive/v1'
export const CLIP_AUDIO_PRIMITIVE_ID = 'sanverse.timeline.audio.primitive/v1'
export const LINKED_AUDIO_PRIMITIVE_ID = 'sanverse.timeline.linked-audio.primitive/v1'
export const FREEZE_FRAME_PRIMITIVE_ID = 'sanverse.timeline.freeze-frame.primitive/v1'
export const CLIP_TRANSITION_PRIMITIVE_ID = 'sanverse.timeline.transition.primitive/v1'
/** One atomic full-state timing answer for professional precision edits. */
export const PRECISION_TIMING_PRIMITIVE_ID = 'sanverse.timeline.precision-timing.primitive/v1'

export const CAPTIONS_PRIMITIVE_ID = 'sanverse.captions.add.primitive/v1'
export const CAPTION_CUE_PRIMITIVE_ID = 'sanverse.captions.cue.primitive/v1'
export const CAPTION_STYLE_PRIMITIVE_ID = 'sanverse.captions.style.primitive/v1'
/** "Put captions on my video." */
export const CAPTIONS_COMPONENT_ID = 'sanverse.captions.component/v1'

export const TITLE_PRIMITIVE_ID = 'sanverse.title.primitive/v1'
export const CALLOUT_PRIMITIVE_ID = 'sanverse.callout.primitive/v1'
export const MEDIA_OVERLAY_PRIMITIVE_ID = 'sanverse.broll.primitive/v1'
export const MUSIC_PRIMITIVE_ID = 'sanverse.music.primitive/v1'
export const OVERLAY_REMOVE_PRIMITIVE_ID = 'sanverse.overlay.remove.primitive/v1'
/** Which lanes are heard and seen in the finished video. */
export const TRACK_OUTPUT_PRIMITIVE_ID = 'sanverse.timeline.track-output.primitive/v1'
/**
 * The user's own notes pinned to moments, and "treat these as one thing".
 *
 * Both are the user's work, so both are accepted, undoable operations. Neither
 * appears in the render plan, so neither changes one frame of the exported
 * video. See the long note at the top of `timeline-markers.ts`.
 */
export const TIMELINE_MARKERS_PRIMITIVE_ID = 'sanverse.timeline.markers.primitive/v1'
export const TIMELINE_GROUPS_PRIMITIVE_ID = 'sanverse.timeline.groups.primitive/v1'
export const VISUAL_PROPERTIES_PRIMITIVE_ID = 'sanverse.visual.properties.primitive/v1'
export const FOOTAGE_MOTION_PRIMITIVE_ID = 'sanverse.footage.motion.primitive/v1'

/** "Put a title on it." */
export const TITLE_COMPONENT_ID = 'sanverse.title.component/v1'
/** "Point at this bit." */
export const CALLOUT_COMPONENT_ID = 'sanverse.callout.component/v1'
/** "Show this clip while I talk about it." */
export const MEDIA_OVERLAY_COMPONENT_ID = 'sanverse.broll.component/v1'
/** "Put music under it." */
export const MUSIC_COMPONENT_ID = 'sanverse.music.component/v1'

/** "Take out the part between these two moments and close the gap." */
export const REMOVE_RANGE_COMPONENT_ID = 'sanverse.timeline.remove-range.component/v1'
/** "Make this stretch quieter, or fade it." */
export const AUDIO_LEVEL_COMPONENT_ID = 'sanverse.timeline.audio-level.component/v1'
export const CLIP_TRANSITION_COMPONENT_ID = 'sanverse.timeline.transition.component/v1'
/** "Play this bit faster, slower, or backwards." */
export const CLIP_TIME_TRANSFORM_PRIMITIVE_ID = 'sanverse.timeline.time-transform.primitive/v1'
export const CLIP_SPEED_COMPONENT_ID = 'sanverse.timeline.speed.component/v1'

/**
 * G4-A registers only what already exists. Workflow-level capabilities begin
 * in G4-B, when the AI first proposes an edit.
 */
export const CAPABILITY_REGISTRY: readonly CapabilityDescriptor[] = Object.freeze([
  Object.freeze({
    capabilityId: NAMEPLATE_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One clip, one composition interval, one anchored point, and two lines of text.',
    produces: Object.freeze(['add-nameplate']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: NAMEPLATE_COMPONENT_ID,
    version: 1,
    level: 'component' as const,
    accepts: 'A person\'s name and role, shown at a point the user indicated.',
    produces: Object.freeze(['add-nameplate']),
    requires: Object.freeze([NAMEPLATE_PRIMITIVE_ID]),
  }),
  Object.freeze({
    capabilityId: SPLIT_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One piece of footage and one moment inside it to cut at.',
    produces: Object.freeze(['split-clip']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: TRIM_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One piece of footage, and how much to shorten it by at each end.',
    produces: Object.freeze(['trim-clip']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: REMOVE_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One piece of footage to take out, and whether to close the gap.',
    produces: Object.freeze(['remove-clip']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: REORDER_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One piece of footage and the position it should take in the running order.',
    produces: Object.freeze(['reorder-clip']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: PLACE_PRIMARY_CLIP_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One recording, the stretch of it to use, and where it goes in the finished video.',
    produces: Object.freeze(['place-primary-clip']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: MOVE_PRIMARY_CLIP_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One piece of the main sequence and the moment it should start at.',
    produces: Object.freeze(['move-primary-clip']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: CLIP_ENABLED_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One piece of footage to hide or bring back.',
    produces: Object.freeze(['set-clip-enabled']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: CLIP_AUDIO_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One piece of footage, a loudness change, and ramps at each end.',
    produces: Object.freeze(['set-clip-audio']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: LINKED_AUDIO_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One picture clip and the complete source/composition window for its still-linked sound.',
    produces: Object.freeze(['set-linked-audio-window']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: FREEZE_FRAME_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One interior moment of footage, a bounded hold duration, and deterministic clip identifiers.',
    produces: Object.freeze(['insert-freeze-frame']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: CAPTIONS_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One piece of footage, a look, and a list of lines each with its own moment.',
    produces: Object.freeze(['add-captions']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: CAPTION_CUE_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One caption line to reword, retime, or delete.',
    produces: Object.freeze(['set-caption-cue', 'remove-caption-cue']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: CAPTION_STYLE_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One set of captions and the look they should all take.',
    produces: Object.freeze(['set-caption-style']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: CAPTIONS_COMPONENT_ID,
    version: 1,
    level: 'component' as const,
    accepts: 'Captions for what is spoken, cut into readable lines automatically.',
    produces: Object.freeze(['add-captions']),
    requires: Object.freeze([CAPTIONS_PRIMITIVE_ID]),
  }),
  Object.freeze({
    capabilityId: TITLE_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One piece of footage, a moment on it, up to two lines of words, and where they sit.',
    produces: Object.freeze(['add-title', 'set-title']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: CALLOUT_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One piece of footage, a moment on it, a rectangle on the picture, and an optional label.',
    produces: Object.freeze(['add-callout', 'set-callout']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: MEDIA_OVERLAY_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'A second video or a picture, the moment of footage it covers, and the box it is drawn in.',
    produces: Object.freeze(['add-media-overlay', 'set-media-overlay']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: MUSIC_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One piece of music, when it starts on the finished video, how loud, and its ramps.',
    produces: Object.freeze(['add-music', 'set-music']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: CLIP_TRANSITION_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'Two adjacent clips, a bounded transition duration, and explicit audio behavior.',
    produces: Object.freeze(['set-clip-transition']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: PRECISION_TIMING_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One primary edit and the complete source/composition timing state for every affected clip.',
    produces: Object.freeze(['set-primary-clip-timings']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: OVERLAY_REMOVE_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One title, callout, piece of B-roll, or music bed to take off the video.',
    produces: Object.freeze(['remove-overlay']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: TRACK_OUTPUT_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One of the five tracks, and whether it reaches the finished video.',
    produces: Object.freeze(['set-track-output']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: TIMELINE_MARKERS_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'The complete set of the user\'s markers, each a moment or a stretch with a label, a note and a colour.',
    produces: Object.freeze(['set-timeline-markers']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: TIMELINE_GROUPS_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'The complete set of groups, each naming two or more things on the timeline that move together.',
    produces: Object.freeze(['set-timeline-groups']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: VISUAL_PROPERTIES_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One existing visual, its transform, crop, layer, mask, and bounded property tracks.',
    produces: Object.freeze(['set-visual-properties']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: FOOTAGE_MOTION_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts: 'One source-anchored interval of primary video and one complete bounded transform, crop, and keyframe state.',
    produces: Object.freeze(['set-footage-motion']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: TITLE_COMPONENT_ID,
    version: 1,
    level: 'component' as const,
    accepts: 'A title, and roughly where in the video it belongs.',
    produces: Object.freeze(['add-title']),
    requires: Object.freeze([TITLE_PRIMITIVE_ID]),
  }),
  Object.freeze({
    capabilityId: CALLOUT_COMPONENT_ID,
    version: 1,
    level: 'component' as const,
    accepts: 'A part of the picture to draw attention to, and what to call it.',
    produces: Object.freeze(['add-callout']),
    requires: Object.freeze([CALLOUT_PRIMITIVE_ID]),
  }),
  Object.freeze({
    capabilityId: MEDIA_OVERLAY_COMPONENT_ID,
    version: 1,
    level: 'component' as const,
    accepts: 'Another clip or picture to show while a stretch of the talking plays.',
    produces: Object.freeze(['add-media-overlay']),
    requires: Object.freeze([MEDIA_OVERLAY_PRIMITIVE_ID]),
  }),
  Object.freeze({
    capabilityId: MUSIC_COMPONENT_ID,
    version: 1,
    level: 'component' as const,
    accepts: 'Background music under the finished video, quiet enough to talk over.',
    produces: Object.freeze(['add-music']),
    requires: Object.freeze([MUSIC_PRIMITIVE_ID]),
  }),
  Object.freeze({
    capabilityId: REMOVE_RANGE_COMPONENT_ID,
    version: 1,
    level: 'component' as const,
    accepts: 'Two moments in the finished video, and whether to close the gap left behind.',
    // Taking out a stretch in the middle of a piece is two cuts and a removal,
    // so this component names all three primitives it expands into.
    produces: Object.freeze(['split-clip', 'remove-clip']),
    requires: Object.freeze([SPLIT_PRIMITIVE_ID, REMOVE_PRIMITIVE_ID]),
  }),
  Object.freeze({
    capabilityId: AUDIO_LEVEL_COMPONENT_ID,
    version: 1,
    level: 'component' as const,
    accepts: 'A stretch of the video and how much quieter or louder it should be.',
    produces: Object.freeze(['set-clip-audio']),
    requires: Object.freeze([CLIP_AUDIO_PRIMITIVE_ID]),
  }),
  Object.freeze({
    capabilityId: CLIP_TRANSITION_COMPONENT_ID,
    version: 1,
    level: 'component' as const,
    accepts: 'A smooth dip between two adjacent pieces, with an explicit sound fade policy.',
    produces: Object.freeze(['set-clip-transition']),
    requires: Object.freeze([CLIP_TRANSITION_PRIMITIVE_ID]),
  }),
  Object.freeze({
    capabilityId: CLIP_TIME_TRANSFORM_PRIMITIVE_ID,
    version: 1,
    level: 'primitive' as const,
    accepts:
      'One piece of footage, a speed written as a fraction, whether it runs backwards, ' +
      'whether voices keep their pitch, and whether later pieces slide along.',
    produces: Object.freeze(['set-clip-time-transform']),
    requires: Object.freeze([]),
  }),
  Object.freeze({
    capabilityId: CLIP_SPEED_COMPONENT_ID,
    version: 1,
    level: 'component' as const,
    accepts: 'A piece of the video and how much faster or slower it should play.',
    produces: Object.freeze(['set-clip-time-transform']),
    requires: Object.freeze([CLIP_TIME_TRANSFORM_PRIMITIVE_ID]),
  }),
])

export const findCapability = (capabilityId: string): CapabilityDescriptor | undefined =>
  CAPABILITY_REGISTRY.find((capability) => capability.capabilityId === capabilityId)

/**
 * True only when this capability is allowed to emit this operation kind.
 * An operation naming a capability that cannot produce it is rejected, so a
 * mislabelled proposal cannot smuggle an unrelated edit through review.
 */
export const capabilityProduces = (capabilityId: string, operationKind: string): boolean => {
  const capability = findCapability(capabilityId)
  return capability !== undefined && capability.produces.includes(operationKind)
}

/** Expand a capability to the primitives it ultimately relies on. */
export const expandCapability = (capabilityId: string): readonly string[] => {
  const capability = findCapability(capabilityId)
  if (!capability) return []
  if (capability.requires.length === 0) return [capability.capabilityId]
  const expanded = new Set<string>()
  const visit = (id: string, depth: number) => {
    if (depth > 8 || expanded.has(id)) return
    const found = findCapability(id)
    if (!found) return
    if (found.requires.length === 0) {
      expanded.add(found.capabilityId)
      return
    }
    for (const required of found.requires) visit(required, depth + 1)
  }
  visit(capabilityId, 0)
  return Object.freeze([...expanded])
}
