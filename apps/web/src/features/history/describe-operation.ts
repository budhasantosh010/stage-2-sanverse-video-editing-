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
    default: {
      const unreachable: never = operation
      void unreachable
      return 'An edit this version cannot describe'
    }
  }
}
