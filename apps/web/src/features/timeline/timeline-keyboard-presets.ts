/**
 * Keyboard shortcuts, and letting somebody bring their muscle memory with them.
 *
 * ## Why presets exist at all
 *
 * Somebody who has edited in CapCut for two years does not think "I will press
 * Ctrl+B to split". Their hand does it. Making them re-learn is a real cost paid
 * on their very first minute in Sanverse, when they are deciding whether this
 * thing is worth their time.
 *
 * ## The honest limit of these presets, stated up front
 *
 * They are called "CapCut-like", "Premiere-like" and "Resolve-like" — NOT
 * "CapCut", "Premiere" and "Resolve" — and that wording is deliberate.
 *
 * Sanverse does not have most of what those editors have. There is nothing here
 * for a keyframe graph, a colour page or a fairlight mixer, because there is
 * nothing here to point those keys at. Each preset maps the commands Sanverse
 * ACTUALLY has to the keys that editor uses for the same job. Where an editor
 * uses a key for something Sanverse cannot do, the key does nothing rather than
 * being given to something else — a key that does the wrong thing is worse than
 * a key that does nothing, because the user finds out afterwards.
 *
 * Claiming "the Premiere keymap" would be a promise this cannot keep.
 *
 * ## Why this is not part of the project
 *
 * A shortcut belongs to the PERSON, not to the video. Two editors opening the
 * same project should each get their own keys. It changes no frame of the
 * export, takes no revision and takes no Undo entry.
 *
 * It is also stored per browser and NOT per project — unlike row heights and
 * padlocks, which are about one particular piece of work. Somebody who set up
 * their keys once should not have to do it again for every new video.
 */

export const TIMELINE_COMMANDS = Object.freeze([
  'split',
  'delete',
  'ripple-delete',
  'copy',
  'cut',
  'paste',
  'paste-insert',
  'duplicate',
  'select-all',
  'clear-selection',
  'group',
  'ungroup',
  'add-marker',
  'next-marker',
  'previous-marker',
  'close-gap',
  'toggle-snapping',
  'zoom-in',
  'zoom-out',
  'fit',
  'nudge-left',
  'nudge-right',
  'go-to-start',
  'go-to-end',
] as const)

export type TimelineCommand = (typeof TIMELINE_COMMANDS)[number]

/** What each command does, in words a non-editor can read. Shown in the settings list. */
export const TIMELINE_COMMAND_LABELS: Readonly<Record<TimelineCommand, string>> = Object.freeze({
  split: 'Cut where the playhead is',
  delete: 'Remove, and leave the space',
  'ripple-delete': 'Remove, and close the space',
  copy: 'Copy',
  cut: 'Cut',
  paste: 'Paste where the playhead is',
  'paste-insert': 'Paste, and push everything later along',
  duplicate: 'Make another one, right after',
  'select-all': 'Choose everything',
  'clear-selection': 'Let go of everything',
  group: 'Make these move together',
  ungroup: 'Stop these moving together',
  'add-marker': 'Leave a note here',
  'next-marker': 'Go to the next note',
  'previous-marker': 'Go to the note before',
  'close-gap': 'Close the empty space',
  'toggle-snapping': 'Turn snapping on or off',
  'zoom-in': 'Zoom in',
  'zoom-out': 'Zoom out',
  fit: 'Fit the whole video on screen',
  'nudge-left': 'Step back one frame',
  'nudge-right': 'Step on one frame',
  'go-to-start': 'Go to the beginning',
  'go-to-end': 'Go to the end',
})

export const KEYBOARD_PRESETS = Object.freeze([
  'sanverse',
  'capcut-like',
  'premiere-like',
  'resolve-like',
  'custom',
] as const)

export type KeyboardPreset = (typeof KEYBOARD_PRESETS)[number]

export const KEYBOARD_PRESET_LABELS: Readonly<Record<KeyboardPreset, string>> = Object.freeze({
  sanverse: 'Sanverse',
  'capcut-like': 'Close to CapCut',
  'premiere-like': 'Close to Premiere Pro',
  'resolve-like': 'Close to DaVinci Resolve',
  custom: 'My own',
})

/**
 * One key press written down in one settled way.
 *
 * Always the same order — Ctrl, Alt, Shift, then the key itself in capitals.
 * Without a settled order, `Ctrl+Shift+B` and `Shift+Ctrl+B` would be two
 * different shortcuts that feel identical to the person pressing them, and the
 * conflict checker would say there is no clash when there plainly is one.
 *
 * `Cmd` on a Mac is written as `Ctrl`, because it does the same job and the user
 * pressing it means the same thing. A Mac user sees "Cmd" on screen; the stored
 * form is one word so a keymap moves between machines unchanged.
 */
