import { describe, expect, it } from 'vitest'

import {
  MAX_AUTOMATIC_SAVE_ATTEMPTS,
  SAVE_REFUSALS,
  classifySaveFailure,
  isRecoverableRefusal,
  isUnsafeToLeave,
  nextSaveState,
  openedSaveState,
  saveRefusalMessage,
  saveRetryDelayMs,
  saveStateMessage,
  saveStateNeedsUser,
  saveStateOffersRetry,
  type SaveEvent,
  type SaveStateV1,
} from './save-state.ts'

const play = (from: SaveStateV1, ...events: readonly SaveEvent[]): SaveStateV1 =>
  events.reduce(nextSaveState, from)

describe('telling the user what actually happened to their work', () => {
  it('never shows the dead-end sentence that replaced all of this', () => {
    // "Local save needs attention" said nothing, offered nothing, and never
    // went away. Every state has to be better than that or this was pointless.
    const states: readonly SaveStateV1[] = [
      { status: 'saved', persistedRevision: 12 },
      { status: 'saving', targetRevision: 13, persistedRevision: 12 },
      { status: 'retrying', targetRevision: 13, persistedRevision: 12, attempt: 2 },
      { status: 'offline', targetRevision: 13, persistedRevision: 12 },
      { status: 'conflict', targetRevision: 13, persistedRevision: 12, serverRevision: 15 },
      { status: 'failed', targetRevision: 13, persistedRevision: 12, refusal: 'WRITE_FAILED' },
    ]
    for (const state of states) {
      const message = saveStateMessage(state)
      expect(message.toLowerCase()).not.toContain('needs attention')
      expect(message.length).toBeGreaterThan(5)
    }
  })

  it('always says how much work is already safe, in every state that is not saved', () => {
    // This is the sentence that turns fright into information. "Change 12 is
    // already saved" is the difference between "something is wrong" and
    // "something is wrong AND my afternoon is not gone".
    const notSaved: readonly SaveStateV1[] = [
      { status: 'retrying', targetRevision: 13, persistedRevision: 12, attempt: 1 },
      { status: 'offline', targetRevision: 13, persistedRevision: 12 },
      { status: 'conflict', targetRevision: 13, persistedRevision: 12, serverRevision: 15 },
      { status: 'failed', targetRevision: 13, persistedRevision: 12, refusal: 'SERVER_UNAVAILABLE' },
    ]
    for (const state of notSaved) {
      expect(saveStateMessage(state)).toContain('12')
      expect(saveStateMessage(state)).toContain('already saved')
    }
  })

  it('names no code, no path and no jargon anywhere a user can read', () => {
    for (const refusal of SAVE_REFUSALS) {
      const message = saveRefusalMessage(refusal)
      expect(message).not.toMatch(/[A-Z]{2,}_[A-Z]/)
      expect(message).not.toMatch(/[/\\]|https?:|revision|schema|http \d|\.ts\b/i)
      expect(message.length).toBeGreaterThan(20)
    }
  })
})

describe('the work that is safe on disk', () => {
  it('never says less is saved than really is, even if an old reply arrives late', () => {
    // Saves are sent one at a time, but a reply can still turn up after a newer
    // one. If the number went backwards the user would watch their saved work
    // apparently shrink.
    const state = play(
      openedSaveState(10),
      { kind: 'edit-started', targetRevision: 11 },
      { kind: 'persisted', revision: 11 },
      { kind: 'edit-started', targetRevision: 12 },
      { kind: 'persisted', revision: 12 },
      { kind: 'persisted', revision: 11 }, // the straggler
    )
    expect(state.persistedRevision).toBe(12)
  })

  it('keeps the number through a failure, because a failed save loses nothing already written', () => {
    const state = play(
      openedSaveState(7),
      { kind: 'edit-started', targetRevision: 8 },
      { kind: 'failed', refusal: 'SERVER_UNAVAILABLE' },
    )
    expect(state.persistedRevision).toBe(7)
    expect(state.status).toBe('failed')
  })
})

