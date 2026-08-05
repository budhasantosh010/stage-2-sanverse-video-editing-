/**
 * What is actually happening to the user's saved work, said out loud.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────────
 *
 * The whole of saving had four words for itself: idle, saving, saved, error.
 * "error" was shown to the user as:
 *
 *     Local save needs attention
 *
 * That sentence is a dead end. It does not say what went wrong, it does not say
 * whether the work is lost, it does not say whether anything is being done about
 * it, and there is nothing to press. It also never went away on its own, because
 * nothing ever tried again. A user seeing it can only guess, and the safest
 * guess — "my work is gone" — is usually wrong, which makes it worse.
 *
 * The four words also could not tell apart things that need completely different
 * responses from the user:
 *
 *   the wifi dropped                → wait; it will fix itself
 *   the local server is not running → start it; nothing is lost
 *   somebody else changed the file  → decide which version wins
 *   the disk is full                → free space, then press Retry
 *
 * ── WHAT THIS FILE IS ────────────────────────────────────────────────────────
 *
 * One place that owns the answer to "is my work safe?". It is a pure state
 * machine: an event goes in, a new state comes out, and the same event always
 * produces the same result. Nothing here touches the network, a timer or the
 * screen, which is what makes every one of these situations testable without
 * having to actually unplug anything.
 *
 * ── THE RULE THAT MATTERS MOST ───────────────────────────────────────────────
 *
 * Every state carries `persistedRevision` — the number of the last version that
 * genuinely reached the disk. That number is the honest answer to "how much of
 * my work is safe", and it is shown to the user rather than kept for
 * engineers. It is also the reason a failure is not frightening: the work up to
 * that revision is on disk whatever happens next.
 *
 * A revision is just a counter. Every accepted edit makes the project's revision
 * go up by one, so "saved up to revision 12" means the first twelve edits are on
 * disk. Undo is itself an edit, so it also moves the number forward.
 */

/** The closed list of reasons a save can fail. Nothing else is allowed. */
export const SAVE_REFUSALS = Object.freeze([
  'NETWORK_UNAVAILABLE',
  'SERVER_UNAVAILABLE',
  'REVISION_CONFLICT',
  'WRITE_FAILED',
  'PROJECT_MISSING',
  'RESPONSE_INVALID',
  'SAVE_CANCELLED',
] as const)
export type SaveRefusal = (typeof SAVE_REFUSALS)[number]

export type SaveStateV1 =
  | Readonly<{ status: 'saved'; persistedRevision: number }>
  | Readonly<{ status: 'saving'; targetRevision: number; persistedRevision: number }>
  | Readonly<{ status: 'retrying'; targetRevision: number; persistedRevision: number; attempt: number }>
  | Readonly<{ status: 'offline'; targetRevision: number; persistedRevision: number }>
  | Readonly<{
      status: 'conflict'
      targetRevision: number
      persistedRevision: number
      serverRevision: number
    }>
  | Readonly<{
      status: 'failed'
      targetRevision: number
      persistedRevision: number
      refusal: SaveRefusal
    }>

export type SaveEvent =
  | Readonly<{ kind: 'edit-started'; targetRevision: number }>
  | Readonly<{ kind: 'persisted'; revision: number }>
  | Readonly<{ kind: 'failed'; refusal: SaveRefusal; serverRevision?: number }>
  | Readonly<{ kind: 'retry-scheduled' }>
  | Readonly<{ kind: 'retry-started' }>
  | Readonly<{ kind: 'connection-restored' }>

/** The first state of a project that has just been opened from disk. */
export const openedSaveState = (persistedRevision: number): SaveStateV1 =>
  Object.freeze({ status: 'saved' as const, persistedRevision })

/**
 * How many times to try again on our own before asking the user.
 *
 * Three, then stop. Trying forever hides a real problem behind a spinner that
 * never ends, and each attempt is a write the user did not ask for. Three
 * attempts covers the overwhelmingly common case — a laptop lid closed for a
 * moment, a dev server restarting — and anything that survives three attempts is
 * a real problem the user should be told about rather than spun at.
 */
