# Gate B1 — test results

Run 2026-08-03 on Windows. Heavy suites run sequentially (`--pool=forks
--poolOptions.forks.singleFork=true`) because parallel runs on this machine
produce false timeouts.

---

## Totals

```
  apps/web                 667 passed   (84 files)
  packages/edit-domain     312 passed   (26 files)
  apps/api                 248 passed   (21 files)
  packages/render-contract  65 passed   ( 7 files)
  packages/intent-domain    27 passed   ( 3 files)
  ──────────────────────────────────────────────
  TOTAL                  1,319 passed
```

```
  program floor          1,176
  Gate A                 1,203
  Gate B                 1,283
  Gate B1                1,319      +36
```

No assertion was weakened. All-workspace `npm run build` (which type-checks test
files too — `vitest` alone does not): **clean**.

---

## The 36 new tests

| suite | tests | what it holds |
|---|---|---|
| `editor/monitor/monitor-base-layer.test.ts` | 15 | one layer decision; native video is the fallback, never black; stale / wrong-asset / wrong-geometry frames refused; retained through seek and playback; **the input type has no pointer field, asserted by walking its keys** |
| `editor/layout-v2/studio-responsive-authority.test.ts` | 10 | the exact boundary pixel, every width band, the stylesheet's real query strings read off disk, no second `max-width` rule above the breakpoint, live width re-read, subscribe/unsubscribe, matchMedia present and absent |
| `screens/studio/StudioPreviewNoHover.test.tsx` | 6 | no pointer-state selector touches a base picture layer; no `opacity`/`visibility`/`display` changes from a pointer state anywhere in Studio; the deleted rule named explicitly; no `!important` on the canvas; the off-switch actually works |
| `screens/studio/StudioResponsiveContinuity.test.tsx` | 5 | 1440→1024→1280→1440 with no reload; the switch at exactly 1100 not 1099; Media reachable at 15 widths down and back; typed search survives; resizing creates no edit and no revision |

### Three tests worth calling out

**"takes no pointer input at all"** walks the keys of the resolver's input
object and fails if any is named for hover, focus, pointer, or mouse. The
regression it guards is not a value being wrong — it is a *category of input*
coming back.

**"has no second stylesheet rule that can hide a dock at a width the code calls
roomy"** reads the real `.css` files and extracts every `@media`/`@container`
`max-width` condition. Any rule above 1100px would be a rule the code cannot
see, which is the precise shape of FAIL-047.

**"keeps the Media panel reachable at every width on the way down and back up"**
walks 15 widths and asserts that at each one *either* the docked control *or*
the compact replacement exists. It cannot be satisfied by a gap.

### Tests that changed, and why

`features/render-plan/footage-motion-preview.test.ts` had six assertions on
`canvas.hidden`. That attribute was the broken mechanism — the stylesheet
overrode it — so those assertions were testing a switch that did nothing. They
now assert on the **frame token**, which is strictly stronger: not "is something
there" but "*which* frame, of *which* asset, at *which* geometry".

```
  before   expect(canvas.hidden).toBe(false)
  after    expect(footageMotionDrawnToken(canvas))
             .toBe('asset_aaaaaaaa|10080000|10080000|motion_web00001|0')
```

`editor/media/MediaLibraryV2.test.tsx` had one breakpoint constant change,
220px → 280px, because a real browser measurement showed the header's words
needed about 271px and were being clipped at 228px. The assertion itself is
unchanged in kind.

---

## Windows flakiness — named, not hidden

Running the web suite in parallel still produces 1–3 failures that pass alone
every time (`DisabledAction`, `App`, `StudioMediaBinIntegration`). Run
sequentially, all 84 files and 667 tests pass with zero failures. This is the
machine, not the code.

---

## What the tests do not prove

Per the standing rule that passing tests are not proof the product works: the
browser evidence is in `gate-b1-preview-base-layer.md`, and that document states
plainly the three things it did **not** prove — chiefly that a real pointer
hover could not be produced in this session's browser pane at all.
