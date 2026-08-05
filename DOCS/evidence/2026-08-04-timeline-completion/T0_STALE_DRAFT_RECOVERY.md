# T0.5 — A proposal that survives the project moving underneath it

2026-08-05 · Gate T0

## What was wrong

A proposal is an edit that has been worked out but not yet approved. It sits on
screen waiting for the user to press Accept. While it sits there the project can
change — the user trims a clip, presses Undo, drags something.

The proposal was worked out against the project as it was a moment ago, so when
the user finally pressed Accept the server saw the revisions differ and refused:

```
This project changed while that edit was being prepared.
Reopen it and try again.
```

**"Reopen it" is an enormous thing to ask.** It means leaving the editor, going
back to the project list, opening the project again, and finding your place —
for something completely routine. Making a normal edit while a proposal is on
screen is not a mistake; it is how people work.

## Why most of those refusals were unnecessary

A proposal does not name a clip. It names a piece of the **original recording**:
"the nameplate goes over the stretch of the recording from 4 s to 9 s". Where
that stretch currently sits in the finished video is worked out fresh, every
time, from the current project.

So almost every edit a user can make leaves the proposal perfectly answerable.
Trimming a different clip, moving something, muting a track, pressing Undo — none
of them change what "4 s to 9 s of that recording" means.

```
  the project moves from revision 11 to revision 12
         |
         +-- has this edit already been applied?         yes --> cancel
         |                                                no
         +-- does the recording it names still exist?     no  --> cancel
         |                                               yes
         +-- does that stretch still appear in the video? no  --> cancel
         |                                               yes
         +-- is it still a valid edit on its own?         no  --> cancel
         |                                               yes
         +---------------------------------------> carry it forward
```

Carrying forward is a **re-check, not a rewrite**. Every word the user typed and
every position they chose comes out the other side identical. A test asserts the
proposal object is the same object.

## The rule that must not be broken

If the thing a proposal named is gone, the proposal is **cancelled**. It is
never quietly re-pointed at some other clip that happens to be nearby.

Approving something and getting it applied somewhere else is far worse than
being told it could not be applied — the user would have to notice the
difference themselves, and they would have no reason to look.

## What is cancelled, and what the user reads

| reason | message | ask again? |
|---|---|---|
| `TARGET_SOURCE_REMOVED` | That proposal was about a clip that is no longer in this project, so it was cancelled. Nothing else changed. | yes |
| `TARGET_INTERVAL_REMOVED` | The part of the video that proposal was about has been cut out, so it was cancelled. Nothing else changed. | yes |
| `EDIT_NO_LONGER_VALID` | That proposal no longer fits this project, so it was cancelled. Nothing else changed. | yes |
| `EDIT_ID_ALREADY_USED` | That proposal had already been applied, so it was not applied a second time. | no |
| `PROJECT_REPLACED` | You are now in a different project, so that proposal was cancelled. | yes |

Every one of them says **"Nothing else changed"** where that is true. A user who
has just been told something was cancelled needs to know the blast radius
immediately, not have to go and check.

None of them says "reopen". A test asserts that.

## What this is structurally unable to do

`reconcileDetachedDraft` reads the proposal and the project and returns a
decision. **It does not return a project.** There is no route by which it could
write anything back, so the worst it can do to a user's work is say "cancelled".

## Also changed

The conflict message itself, for the case where an edit genuinely could not be
applied:

> This project changed while that edit was being prepared, so the edit was not
> applied. Everything else is safe — try it again.

## Proof

14 tests in `draft-reconciliation.test.ts`.

## What is not covered

Only the nameplate family can be a pending proposal today; every other family is
accepted directly rather than staged. So the reconciliation is complete for what
exists, and will need extending as more families become stageable. Stated rather
than implied.
