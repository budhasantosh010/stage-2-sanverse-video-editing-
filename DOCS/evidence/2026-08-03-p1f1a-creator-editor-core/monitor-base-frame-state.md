# Monitor base-frame state (Gate A / A3)

`apps/web/src/editor/monitor/monitor-base-frame.ts`

## Why it exists

Before this, four completely different situations rendered as an identical
black rectangle, and nothing on screen distinguished them:

```
  intentional timeline gap  ·  still loading  ·  seeking  ·  genuinely broken
        └───────────────── all four rendered as black ─────────────────┘
```

The owner's recording is that ambiguity: base footage went black while the
monitor controls and an accepted overlay stayed visible, and the monitor could
not say which of the four it was.

## The contract

```ts
type MonitorBaseFrameState = 'loading' | 'ready' | 'seeking' | 'gap' | 'error'
```

Decided by one pure function of typed inputs, so the answer is testable without
a browser and cannot drift between the layer that paints and the label that
explains.

## Precedence, and why each step is in that position

| # | Condition | Result | Why here |
|---|---|---|---|
| 1 | `hasMediaError` | `error` | A real failure outranks everything. Reporting `gap` over a decode failure tells the user the black is intentional when it is not. |
| 2 | `!hasSource` | `loading` | No source at all is loading, not a gap. A gap is a statement about a timeline that exists. |
| 3 | `inCanonicalGap` | `gap` | Wins over readiness: black there is the correct output and matches the exported file exactly. |
| 4 | `seeking` | `seeking` if a frame was shown, else `loading` | `readyState` routinely drops below `HAVE_CURRENT_DATA` mid-seek. Checked before readiness, or every seek would report `loading` and blank the picture. |
| 5 | `readyState < HAVE_CURRENT_DATA` | `seeking` if a frame was shown, else `loading` | Below this level there is genuinely no picture yet. |
| 6 | motion active, canvas never held a frame | `loading` | A canvas holding a slightly stale but real frame stays `ready`: the user is looking at true pixels, one frame behind at worst. |
| 7 | otherwise | `ready` | |

## The structural rule (A6)

`showsGapLayer(state)` is the **only** expression anywhere that turns the black
gap layer on, and it returns true for exactly one state. A pause, a seek, a
waiting canvas, a panel resize, a metadata load, an overlay selection, or a
Fit/Fill change therefore cannot paint it — not by discipline, but because
there is no code path that could.

Proved by `monitor-base-frame.test.ts`, which runs every one of those
situations through `showsGapLayer` and asserts false, and by
`StudioPreviewReliability.test.tsx`, which asserts the layer is absent through
ten play/pause/seek/resize cycles.

## Readiness vocabulary

`apps/web/src/features/render-plan/media-readiness.ts` names the levels so no
bare number appears at a call site. The distinction that matters:

```
  HAVE_METADATA (1)      videoWidth and videoHeight are populated
                         ── but NOT ONE FRAME can be drawn yet ──
  HAVE_CURRENT_DATA (2)  a frame can actually be read out
```

Believing that "we know the size" means "we have a picture" is precisely what
allowed an empty canvas to be revealed over healthy footage. `hasDecodableFrame`
requires level 2.

## Messages

| State | Sentence |
|---|---|
| `ready` | *(nothing — a working preview must say nothing at all)* |
| `loading` | Loading frame… |
| `seeking` | Seeking… |
| `gap` | No media at this time |
| `error` | Preview unavailable |
