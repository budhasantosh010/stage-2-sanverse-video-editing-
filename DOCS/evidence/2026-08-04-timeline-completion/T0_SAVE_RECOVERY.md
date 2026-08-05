# T0.6 — Telling the user what actually happened to their work

2026-08-05 · Gate T0

## What was wrong

Saving had four words for itself: `idle`, `saving`, `saved`, `error`. The user
saw `error` as:

```
Local save needs attention
```

That sentence is a dead end.

- It does not say what went wrong.
- It does not say whether the work is lost.
- It does not say whether anything is being done about it.
- There is nothing to press.
- It never went away on its own, because nothing ever tried again.

A user seeing it can only guess, and the safest guess — "my work is gone" — is
usually wrong, which makes it worse.

Four words also cannot separate situations that need completely different
responses from the person reading them:

```
  the wifi dropped                 -> wait; it will fix itself
  the local server is not running  -> start it; nothing is lost
  the project changed elsewhere    -> decide which version wins
  the disk is full                 -> free space, then press Retry
```

## What replaced it

`apps/web/src/features/save/save-state.ts` — one pure state machine. An event
goes in, a new state comes out, the same event always gives the same result.
Nothing in it touches the network, a timer or the screen, which is what makes
every one of these situations testable without actually unplugging anything.

```
  saved  --edit-->  saving  --ok-------------------->  saved
                       |
                       +--recoverable--> retrying --ok--> saved
                       |                    |
                       |                (3 tries)
                       |                    v
                       +--offline----->  offline  --online--> retrying
                       |
                       +--conflict---->  conflict
                       |
                       +--other------->  failed
```

### The rule that matters most

**Every state carries `persistedRevision`** — the number of the last version
that genuinely reached the disk. It is shown to the user rather than kept for
engineers, because it is the honest answer to the only question they actually
have. A revision is just a counter: every accepted edit moves it up by one, so
"saved up to change 12" means the first twelve edits are on disk.

That number is why a failure stops being frightening:

```
Saving did not work. Trying again (2 of 3) · change 12 is already saved
```

is the difference between "something is wrong" and "something is wrong AND my
afternoon is not gone".

### Two invariants, held by tests

1. **`persistedRevision` never goes backwards.** Saves are sent one at a time,
   but a reply can still arrive after a newer one. If the number went down the
   user would watch their saved work apparently shrink.
2. **Success always lands on `saved`, from every failure state.** Without that
   the warning is sticky: a save that fixed itself would still be wearing the
   message from the one that failed. That is exactly how the old message became
   permanent.

### Trying again

Three automatic attempts, waiting **400 ms, 1200 ms, 3600 ms** — each wait three
times the last. Then it stops and asks.

- Retrying forever hides a real problem behind a spinner that never ends.
- Retrying immediately and repeatedly turns one server hiccup into a burst of
  writes at the exact moment the server is least able to cope.
- Three attempts covers the overwhelmingly common cases: a laptop lid closed for
  a moment, a dev server restarting.

Only failures where the same request could genuinely work next time are retried:
no connection, server not answering, a write that did not land. A conflict, a
missing project, or a reply we could not understand are **not** retried, because
repeating them would fail identically forever.

A save also picks itself back up on its own the moment the connection returns.

### Closed refusal reasons

`NETWORK_UNAVAILABLE` · `SERVER_UNAVAILABLE` · `REVISION_CONFLICT` ·
`WRITE_FAILED` · `PROJECT_MISSING` · `RESPONSE_INVALID` · `SAVE_CANCELLED`

The server's own words are **never** repeated to the user and never logged. They
are not written for the person reading them and they are not ours to trust. A
test drives a disk-full error carrying a real file path through the classifier
and asserts that neither the code nor the path reaches the screen.

### Closing the tab

A warning appears only when there is genuinely something unsaved. Warning on
every close trains people to click through without reading, which makes the
warning useless on the one day it matters.

## Proof

25 tests in `save-state.test.ts`, plus the real browser:

```
Saved on this computer · up to change 21
```

read from the running app's top bar, on the owner's real project.

## What is not covered

The wording is now truthful and there is always something to press, but a
`conflict` still needs the user to choose which version wins, and that chooser
does not exist yet. The state is reported and both revision numbers are kept so
neither side can be thrown away silently, but the resolution screen is later
work. Stated rather than hidden.
