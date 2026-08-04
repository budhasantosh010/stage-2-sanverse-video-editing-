import { beforeEach, describe, expect, it } from 'vitest'

import {
  EMPTY_LOCK_STATE,
  TIMELINE_LOCK_SCHEMA_VERSION,
  isTrackLocked,
  parseTimelineLockState,
  readTimelineLockState,
  toggleTrackLock,
  writeTimelineLockState,
} from './timeline-lock-state'

const PROJECT_ID = 'project_aaaaaaaaaaaaaaaa'

describe('P1-F.1A C1.6 padlocks on the five tracks', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
  })

  it('starts with nothing locked', () => {
    expect(readTimelineLockState(PROJECT_ID)).toEqual(EMPTY_LOCK_STATE)
  })

  it('remembers a padlock across a reload, without touching the project', () => {
    writeTimelineLockState(PROJECT_ID, toggleTrackLock(EMPTY_LOCK_STATE, 'V2'))
    expect(readTimelineLockState(PROJECT_ID).lockedTrackIds).toEqual(['V2'])
  })

  it('keeps one project’s padlocks out of another project', () => {
    writeTimelineLockState(PROJECT_ID, toggleTrackLock(EMPTY_LOCK_STATE, 'A2'))
    expect(readTimelineLockState('project_bbbbbbbbbbbbbbbb').lockedTrackIds).toEqual([])
  })

  it('turns a padlock on and off again', () => {
    const locked = toggleTrackLock(EMPTY_LOCK_STATE, 'A1')
    expect(isTrackLocked(locked, 'A1')).toBe(true)
    expect(isTrackLocked(toggleTrackLock(locked, 'A1'), 'A1')).toBe(false)
  })

  it('never records the same track twice', () => {
    let state = EMPTY_LOCK_STATE
    state = toggleTrackLock(state, 'V1')
    state = toggleTrackLock(state, 'V1')
    state = toggleTrackLock(state, 'V1')
    expect(state.lockedTrackIds).toEqual(['V1'])
  })

  it('reads corrupted or foreign settings as "nothing is locked" rather than failing', () => {
    // A broken workspace setting must never stop somebody opening their work.
    // The safe direction is unlocked: at worst a padlock has to be put back.
    for (const raw of [
      null,
      '',
      'not json',
      '[]',
      '{"schemaVersion":"something.else/v9","lockedTrackIds":["V2"]}',
      '{"schemaVersion":"sanverse.timeline-locks/v1","lockedTrackIds":"V2"}',
    ]) {
      expect(parseTimelineLockState(raw)).toEqual(EMPTY_LOCK_STATE)
    }
  })

  it('throws away a track name it does not recognise and keeps the ones it does', () => {
    const parsed = parseTimelineLockState(JSON.stringify({
      schemaVersion: TIMELINE_LOCK_SCHEMA_VERSION,
      lockedTrackIds: ['V2', 'V9', 'A2', 'nonsense'],
    }))
    expect(parsed.lockedTrackIds).toEqual(['V2', 'A2'])
  })

  it('survives storage being unavailable, as it is in private browsing', () => {
    const original = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked')
      },
    })
    expect(() => readTimelineLockState(PROJECT_ID)).not.toThrow()
    expect(readTimelineLockState(PROJECT_ID)).toEqual(EMPTY_LOCK_STATE)
    expect(() => writeTimelineLockState(PROJECT_ID, EMPTY_LOCK_STATE)).not.toThrow()
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original })
  })
})
