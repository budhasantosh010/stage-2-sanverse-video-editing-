import { describe, expect, it } from 'vitest'

import {
  COLLAPSED_TRACK_HEIGHT_PX,
  DEFAULT_TRACK_PRESENTATION,
  MAX_TRACK_HEIGHT_PX,
  MIN_TRACK_HEIGHT_PX,
  TRACK_HEIGHT_PX,
  fitTrackHeights,
  isTrackCollapsed,
  parseTrackPresentation,
  resetTrackPresentation,
  setTrackHeight,
  toggleTrackCollapsed,
  trackHeightPx,
} from './timeline-track-presentation'
import {
  DEFAULT_KEYMAP,
  KEYBOARD_PRESETS,
  PRESET_BINDINGS,
  TIMELINE_COMMANDS,
  TIMELINE_COMMAND_LABELS,
  canonicalKeyBinding,
  commandForKey,
  displayKeyBinding,
  keymapConflicts,
  keymapForPreset,
  parseKeymap,
  rebindCommand,
} from './timeline-keyboard-presets'

/*
 * Both of these are WORKSPACE settings, not part of anybody's video.
 *
 * A row height belongs to a SCREEN and a shortcut belongs to a PERSON. Neither
 * takes a revision, neither takes a slot in Undo, and the exported file is
 * byte-for-byte what it would have been without them. That is why they live in
 * the browser and not in the project.
 */

describe('T1.10 how tall each row is', () => {
  it('leaves a row alone when the user has never touched it', () => {
    // Somebody who has changed nothing gets exactly what they had before: the
    // height the window width decides.
    expect(trackHeightPx(DEFAULT_TRACK_PRESENTATION, 'V1', 61)).toBe(61)
  })

  it('uses the named size when one was chosen', () => {
    const next = setTrackHeight(DEFAULT_TRACK_PRESENTATION, 'V1', 'tall')
    expect(trackHeightPx(next, 'V1', 61)).toBe(TRACK_HEIGHT_PX.tall)
    // ...and only that row.
    expect(trackHeightPx(next, 'A2', 61)).toBe(61)
  })

  it('holds an exact height inside readable bounds', () => {
    const tooSmall = setTrackHeight(DEFAULT_TRACK_PRESENTATION, 'V1', 2)
    const tooBig = setTrackHeight(DEFAULT_TRACK_PRESENTATION, 'V1', 9_000)
    expect(trackHeightPx(tooSmall, 'V1', 61)).toBe(MIN_TRACK_HEIGHT_PX)
    expect(trackHeightPx(tooBig, 'V1', 61)).toBe(MAX_TRACK_HEIGHT_PX)
  })

  it('folds a row to a thin strip, never to nothing', () => {
    // A row that vanished could not be found again to unfold it.
    const folded = toggleTrackCollapsed(DEFAULT_TRACK_PRESENTATION, 'C1')
    expect(isTrackCollapsed(folded, 'C1')).toBe(true)
    expect(trackHeightPx(folded, 'C1', 61)).toBe(COLLAPSED_TRACK_HEIGHT_PX)
    expect(COLLAPSED_TRACK_HEIGHT_PX).toBeGreaterThan(0)
  })

  it('unfolds a row when a height is asked for, so the control is never ignored', () => {
    const folded = toggleTrackCollapsed(DEFAULT_TRACK_PRESENTATION, 'C1')
    const sized = setTrackHeight(folded, 'C1', 'standard')
    expect(isTrackCollapsed(sized, 'C1')).toBe(false)
  })

  it('fits every open row into the space there is', () => {
    const fitted = fitTrackHeights(DEFAULT_TRACK_PRESENTATION, 300)
    const heights = (['V2', 'V1', 'C1', 'A1', 'A2'] as const)
      .map((trackId) => trackHeightPx(fitted, trackId, 61))
    expect(new Set(heights).size).toBe(1)
    expect(heights[0] * 5).toBeLessThanOrEqual(300)
  })

  it('does not count a folded row when fitting, which is the point of folding one', () => {
    const folded = toggleTrackCollapsed(DEFAULT_TRACK_PRESENTATION, 'C1')
    const fitted = fitTrackHeights(folded, 300)
    expect(trackHeightPx(fitted, 'C1', 61)).toBe(COLLAPSED_TRACK_HEIGHT_PX)
    expect(trackHeightPx(fitted, 'V1', 61)).toBeGreaterThan(300 / 5)
  })

  it('keeps rows readable rather than squeezing them to avoid a scrollbar', () => {
    // Trading a scrollbar for rows nobody can read is the wrong trade.
    const fitted = fitTrackHeights(DEFAULT_TRACK_PRESENTATION, 20)
    expect(trackHeightPx(fitted, 'V1', 61)).toBe(MIN_TRACK_HEIGHT_PX)
  })

  it('resets everything back to what the window decides', () => {
    expect(resetTrackPresentation()).toEqual(DEFAULT_TRACK_PRESENTATION)
  })
})

