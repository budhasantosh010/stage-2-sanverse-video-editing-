import { toMilliseconds, type EditOperation } from '@sanverse/edit-domain'

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
    case 'set-footage-motion':
      return operation.tracks.length > 0
        ? 'Changed how the main footage moves'
        : 'Reframed the main footage'
    default: {
      const unreachable: never = operation
      void unreachable
      return 'An edit this version cannot describe'
    }
  }
}