export const MAX_AUTOMATIC_SAVE_ATTEMPTS = 3

/**
 * How long to wait before trying again, in milliseconds: 400, 1200, 3600.
 *
 * Each wait is three times the last. Retrying immediately and repeatedly is what
 * turns one server hiccup into a burst of writes at the exact moment the server
 * is least able to cope; backing off gives it room. Returns null once the
 * automatic attempts are used up, which is the signal to ask the user.
 */
export const saveRetryDelayMs = (attempt: number): number | null => {
  if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt > MAX_AUTOMATIC_SAVE_ATTEMPTS) return null
  return 400 * 3 ** (attempt - 1)
}

/**
 * Whether trying the exact same save again could reasonably work.
 *
 * A dropped connection or a server that was restarting: yes, and the user should
 * not have to do anything. A conflict, a missing project, or a reply we could
 * not understand: no — repeating it would fail identically forever, and a
 * spinner that never resolves is a worse lie than an error.
 */
export const isRecoverableRefusal = (refusal: SaveRefusal): boolean =>
  refusal === 'NETWORK_UNAVAILABLE' || refusal === 'SERVER_UNAVAILABLE' || refusal === 'WRITE_FAILED'

/**
 * Turn whatever went wrong into one of the closed reasons.
 *
 * Deliberately reads only the SHAPE of the failure — the kind of error and, for
 * a refusal the server sent us, its code. It never reads the server's own words
 * and never puts them on screen, because those words are not ours to trust and
 * are not written for the person reading them.
 */
export const classifySaveFailure = (
  error: unknown,
  online: boolean,
): SaveRefusal => {
  if (!online) return 'NETWORK_UNAVAILABLE'
  if (error instanceof DOMException && error.name === 'AbortError') return 'SAVE_CANCELLED'
  const code = (error as { code?: unknown } | null)?.code
  if (code === 'REVISION_CONFLICT') return 'REVISION_CONFLICT'
  if (code === 'PROJECT_MISSING') return 'PROJECT_MISSING'
  if (code === 'WRITE_FAILED') return 'WRITE_FAILED'
  if (code === 'RESPONSE_INVALID') return 'RESPONSE_INVALID'
  // A fetch that never reached a server throws a TypeError; anything that came
  // back with an answer we could not use is the server's problem, not the wire's.
  if (error instanceof TypeError) return 'SERVER_UNAVAILABLE'
  return 'WRITE_FAILED'
}

/**
 * The state machine.
 *
 * Two rules are load-bearing and are the reason this is not written inline:
 *
 *  1. `persistedRevision` NEVER goes backwards. It is the high-water mark of
 *     what reached the disk, so a late reply from an older save cannot make the
 *     user believe less of their work is safe than actually is.
 *
 *  2. A success always lands on 'saved', from every failure state. Without that
 *     the warning would be sticky: the save that fixed itself would still be
 *     wearing the message from the one that failed, which is exactly how
 *     "Local save needs attention" became permanent.
 */