export const canonicalKeyBinding = (event: Readonly<{
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}>): string => {
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key
  parts.push(key)
  return parts.join('+')
}

/** The same shortcut, written the way it should be shown on this machine. */
export const displayKeyBinding = (binding: string, isMac: boolean): string =>
  isMac ? binding.replace('Ctrl', 'Cmd') : binding

export type KeymapV1 = Readonly<{
  schemaVersion: typeof KEYMAP_SCHEMA_VERSION
  presetId: KeyboardPreset
  /** Empty string means "this command has no key at all". Never null, so one shape. */
  bindings: Readonly<Record<TimelineCommand, string>>
}>

export const KEYMAP_SCHEMA_VERSION = 'sanverse.timeline-keymap/v1'

const bindingsOf = (
  overrides: Partial<Record<TimelineCommand, string>>,
): Readonly<Record<TimelineCommand, string>> => {
  const bindings = {} as Record<TimelineCommand, string>
  for (const command of TIMELINE_COMMANDS) bindings[command] = overrides[command] ?? ''
  return Object.freeze(bindings)
}

/**
 * Sanverse's own keys.
 *
 * One deliberate difference from most editors, carried over from Gate A: plain
 * `S` is snapping and `Ctrl+B` is split. Two meanings for one key is the kind of
 * thing that makes somebody distrust their own hands.
 */
const SANVERSE_BINDINGS = bindingsOf({
  split: 'Ctrl+B',
  delete: 'Delete',
  'ripple-delete': 'Shift+Delete',
  copy: 'Ctrl+C',
  cut: 'Ctrl+X',
  paste: 'Ctrl+V',
  'paste-insert': 'Ctrl+Shift+V',
  duplicate: 'Ctrl+D',
  'select-all': 'Ctrl+A',
  'clear-selection': 'Escape',
  group: 'Ctrl+G',
  ungroup: 'Ctrl+Shift+G',
  'add-marker': 'M',
  'next-marker': 'Shift+ArrowRight',
  'previous-marker': 'Shift+ArrowLeft',
  'close-gap': 'Ctrl+Backspace',
  'toggle-snapping': 'S',
  'zoom-in': '+',
  'zoom-out': '-',
  fit: 'Shift+Z',
  'nudge-left': 'ArrowLeft',
  'nudge-right': 'ArrowRight',
  'go-to-start': 'Home',
  'go-to-end': 'End',
})

/** CapCut puts split on Ctrl+B and leans on the common Ctrl letters. */
const CAPCUT_BINDINGS = bindingsOf({
  ...SANVERSE_BINDINGS,
  split: 'Ctrl+B',
  'toggle-snapping': 'Ctrl+Shift+S',
  fit: 'Ctrl+0',
})

/** Premiere Pro puts the razor on Ctrl+K and ripple delete on Shift+Delete. */
const PREMIERE_BINDINGS = bindingsOf({
  ...SANVERSE_BINDINGS,
  split: 'Ctrl+K',
  'ripple-delete': 'Shift+Delete',
  'add-marker': 'M',
  'toggle-snapping': 'S',
  fit: 'Shift+Z',
  duplicate: 'Ctrl+Shift+D',
})

/** Resolve's edit page uses B for the blade and Backspace for a ripple delete. */
const RESOLVE_BINDINGS = bindingsOf({
  ...SANVERSE_BINDINGS,
  split: 'Ctrl+B',
  delete: 'Delete',
  'ripple-delete': 'Backspace',
  'add-marker': 'M',
  'toggle-snapping': 'N',
  fit: 'Shift+Z',
})

export const PRESET_BINDINGS: Readonly<Record<KeyboardPreset, Readonly<Record<TimelineCommand, string>>>> =
  Object.freeze({
    sanverse: SANVERSE_BINDINGS,
    'capcut-like': CAPCUT_BINDINGS,
    'premiere-like': PREMIERE_BINDINGS,
    'resolve-like': RESOLVE_BINDINGS,
    // "My own" starts as a copy of Sanverse's, so the first change a user makes
    // is one change rather than twenty-four.
    custom: SANVERSE_BINDINGS,
  })

export const DEFAULT_KEYMAP: KeymapV1 = Object.freeze({
  schemaVersion: KEYMAP_SCHEMA_VERSION,
  presetId: 'sanverse',
  bindings: SANVERSE_BINDINGS,
})

