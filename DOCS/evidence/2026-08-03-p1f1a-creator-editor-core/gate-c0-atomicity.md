# Gate C0 — a change set is all of it or none of it

P1-F.1A Gate C0. Written 2026-08-04.

---

## The defect, in one picture

A change set is one approved request. "Tighten my intro" might be a cut plus a
title, but the user approved **one thing**, so one Undo must reverse all of it.

The replay had two passes:

```
  PASS ONE   what the video is MADE OF     → applies the cuts
  PASS TWO   what is DRAWN on it           → judges the overlays
```

Pass two ran *after* pass one, and its verdict could not reach back:

```
  a change set holding [ cut , overlay ]

  pass one   cut applied      →  the footage is now shorter
  pass two   overlay refused  →  the whole set marked "blocked"

  result     blocked sets contribute NOTHING to the operation list…
             …but the cut is already baked into the footage.

             The video is 2 seconds shorter than the history says it is.
```

The user gets an error message and a changed video at the same time, and no
Undo they press is the one they want — because the project never recorded the
cut as something that happened.

**Nothing in the product creates such a set today.** That is why it survived.
**Gate C1 creates them by design:** an insert is a placement plus a ripple; a
linked placement is a picture plus its sound.

---

## What was already safe, and what was not

This matters, because it changes what the fix had to be.

```
  ACCEPTING a new change set        ALREADY SAFE
    acceptChangeSet replayed the whole thing, saw the refusal, and returned
    an error. The caller kept the old project. Nothing was written.

  REPLAYING the accepted history    BROKEN
    A set accepted while valid, made invalid by a LATER edit, kept its cut in
    the footage while reporting blocked.
```

Proved by disabling the fix and re-running the new tests: **2 of 24 failed**,
both in the "retraction" group. The other 22 pass either way. That is the honest
size of the defect — not "everything was broken", but "one specific thing was,
and it is the one Gate C1 was about to rely on".

---

## The fix — refusal retracts

`evaluateProject` now runs the replay repeatedly:

```
  round 1   replay everything
            → any set REFUSED that contributed cuts is recorded as retracted
  round 2   replay again with those sets contributing nothing at all
            → repeat until a round refuses nothing new
```

### Why this cannot spin forever

Refusal only ever **grows**. A set refused in one round is never revived in a
later one, and there are finitely many sets, so the loop ends in at most one
round per change set. In practice it ends in **one** round, because a set has to
contain both a cut and an overlay to trigger a second one — and until Gate C1,
none do. **Projects that exist today do exactly as much work as before.**

The original code carried a comment warning against exactly this loop:

> remove a cut → an overlay becomes valid → re-apply the cut → the overlay
> breaks again — a loop with no settled answer

That loop needs *un-refusing* to start. Nothing here un-refuses. The warning was
right about the danger and the fix avoids it by construction rather than by
avoiding the problem.

### The one case conservatism decides

A change set whose **own** cut removes the footage its **own** overlay sits on
is self-contradictory. It stays refused rather than being accepted with its cut
quietly dropped. Stated here because it is a real choice, not an oversight: the
alternative is a saved edit that silently does less than it says.

---

## The other four pieces of C0

| section | what it adds |
|---|---|
| C0.1 | `AtomicChangeSetResult` — a closed two-case answer: `accepted` with a project and a revision, or `blocked` with the **original** project, the unchanged revision, and `failedOperationIndex` |
| C0.3 | immutability held by a byte-equality test: serialize, evaluate a refused request, serialize again, compare |
| C0.4 | `createIdFactory(changeSetId)` — names derived by hash from the change set, so validating and committing agree, and a refused draft burns no ID |
| C0.5 | the server already loaded → evaluated → persisted only on success, and the write is already temp-file → fsync → rename → directory sync. Now it also reports **which** operation refused |

### Why the ID factory is not `randomUUID()`

Two reasons, both about the user rather than about tidiness:

1. **A refused draft must not burn a name.** With random names, checking a plan
   and then saving it produce different IDs, so the thing shown is not the thing
   saved.
2. **The same gesture on the same project must produce the same project.** That
   is what lets a retry after a dropped connection be recognised as the same
   edit rather than a second one.

---

## Real-browser proof

Real project, real 30.033-second media, running server, 2026-08-04.

**The number that matters is the one the app displays**, not `project.composition`
— that field is the footage *as imported* and by design never changes. Measuring
it would have proved nothing. The timeline readout is computed from the effective
composition, which is what the export uses.

### A mixed request is refused and changes nothing

```
  POST a set of [ 5-second cut , title on an asset the project does not hold ]

  HTTP                    400  CHANGE_SET_REJECTED
  revision                7 → 7
  change sets             1 → 1
  operations              2 → 2
  duration on screen      00:00:28:01 → 00:00:28:01     ← the cut did NOT land
  refused title visible   no
```

Had the cut landed, the readout would have been about 00:00:23. It was not.

### A valid two-operation request is one of everything

```
  POST a set of [ 2-second cut , title on real footage ]

  HTTP                201
  revision            4 → 5          one revision, not two
  change sets         0 → 1          one history entry
  operations in it    2
  duration on screen  00:00:28:01    30.033s − 2s, to the frame
  Changes panel       "Shortened by 2.0s and closed the gap"  Accepted
                      "Title: C0 proof"                       Accepted

  one Undo   → 0 change sets, both gone
  one Redo   → 1 change set, both back, 2 operations
  full reload→ 00:00:28:01, both present, the refused one absent
```

Console errors during all of it: **0**.

The owner's project was returned to 0 change sets afterwards. Its revision is
now 8 rather than 4, because Undo is itself a revision — the project content is
as it was, the counter is not, and that is how the design works.

---

## Tests

```
  packages/edit-domain   312 → 336    +24  (atomic-change-set.test.ts)
  apps/api               248 → 255    + 7  (project-state-atomicity.test.ts)
  render-contract         65          unchanged
  intent-domain           27          unchanged
  apps/web               667          unchanged
  ─────────────────────────────────────────
  TOTAL                1,319 → 1,350  +31
```

Covering the required matrix A–N. No assertion weakened, nothing skipped.
All-workspace `npm run build` (which type-checks test files, unlike `vitest`
alone): exit 0.

---

## What this does NOT prove

- No export was rendered in this gate, so preview/export parity for a compound
  edit is held by the existing render-contract suite, not by a new MP4.
- The retraction path was exercised in the browser only through a *refused*
  request. The "accepted while valid, invalidated later" path is proved by unit
  test, not by a browser walkthrough.
- No screenshots. The browser pane does not composite frames in this
  environment, so every number above is read from the live DOM and the API.