export const nextSaveState = (current: SaveStateV1, event: SaveEvent): SaveStateV1 => {
  const persisted = current.persistedRevision

  switch (event.kind) {
    case 'edit-started':
      return Object.freeze({
        status: 'saving' as const,
        targetRevision: event.targetRevision,
        persistedRevision: persisted,
      })

    case 'persisted':
      // Rule 1: never move the high-water mark down.
      return Object.freeze({
        status: 'saved' as const,
        persistedRevision: Math.max(persisted, event.revision),
      })

    case 'failed': {
      const targetRevision = current.status === 'saved' ? persisted : current.targetRevision
      if (event.refusal === 'REVISION_CONFLICT') {
        return Object.freeze({
          status: 'conflict' as const,
          targetRevision,
          persistedRevision: persisted,
          // Without a number from the server, the safest thing to claim is that
          // it is at least one ahead of us — which is what a conflict means.
          serverRevision: event.serverRevision ?? persisted + 1,
        })
      }
      if (event.refusal === 'NETWORK_UNAVAILABLE') {
        return Object.freeze({ status: 'offline' as const, targetRevision, persistedRevision: persisted })
      }
      return Object.freeze({
        status: 'failed' as const,
        targetRevision,
        persistedRevision: persisted,
        refusal: event.refusal,
      })
    }

    case 'retry-scheduled':
    case 'retry-started': {
      if (current.status === 'saved') return current
      const attempt = current.status === 'retrying' && event.kind === 'retry-started'
        ? current.attempt + 1
        : current.status === 'retrying' ? current.attempt : 1
      return Object.freeze({
        status: 'retrying' as const,
        targetRevision: current.targetRevision,
        persistedRevision: persisted,
        attempt,
      })
    }

    case 'connection-restored':
      if (current.status !== 'offline') return current
      return Object.freeze({
        status: 'retrying' as const,
        targetRevision: current.targetRevision,
        persistedRevision: persisted,
        attempt: 1,
      })
  }
}

/**
 * What the user reads, in the top bar.
 *
 * Every one of these says three things: what is happening, how much is already
 * safe, and — where there is one — what to do. None of them says "attention".
 */
export const saveStateMessage = (state: SaveStateV1): string => {
  switch (state.status) {
    case 'saved':
      return state.persistedRevision === 0
        ? 'Saved on this computer'
        : `Saved on this computer · up to change ${state.persistedRevision}`
    case 'saving':
      return 'Saving…'
    case 'retrying':
      return `Saving did not work. Trying again (${state.attempt} of ${MAX_AUTOMATIC_SAVE_ATTEMPTS}) · ` +
        `change ${state.persistedRevision} is already saved`
    case 'offline':
      return `No connection, so this change is not saved yet · ` +
        `change ${state.persistedRevision} is already saved`
    case 'conflict':
      return `This project was changed somewhere else, so this change was not saved · ` +
        `change ${state.persistedRevision} is already saved`
    case 'failed':
      return `${saveRefusalMessage(state.refusal)} · change ${state.persistedRevision} is already saved`
  }
}

/**
 * Why a save failed, in words that point somewhere.
 *
 * No stack traces, no file paths, no server text. A path in a message tells the
 * user nothing they can use and tells anyone looking over their shoulder where
 * their files live.
 */
export const saveRefusalMessage = (refusal: SaveRefusal): string => {
  switch (refusal) {
    case 'NETWORK_UNAVAILABLE':
      return 'There is no connection, so this change is not saved yet'
    case 'SERVER_UNAVAILABLE':
      return 'Sanverse is not answering, so this change is not saved yet'
    case 'REVISION_CONFLICT':
      return 'This project was changed somewhere else, so this change was not saved'
    case 'WRITE_FAILED':
      return 'This change could not be written to your computer'
    case 'PROJECT_MISSING':
      return 'This project could not be found on your computer'
    case 'RESPONSE_INVALID':
      return 'Sanverse gave an answer that could not be used, so nothing was changed'
    case 'SAVE_CANCELLED':
      return 'Saving was stopped, so this change was not saved'
  }
}

/** Whether to offer a Retry button. Never offered while something is in flight. */
export const saveStateOffersRetry = (state: SaveStateV1): boolean =>
  state.status === 'conflict' || state.status === 'offline' ||
  (state.status === 'failed' && state.refusal !== 'PROJECT_MISSING')

/**
 * Whether closing the tab right now would lose work.
 *
 * Only true when there really is something unsaved. Warning on every close —
 * including when everything is safely on disk — trains people to click through
 * the warning without reading it, which makes it useless on the one day it
 * matters.
 */
export const isUnsafeToLeave = (state: SaveStateV1): boolean =>
  state.status !== 'saved' && state.targetRevision > state.persistedRevision

/** Whether the state is one the user has to do something about. */
export const saveStateNeedsUser = (state: SaveStateV1): boolean =>
  state.status === 'conflict' || state.status === 'failed'