describe('recovering on its own', () => {
  it('goes back to plain Saved from every single failure state', () => {
    // The sticky-warning bug in one test. If any failure state could survive a
    // later success, the user would be left with a warning about a problem that
    // fixed itself minutes ago — which is how the old message became permanent.
    const failures: readonly SaveStateV1[] = [
      { status: 'retrying', targetRevision: 5, persistedRevision: 4, attempt: 3 },
      { status: 'offline', targetRevision: 5, persistedRevision: 4 },
      { status: 'conflict', targetRevision: 5, persistedRevision: 4, serverRevision: 9 },
      { status: 'failed', targetRevision: 5, persistedRevision: 4, refusal: 'WRITE_FAILED' },
    ]
    for (const failure of failures) {
      const recovered = nextSaveState(failure, { kind: 'persisted', revision: 5 })
      expect(recovered.status).toBe('saved')
      expect(recovered.persistedRevision).toBe(5)
      expect(saveStateNeedsUser(recovered)).toBe(false)
      expect(saveStateOffersRetry(recovered)).toBe(false)
    }
  })

  it('tries again by itself three times, then stops and asks', () => {
    // Trying forever hides a real problem behind a spinner that never ends.
    expect(saveRetryDelayMs(1)).toBe(400)
    expect(saveRetryDelayMs(2)).toBe(1_200)
    expect(saveRetryDelayMs(3)).toBe(3_600)
    expect(saveRetryDelayMs(MAX_AUTOMATIC_SAVE_ATTEMPTS + 1)).toBeNull()
    expect(saveRetryDelayMs(0)).toBeNull()
  })

  it('waits longer each time rather than hammering a server that is already struggling', () => {
    const delays = [1, 2, 3].map(saveRetryDelayMs)
    for (let index = 1; index < delays.length; index += 1) {
      expect(delays[index]!).toBeGreaterThan(delays[index - 1]!)
    }
  })

  it('counts the attempts up so the message can say which one this is', () => {
    const state = play(
      openedSaveState(4),
      { kind: 'edit-started', targetRevision: 5 },
      { kind: 'failed', refusal: 'SERVER_UNAVAILABLE' },
      { kind: 'retry-started' },
      { kind: 'retry-started' },
    )
    expect(state.status).toBe('retrying')
    if (state.status === 'retrying') expect(state.attempt).toBe(2)
    expect(saveStateMessage(state)).toContain('2 of 3')
  })

  it('picks the save back up on its own the moment the connection comes back', () => {
    const offline = play(
      openedSaveState(4),
      { kind: 'edit-started', targetRevision: 5 },
      { kind: 'failed', refusal: 'NETWORK_UNAVAILABLE' },
    )
    expect(offline.status).toBe('offline')
    const restored = nextSaveState(offline, { kind: 'connection-restored' })
    expect(restored.status).toBe('retrying')
    expect(restored.persistedRevision).toBe(4)
  })

  it('ignores a connection coming back when nothing was waiting on it', () => {
    const saved = openedSaveState(4)
    expect(nextSaveState(saved, { kind: 'connection-restored' })).toBe(saved)
  })
})

describe('failures that trying again cannot fix', () => {
  it('only retries the ones where the same request could genuinely work next time', () => {
    expect(isRecoverableRefusal('NETWORK_UNAVAILABLE')).toBe(true)
    expect(isRecoverableRefusal('SERVER_UNAVAILABLE')).toBe(true)
    expect(isRecoverableRefusal('WRITE_FAILED')).toBe(true)
    // Repeating these would fail identically forever, and a spinner that never
    // resolves is a worse lie than an error.
    expect(isRecoverableRefusal('REVISION_CONFLICT')).toBe(false)
    expect(isRecoverableRefusal('PROJECT_MISSING')).toBe(false)
    expect(isRecoverableRefusal('RESPONSE_INVALID')).toBe(false)
    expect(isRecoverableRefusal('SAVE_CANCELLED')).toBe(false)
  })

  it('treats being changed somewhere else as its own thing, not a generic error', () => {
    const state = play(
      openedSaveState(4),
      { kind: 'edit-started', targetRevision: 5 },
      { kind: 'failed', refusal: 'REVISION_CONFLICT', serverRevision: 9 },
    )
    expect(state.status).toBe('conflict')
    if (state.status === 'conflict') {
      // Both numbers survive, so neither side can be quietly thrown away.
      expect(state.persistedRevision).toBe(4)
      expect(state.serverRevision).toBe(9)
    }
  })

  it('assumes the other side is at least one ahead when it does not say', () => {
    const state = play(
      openedSaveState(4),
      { kind: 'edit-started', targetRevision: 5 },
      { kind: 'failed', refusal: 'REVISION_CONFLICT' },
    )
    if (state.status === 'conflict') expect(state.serverRevision).toBe(5)
  })

  it('offers something to press for every failure a user could act on', () => {
    expect(saveStateOffersRetry({ status: 'offline', targetRevision: 5, persistedRevision: 4 })).toBe(true)
    expect(saveStateOffersRetry({ status: 'conflict', targetRevision: 5, persistedRevision: 4, serverRevision: 6 })).toBe(true)
    expect(saveStateOffersRetry({ status: 'failed', targetRevision: 5, persistedRevision: 4, refusal: 'WRITE_FAILED' })).toBe(true)
    // Except the one where retrying is genuinely pointless: the project is not
    // on this computer. Offering Retry there would be a lie.
    expect(saveStateOffersRetry({ status: 'failed', targetRevision: 5, persistedRevision: 4, refusal: 'PROJECT_MISSING' })).toBe(false)
  })

  it('never leaves a state that has no explanation and nothing to do', () => {
    const stuck: readonly SaveStateV1[] = [
      { status: 'offline', targetRevision: 5, persistedRevision: 4 },
      { status: 'conflict', targetRevision: 5, persistedRevision: 4, serverRevision: 6 },
      { status: 'failed', targetRevision: 5, persistedRevision: 4, refusal: 'SERVER_UNAVAILABLE' },
      { status: 'failed', targetRevision: 5, persistedRevision: 4, refusal: 'PROJECT_MISSING' },
    ]
    for (const state of stuck) {
      // either the user can press something, or the message alone tells them
      // exactly what to do about it
      expect(saveStateOffersRetry(state) || saveStateMessage(state).length > 40).toBe(true)
    }
  })
})

