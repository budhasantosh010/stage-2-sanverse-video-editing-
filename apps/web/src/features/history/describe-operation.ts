import { toMilliseconds, type EditOperation } from '@sanverse/edit-domain'
import { formatPlaybackRate } from '@sanverse/edit-domain/clip-time'

/**
 * One short, plain sentence for an accepted edit, for the history list.
 *
 * The user is a non-editor, so nothing here says "clip", "ripple", or
 * "operation". It says what they would say they did.
 *
 * Every kind gets a branch and the compiler enforces that. A new kind of edit
 * that nobody wrote a sentence for would otherwise appear in the history as
 * blank, which reads as a lost edit.
 */
export const describeOperation = (operation: EditOperation): string => {
  const seconds = (ticks: number) => (toMilliseconds({ ticks, timescale: 1_440_000 }) / 1_000).toFixed(1)

  switch (operation.kind) {
    case 'add-nameplate':
      return operation.secondaryText
        ? `${operation.primaryText} — ${operation.secondaryText}`
        : operation.primaryText
    case 'split-clip':
      return `Cut at ${seconds(operation.atClipTime.ticks)}s`
    case 'trim-clip': {
      const removed = operation.trimStart.ticks + operation.trimEnd.ticks
      return operation.ripple
        ? `Shortened by ${seconds(removed)}s and closed the gap`
        : `Shortened by ${seconds(removed)}s`
    }
    case 'remove-clip':
      return operation.ripple ? 'Removed a section and closed the gap' : 'Removed a section, left the space'
    case 'reorder-clip':
      return 'Moved a section to a new position'
    case 'set-clip-enabled':
      return operation.enabled ? 'Brought a section back' : 'Hid a section'
    case 'set-clip-audio': {
      const parts: string[] = []
      if (operation.gainDb !== 0) {
        parts.push(operation.gainDb < 0 ? `${-operation.gainDb} dB quieter` : `${operation.gainDb} dB louder`)
      }
      if (operation.fadeIn.ticks > 0) parts.push('faded in')
      if (operation.fadeOut.ticks > 0) parts.push('faded out')
      return parts.length > 0 ? `Sound: ${parts.join(', ')}` : 'Sound left unchanged'
    }
    case 'set-clip-transition':
      return operation.style === 'none'
        ? 'Removed the transition between two sections'
        : 'Added a smooth dip between two sections'
    case 'add-captions': {
      const count = operation.cues.length
      return `Added captions — ${count} ${count === 1 ? 'line' : 'lines'}`
    }
    case 'set-caption-cue':
      // The new words are shown rather than "edited a caption", because the
      // history is how a user finds the change they want to undo.
      return `Changed a caption to "${operation.lines.join(' ')}"`
    case 'remove-caption-cue':
      return 'Removed one caption'
    case 'set-caption-style':
      return operation.styleId === 'sanverse.caption.plain/v1'
        ? 'Captions: no background'
        : 'Captions: dark background'
    case 'add-title':
      return operation.subhead
        ? `Title: “${operation.headline}” — ${operation.subhead}`
        : `Title: “${operation.headline}”`
    case 'set-title':
      return operation.subhead
        ? `Changed title to “${operation.headline}” — ${operation.subhead}`
        : `Changed title to “${operation.headline}”`
    case 'add-callout':
      return operation.label
        ? `Pointed out “${operation.label}”`
        : 'Drew a box on the picture'
    case 'set-callout':
      return operation.label
        ? `Changed callout to “${operation.label}”`
        : 'Moved or resized a callout'
    case 'add-media-overlay': {
      const length = seconds(operation.sourceInterval.duration.ticks)
      return `Showed another clip for ${length}s`
    }
    case 'set-media-overlay': {
      const length = seconds(operation.sourceInterval.duration.ticks)
      return `Changed another clip to ${length}s`
    }
    case 'add-music': {
      // The loudness is said the way a person would ask for it, not in decibels
      // — "quiet" is what the user meant; -18 dB is how the machine stores it.
      const level = operation.gainDb <= -24
        ? 'very quiet'
        : operation.gainDb <= -12
          ? 'quiet'
          : operation.gainDb < 0
            ? 'a little quiet'
            : 'full volume'
      return `Added music, ${level}`
    }
    case 'set-music':
      return 'Changed the music'
    case 'place-primary-clip':
      return 'Added footage to the main video'
    case 'move-primary-clip':
      return 'Moved a piece of the main video'
    case 'remove-overlay':
      // One sentence for all four families. The user pressed Delete on a
      // rectangle; which family it belonged to is not what they remember.
      return 'Took something off the timeline'
    case 'set-track-output':
      return operation.outputEnabled
        ? `Put ${operation.trackId} back in the video`
        : `Kept ${operation.trackId} out of the video`
    case 'set-visual-properties':
      return operation.tracks.length > 0
        ? 'Changed how something moves'
        : 'Changed its position or appearance'
    case 'set-timeline-markers':
      // The whole list is sent every time, so "how many are there now" is the
      // only honest thing to say. Saying "added a note" would be a guess, and it
      // would be wrong for a deletion.
      return operation.markers.length === 0
        ? 'Cleared your notes'
        : operation.markers.length === 1
          ? 'Changed your note'
          : `Changed your notes (${operation.markers.length} now)`
    case 'set-timeline-groups':
      return operation.groups.length === 0
        ? 'Stopped things moving together'
        : operation.groups.length === 1
          ? 'Made some things move together'
          : `Changed which things move together (${operation.groups.length} groups)`
    case 'set-clip-time-transform': {
      // Reversing is the headline when it happens, because it is the change a
      // user is most likely to be looking for in the list. Otherwise the speed
      // itself is the whole story, written the way it is written on the badge.
      if (operation.direction === 'reverse') return 'Played a piece backwards'
      const speed = formatPlaybackRate(operation.playbackRate)
      if (speed === '1x') return 'Put a piece back to normal speed'
      return `Changed a piece to ${speed} speed`
    }
    case 'set-linked-audio-window':
      return operation.compositionOffsetTicks < 0
        ? 'Made the sound start before the picture'
        : operation.sourceRange.duration.ticks > 0
          ? 'Changed where the linked sound ends'
          : 'Reset the linked sound'
    case 'insert-freeze-frame':
      return 'Held one frame'
    case 'set-primary-clip-timings':
      return operation.changes.length === 1
        ? 'Made a precision timing edit'
        : `Made one precision edit across ${operation.changes.length} pieces`
    case 'set-footage-motion':
      return operation.tracks.length > 0
        ? 'Changed how the main footage moves'
        : 'Reframed the main footage'
    case 'add-timeline-track':
      return `Added a ${operation.track.kind} track`
    case 'remove-timeline-track':
      return 'Removed a track'
    case 'rename-timeline-track':
      return operation.name ? `Named a track “${operation.name}”` : 'Removed a track name'
    case 'reorder-timeline-track':
      return 'Reordered tracks'
    case 'set-track-sync-lock':
      return operation.enabled ? 'Turned Sync Lock on' : 'Turned Sync Lock off'
    case 'set-track-audio-state':
      return 'Changed a track mix'
    case 'assign-timeline-item-track':
      return 'Moved an item to another track'
    default: {
      const unreachable: never = operation
      void unreachable
      return 'An edit this version cannot describe'
    }
  }
}