describe('T1.10 reading what was stored, and refusing to trust it', () => {
  it('gives the default for anything unrecognised, rather than failing to open', () => {
    // A corrupted workspace setting must never stop somebody opening a project.
    for (const rubbish of ['', 'not json', '[]', '{}', '{"schemaVersion":"other"}', null, 7]) {
      expect(parseTrackPresentation(rubbish)).toEqual(DEFAULT_TRACK_PRESENTATION)
    }
  })

  it('keeps only the five tracks it knows, and drops the rest', () => {
    const parsed = parseTrackPresentation(JSON.stringify({
      schemaVersion: 'sanverse.timeline-track-presentation/v1',
      heights: { V1: 'tall', V9: 'tall', A2: 40, C1: 'enormous' },
      collapsed: ['C1', 'Z9'],
    }))
    expect(parsed.heights).toEqual({ V1: 'tall', A2: 40 })
    expect(parsed.collapsed).toEqual(['C1'])
  })

  it('holds a stored number inside the same bounds a dragged one obeys', () => {
    const parsed = parseTrackPresentation(JSON.stringify({
      schemaVersion: 'sanverse.timeline-track-presentation/v1',
      heights: { V1: 100_000 },
      collapsed: [],
    }))
    expect(parsed.heights.V1).toBe(MAX_TRACK_HEIGHT_PX)
  })
})

