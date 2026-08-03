# Gate B — test results

Run 2026-08-03 on Windows. Heavy suites run sequentially (`--pool=forks
--poolOptions.forks.singleFork=true`) because parallel runs on this machine
produce false timeouts.

---

## Totals

```
  apps/web                631 passed   (80 files)
  packages/edit-domain    312 passed   (26 files)
  apps/api                248 passed   (21 files)
  packages/render-contract 65 passed   ( 7 files)
  packages/intent-domain   27 passed   ( 3 files)
  ─────────────────────────────────────────────────
  TOTAL                 1,283 passed
```

```
  program floor          1,176
  Gate A baseline        1,203
  Gate B final           1,283      +80
```

No assertion was weakened. No test was changed to accept a regression.

All-workspace production build (`npm run build`, which type-checks test files
too — `vitest` alone does not): **clean**.

---

## The 80 new tests

### Domain and API — 20, committed in the Gate B checkpoint

| suite | tests | what it holds |
|---|---|---|
| `packages/edit-domain/src/media-organization.test.ts` | 13 | the closed `sanverse.media-organization/v1` shape, five validated commands, refusals, deleting a folder returns its assets to the top level |
| `apps/api/src/projects/media-organization-service.test.ts` | 7 | durable read/write, corrupt file refused with the bytes left on disk, and a **byte-identical render plan** after all five commands |

### Web — 60, this half of the gate

| suite | tests | what it holds |
|---|---|---|
| `features/media/media-sort.test.ts` | 8 | four fields, both directions, ties never reshuffle, the input list is never mutated |
| `features/media/media-drag-contract.test.ts` | 12 | exactly four keys; every invalid shape refused; extra keys refused; **no path, URL, project or asset object on the wire**; the affordance is off before Gate C |
| `features/media/media-import-kinds.test.ts` | 9 | four truthful accept filters, "All supported" is a union not a wildcard, mixed drops report each refusal individually |
| `features/media/media-presentation.test.ts` | 8 | search capped where stored, one change at a time, folder falls back to All media when it disappears, folder→kind→words→order composition |
| `features/media/media-organization-client.test.ts` | 6 | a corrupt or unrecognised answer is refused rather than shown as your filing; server refusals pass through in the server's own words |
| `editor/media/MediaLibraryV2.test.tsx` | 23 | density, responsiveness, import, OS drop, folders end to end, continuity, row contents |
| `editor/media/MediaBin.test.tsx` | 8 (existing) | updated for the new structure; assertions kept or strengthened |

---

## Tests worth calling out

**"scrolls the results and nothing else"** reads `MediaBin.css` as text and
asserts there is exactly **one** rule in the entire file with
`overflow-y: auto`, and that it is `.media-bin__results`. jsdom does not
evaluate container queries, so asserting on the stylesheet source is the only
honest way to hold a CSS-decided rule.

**"keeps every control at a size a person can actually hit"** walks every
`min-height` in the stylesheet and fails if any is below 26px.

**"keeps search, filter, sort and folder through a workspace switch that
unmounts the panel"** genuinely removes the panel from the tree and puts it
back — which is what a workspace switch does — and then checks the search box
still says `logo`, the Image filter is still pressed, the sort still reads
`Name, Z to A`, and the folder is still `B-roll`. State held inside the panel
would silently vanish here.

**"never lets two folder commands race"** fires three clicks on Create before
the first request resolves and asserts exactly **one** POST left the browser.

**"offers no visible drag affordance while the Timeline cannot accept one"**
asserts every row has neither `draggable` nor `aria-grabbed`, so the switched-off
gesture cannot quietly ship.

**"changes nothing about the project, the revision, the history, or the render"**
(API) serialises the project and the compiled render plan before and after all
five folder commands and requires both strings to be identical.

---

## Windows flakiness — named, not hidden

Running the web suite **in parallel** produced 3 failures that pass on their own
every time (`App.test.tsx` ×2, `StudioMediaBinIntegration`, and once
`AssistProposalPanel`). Run sequentially, the same 80 files and 631 tests pass
with zero failures. This is the machine, not the code, and it is why the program
says to run heavy suites sequentially on Windows.

---

## What the tests do not prove

Per the standing rule that passing tests are not proof the product works: the
tests above hold contracts and structure. The evidence that Gate B actually
works on real media, on the real server, is in `media-browser-walkthrough.md`
— and that document also states, plainly, the three things it did not prove.
