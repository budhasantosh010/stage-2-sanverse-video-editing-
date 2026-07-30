# P1-A gesture matrix

The adapter is pure. It returns one existing operation or one typed refusal. It never creates a change set, applies an operation, writes state, calls the API, or changes history.

| Gesture | Existing builder | Existing operation | Main refusal cases |
|---|---|---|---|
| `split` | `buildSplitAtPlayhead` | `split-clip` | non-integer/negative tick, gap, clip edge, domain dry-run refusal |
| `remove-ripple` | `buildRemoveAtPlayhead(..., true)` | `remove-clip` with `ripple: true` | invalid tick, gap, last remaining clip, domain refusal |
| `remove-gap` | `buildRemoveAtPlayhead(..., false)` | `remove-clip` with `ripple: false` | invalid tick, gap, last remaining clip, domain refusal |
| `trim-start` | `buildTrimAtPlayhead(..., 'start', ..., true)` | `trim-clip` | unknown clip, nonpositive amount, whole clip removed, domain refusal |
| `trim-end` | `buildTrimAtPlayhead(..., 'end', ..., true)` | `trim-clip` | unknown clip, nonpositive amount, whole clip removed, domain refusal |
| `set-enabled` | `buildSetEnabledAtPlayhead` | `set-clip-enabled` | unknown clip, already in requested state, hiding last visible clip |
| `move-earlier` | `buildMoveAtPlayhead(..., 'earlier')` | `reorder-clip` | unknown clip, already first, gapped track, domain refusal |
| `move-later` | `buildMoveAtPlayhead(..., 'later')` | `reorder-clip` | unknown clip, already last, gapped track, domain refusal |
| `set-audio` | `buildSetAudioAtPlayhead` | `set-clip-audio` | unknown clip, non-finite/out-of-range gain, invalid/excessive fades |

## Clip-ID gestures

Current builders address a clip through a composition playhead. For clip-ID gestures, the adapter resolves the current effective clip and chooses a deterministic tick strictly inside its half-open interval:

```text
clip start + min(max(1, floor(duration / 2)), duration - 1)
```

A one-tick clip has no safe interior tick and is refused. This prevents a boundary from selecting the next clip.

## Final safety gate

Every built operation is:

1. structurally checked by the existing domain validator;
2. dry-run through the existing pure timeline application function against the effective composition;
3. returned only when both checks succeed.

The dry run does not alter the project, revision, change sets, redo stack, or source media.