describe('T1.14 keyboard shortcuts', () => {
  it('writes a key press down one settled way, whatever order the keys were held', () => {
    /*
     * Without a settled order, Ctrl+Shift+B and Shift+Ctrl+B would be two
     * different shortcuts that feel identical to the person pressing them, and
     * the clash checker would say there was no clash when there plainly was.
     */
    const binding = canonicalKeyBinding({ key: 'b', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true })
    expect(binding).toBe('Ctrl+Shift+B')
    // Cmd on a Mac is written the same way, because it does the same job.
    expect(canonicalKeyBinding({ key: 'b', ctrlKey: false, metaKey: true, altKey: false, shiftKey: true }))
      .toBe('Ctrl+Shift+B')
  })

  it('shows Cmd to a Mac user and Ctrl to everybody else', () => {
    expect(displayKeyBinding('Ctrl+B', true)).toBe('Cmd+B')
    expect(displayKeyBinding('Ctrl+B', false)).toBe('Ctrl+B')
  })

  it('keeps a named key whole rather than shouting it', () => {
    expect(canonicalKeyBinding({ key: 'ArrowLeft', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }))
      .toBe('ArrowLeft')
  })

  it('gives every command a name a non-editor can read', () => {
    for (const command of TIMELINE_COMMANDS) {
      const label = TIMELINE_COMMAND_LABELS[command]
      expect(label.length).toBeGreaterThan(0)
      // No internal names, ever.
      expect(label).not.toMatch(/[A-Z]{2,}_[A-Z]/)
      expect(label).not.toContain('-')
    }
  })

  it('has no clash inside ANY preset it ships with', () => {
    // A preset that shipped with two commands on one key would be a bug the
    // user could not fix without finding it first.
    for (const preset of KEYBOARD_PRESETS) {
      expect(keymapConflicts(keymapForPreset(preset))).toEqual([])
    }
  })

  it('finds the command a key means, and null for a key that means nothing', () => {
    expect(commandForKey(DEFAULT_KEYMAP, 'Ctrl+B')).toBe('split')
    expect(commandForKey(DEFAULT_KEYMAP, 'Ctrl+Alt+Shift+Q')).toBeNull()
    expect(commandForKey(DEFAULT_KEYMAP, '')).toBeNull()
  })

  it('gives every preset a key for the things people do most', () => {
    for (const preset of KEYBOARD_PRESETS) {
      for (const command of ['split', 'delete', 'copy', 'paste', 'select-all', 'add-marker'] as const) {
        expect(PRESET_BINDINGS[preset][command]).not.toBe('')
      }
    }
  })

  it('makes every shortcut printed in the T3 Trim flyout executable and clash-free', () => {
    expect(commandForKey(DEFAULT_KEYMAP, 'T')).toBe('tool-standard-trim')
    expect(commandForKey(DEFAULT_KEYMAP, 'Shift+T')).toBe('tool-ripple-trim')
    expect(commandForKey(DEFAULT_KEYMAP, 'R')).toBe('tool-roll')
    expect(commandForKey(DEFAULT_KEYMAP, 'Y')).toBe('tool-slip')
    expect(commandForKey(DEFAULT_KEYMAP, 'U')).toBe('tool-slide')
    expect(commandForKey(DEFAULT_KEYMAP, 'Shift+R')).toBe('tool-rate-stretch')
    expect(keymapConflicts(DEFAULT_KEYMAP)).toEqual([])
  })

  it('becomes "My own" the moment a key is changed', () => {
    /*
     * Otherwise the screen would still say "Close to Premiere Pro" while no
     * longer being close to it, and the user would have no way of knowing which
     * of the twenty-odd keys they had changed.
     */
    const premiere = keymapForPreset('premiere-like')
    const changed = rebindCommand(premiere, 'split', 'Ctrl+Shift+X')
    expect(changed.presetId).toBe('custom')
    expect(changed.bindings.split).toBe('Ctrl+Shift+X')
    expect(premiere.bindings.split).not.toBe('Ctrl+Shift+X')
  })

  it('reports a clash rather than refusing it, so a swap is possible at all', () => {
    // Halfway through swapping two keys there genuinely IS a clash. Being
    // refused mid-swap would make the swap impossible.
    const clashing = rebindCommand(DEFAULT_KEYMAP, 'duplicate', DEFAULT_KEYMAP.bindings.copy)
    const conflicts = keymapConflicts(clashing)
    expect(conflicts.length).toBe(1)
    expect(conflicts[0].commands).toContain('copy')
    expect(conflicts[0].commands).toContain('duplicate')
  })

  it('lets a command have no key at all', () => {
    const unbound = rebindCommand(DEFAULT_KEYMAP, 'duplicate', '')
    expect(commandForKey(unbound, '')).toBeNull()
    expect(keymapConflicts(unbound)).toEqual([])
  })

  it('gives the default for stored rubbish rather than a dead keyboard', () => {
    for (const rubbish of ['', 'not json', '[]', '{"schemaVersion":"other"}', null, 7]) {
      expect(parseKeymap(rubbish)).toEqual(DEFAULT_KEYMAP)
    }
  })

  it('falls back to the preset key for one missing entry, not to nothing', () => {
    // A partly corrupted file leaves the user with a working keyboard.
    const parsed = parseKeymap(JSON.stringify({
      schemaVersion: 'sanverse.timeline-keymap/v1',
      presetId: 'premiere-like',
      bindings: { split: 42 },
    }))
    expect(parsed.bindings.split).toBe(PRESET_BINDINGS['premiere-like'].split)
    expect(parsed.bindings.copy).toBe(PRESET_BINDINGS['premiere-like'].copy)
  })

  it('reads back exactly what was written', () => {
    const mine = rebindCommand(keymapForPreset('resolve-like'), 'fit', 'Ctrl+9')
    expect(parseKeymap(JSON.stringify(mine))).toEqual(mine)
  })
})