describe('reading what went wrong without trusting what it said', () => {
  it('calls a dropped connection a dropped connection, whatever the error looked like', () => {
    expect(classifySaveFailure(new Error('anything at all'), false)).toBe('NETWORK_UNAVAILABLE')
  })

  it('separates "could not reach anything" from "the server refused"', () => {
    // A fetch that never reached a server throws a TypeError.
    expect(classifySaveFailure(new TypeError('Failed to fetch'), true)).toBe('SERVER_UNAVAILABLE')
    expect(classifySaveFailure(Object.assign(new Error('x'), { code: 'REVISION_CONFLICT' }), true)).toBe('REVISION_CONFLICT')
  })

  it('recognises a save the user themselves stopped', () => {
    expect(classifySaveFailure(new DOMException('stopped', 'AbortError'), true)).toBe('SAVE_CANCELLED')
  })

  it('falls back to a real reason rather than inventing one', () => {
    expect(SAVE_REFUSALS).toContain(classifySaveFailure({ weird: true }, true))
    expect(SAVE_REFUSALS).toContain(classifySaveFailure(null, true))
  })

  it('never repeats what the server said back to the user', () => {
    // The server's words are not written for the person reading them and are not
    // ours to trust. Only our own closed list ever reaches the screen.
    const shouty = Object.assign(new Error('ENOSPC: no space left on device, write /home/x/.sanverse/p/project.json'), {})
    const refusal = classifySaveFailure(shouty, true)
    expect(saveRefusalMessage(refusal)).not.toContain('ENOSPC')
    expect(saveRefusalMessage(refusal)).not.toContain('/home')
  })
})

describe('warning before the tab closes', () => {
  it('warns only when there is genuinely something unsaved', () => {
    expect(isUnsafeToLeave({ status: 'saving', targetRevision: 5, persistedRevision: 4 })).toBe(true)
    expect(isUnsafeToLeave({ status: 'offline', targetRevision: 5, persistedRevision: 4 })).toBe(true)
    expect(isUnsafeToLeave({ status: 'failed', targetRevision: 5, persistedRevision: 4, refusal: 'WRITE_FAILED' })).toBe(true)
  })

  it('stays quiet when everything is on disk', () => {
    // Warning on every close trains people to click through without reading,
    // which makes the warning useless on the one day it matters.
    expect(isUnsafeToLeave({ status: 'saved', persistedRevision: 4 })).toBe(false)
    // and when the in-flight save was for work already written
    expect(isUnsafeToLeave({ status: 'saving', targetRevision: 4, persistedRevision: 4 })).toBe(false)
  })
})

describe('the everyday path, end to end', () => {
  it('opens, edits four times, and says exactly how much is safe throughout', () => {
    let state = openedSaveState(0)
    for (let revision = 1; revision <= 4; revision += 1) {
      state = nextSaveState(state, { kind: 'edit-started', targetRevision: revision })
      expect(state.status).toBe('saving')
      expect(isUnsafeToLeave(state)).toBe(true)
      state = nextSaveState(state, { kind: 'persisted', revision })
      expect(state.status).toBe('saved')
      expect(state.persistedRevision).toBe(revision)
      expect(isUnsafeToLeave(state)).toBe(false)
    }
    expect(saveStateMessage(state)).toBe('Saved on this computer · up to change 4')
  })

  it('survives a server restart in the middle without the user doing anything', () => {
    const state = play(
      openedSaveState(3),
      { kind: 'edit-started', targetRevision: 4 },
      { kind: 'failed', refusal: 'SERVER_UNAVAILABLE' },
      { kind: 'retry-started' },
      { kind: 'persisted', revision: 4 },
    )
    expect(state.status).toBe('saved')
    expect(state.persistedRevision).toBe(4)
  })
})
