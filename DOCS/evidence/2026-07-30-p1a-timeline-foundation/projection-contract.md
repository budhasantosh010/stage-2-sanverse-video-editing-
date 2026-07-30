# P1-A timeline projection contract

Date: 2026-07-30

## Authority

```text
EditProject
  -> evaluateProject(project) exactly once
       -> effective composition
       -> active accepted operations
       -> evaluated blocked records
  -> domain folds for captions and overlays
  -> placeSourceSpan for source-to-composition placement
  -> immutable TimelineViewModel
```

`TimelineViewModel` is read-only presentation data. It is not serialized, does
not own history, and cannot apply an edit.

## Semantic lanes

| Order | ID | Kind | Label | Source |
|---:|---|---|---|---|
| 0 | `lane:overlay` | overlay | V2 | accepted/pending nameplates, titles, callouts, images and B-roll |
| 1 | `lane:video` | video | V1 | effective canonical video clips |
| 2 | `lane:caption` | caption | C1 | folded caption cues mapped through surviving footage |
| 3 | `lane:dialogue` | dialogue | A1 | read-only mirror of effective video clips and their audio state |
| 4 | `lane:music` | music | A2 | accepted/pending music operations only |

When the canonical composition contains more than one video track, the
projection creates deterministic per-domain-track video and dialogue lanes. It
does not discard the extra canonical track and does not pretend semantic lanes
are domain `Track` objects.

## Item identity

- Video: `clip:<clipId>`
- Dialogue: `dialogue:<clipId>`
- Gap: `gap:<laneId>:<startTicks>:<durationTicks>`
- Caption: `caption:<captionSetId>:<cueId>:<placementIndex>`
- Nameplate: `overlay:<operationId>:<placementIndex>`
- Title: `overlay:<titleId>:<placementIndex>`
- Callout: `overlay:<calloutId>:<placementIndex>`
- Media overlay: `overlay:<overlayId>:<placementIndex>`
- Music: `music:<musicId>:0`
- Proposal: `proposal:<proposalId>:<operationId>:<placementIndex>`

Entity IDs are used where the domain supplies them. Therefore repairing a title,
callout, media overlay, music bed, or caption cue does not replace its timeline
identity. The latest influencing operation ID and change-set ID remain separate
audit fields.

## Time spaces

- `startTicks` and `durationTicks`: finished-video composition time.
- `sourceStartTicks` and `sourceDurationTicks`: original media time.
- All values are safe integer project ticks at timescale 1,440,000.
- No canonical seconds or milliseconds exist in the model.
- Every interval remains half-open: `[start, start + duration)`.

## Gaps

Gaps are derived between sorted video clips. They are never clips, assets,
operations, history records, or persisted JSON. Zero and negative gaps are never
emitted. A ripple removal closes time and therefore produces no gap. A
non-ripple removal leaves an explicit `Gap` presentation item.

## Accepted, proposed and blocked work

- Committed items come only from active, unblocked, evaluated project output.
- Pending operations remain detached and use `state: proposed`.
- A stale pending base revision produces `PROPOSAL_STALE` and no current ghost.
- Blocked accepted records produce diagnostics and never successful committed
  items.
- A source span with no surviving enabled placement produces a diagnostic; it
  is never moved to tick zero or another invented moment.
- Visual-property tracks/effects are deliberately not a P1-A lane and produce
  `OPERATION_UNSUPPORTED`. P1-B/P1-C may present them later without changing the
  canonical project.

## Determinism and validation

Lane order, item order, and diagnostics have explicit sort rules. IDs contain no
randomness or current time. `validateTimelineViewModel` checks lane/item identity,
positive durations, safe placement, containing-lane references, and composition
bounds. Ordinary unsupported content returns structured diagnostics rather than
throwing.

## Consequence review

1. First order: P1-B receives truthful rows and exact placement.
2. Second order: selection survives repairs because entity IDs remain stable.
3. Third order: timeline UI can be replaced or virtualized without migrating
   projects or changing history.
4. Fourth order: future web/API/cloud clients can derive their own presentation
   from the same `EditProject`; no parallel timeline document needs syncing.