export const keymapForPreset = (presetId: KeyboardPreset): KeymapV1 =>
  Object.freeze({
    schemaVersion: KEYMAP_SCHEMA_VERSION,
    presetId,
    bindings: PRESET_BINDINGS[presetId],
  })

/**
 * Change one key. Doing so always becomes "My own".
 *
 * Otherwise the screen would still say "Close to Premiere Pro" while no longer
 * being close to Premiere Pro, and the user would have no way of knowing which
 * of the twenty-four keys they had changed.
 */
export const rebindCommand = (
  keymap: KeymapV1,
  command: TimelineCommand,
  binding: string,
): KeymapV1 =>
  Object.freeze({
    schemaVersion: KEYMAP_SCHEMA_VERSION,
    presetId: 'custom',
    bindings: Object.freeze({ ...keymap.bindings, [command]: binding }),
  })

export type KeymapConflict = Readonly<{
  binding: string
  commands: readonly TimelineCommand[]
}>

/**
 * Two commands sharing one key.
 *
 * Reported rather than prevented, on purpose. A user halfway through swapping
 * two keys round genuinely has a clash for a moment, and being refused mid-swap
 * would make the swap impossible. So the clash is SHOWN, named, and the user
 * decides.
 *
 * When a clash is live, the command that comes first in `TIMELINE_COMMANDS` is
 * the one that runs — see `commandForKey`. That is stated so the behaviour is
 * predictable rather than a surprise.
 */
export const keymapConflicts = (keymap: KeymapV1): readonly KeymapConflict[] => {
  const byBinding = new Map<string, TimelineCommand[]>()
  for (const command of TIMELINE_COMMANDS) {
    const binding = keymap.bindings[command]
    if (binding === '') continue
    const existing = byBinding.get(binding)
    if (existing) existing.push(command)
    else byBinding.set(binding, [command])
  }
  const conflicts: KeymapConflict[] = []
  for (const [binding, commands] of byBinding) {
    if (commands.length > 1) conflicts.push(Object.freeze({ binding, commands: Object.freeze(commands) }))
  }
  return Object.freeze(conflicts.sort((left, right) => left.binding.localeCompare(right.binding)))
}

/** Which command this key press means, or null. First one listed wins a clash. */
export const commandForKey = (keymap: KeymapV1, binding: string): TimelineCommand | null => {
  if (binding === '') return null
  return TIMELINE_COMMANDS.find((command) => keymap.bindings[command] === binding) ?? null
}

export const parseKeymap = (raw: unknown): KeymapV1 => {
  if (typeof raw !== 'string' || raw.length === 0) return DEFAULT_KEYMAP
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DEFAULT_KEYMAP
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return DEFAULT_KEYMAP
  const record = parsed as Record<string, unknown>
  if (record.schemaVersion !== KEYMAP_SCHEMA_VERSION) return DEFAULT_KEYMAP
  const presetId = (KEYBOARD_PRESETS as readonly string[]).includes(record.presetId as string)
    ? record.presetId as KeyboardPreset
    : 'sanverse'

  const stored = typeof record.bindings === 'object' && record.bindings !== null && !Array.isArray(record.bindings)
    ? record.bindings as Record<string, unknown>
    : {}
  const bindings = {} as Record<TimelineCommand, string>
  for (const command of TIMELINE_COMMANDS) {
    const value = stored[command]
    // Anything unrecognised falls back to the preset's own key rather than to
    // nothing, so a partly corrupted file leaves the user with a working
    // keyboard instead of a dead one.
    bindings[command] = typeof value === 'string' && value.length <= 40
      ? value
      : PRESET_BINDINGS[presetId][command]
  }
  return Object.freeze({
    schemaVersion: KEYMAP_SCHEMA_VERSION,
    presetId,
    bindings: Object.freeze(bindings),
  })
}

const KEYMAP_STORAGE_KEY = 'sanverse.timeline-keymap'

export const readKeymap = (): KeymapV1 => {
  try {
    return parseKeymap(globalThis.localStorage?.getItem(KEYMAP_STORAGE_KEY))
  } catch {
    return DEFAULT_KEYMAP
  }
}

export const writeKeymap = (keymap: KeymapV1): void => {
  try {
    globalThis.localStorage?.setItem(KEYMAP_STORAGE_KEY, JSON.stringify(keymap))
  } catch {
    // A preference, not the user's work.
  }
}
