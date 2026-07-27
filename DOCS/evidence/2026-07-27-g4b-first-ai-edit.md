# G4-B evidence — the first AI-proposed edit, end to end

Date: 2026-07-27. Windows 10, Chrome-based preview pane, local API on 2001.
Provider: the deterministic **fake**. No network call was made.

Passing tests are not proof the product works. On 2026-07-25, 182 tests passed
while every new upload was broken. Everything below was done by driving the real
browser against a real file.

## What was exercised

`T2V_E21_O13_HollywoodPlus_NoLUT.mp4` — the owner's own 1920×1080 test video,
already carrying one hand-made nameplate accepted in an earlier session.

## 1. Asking without pointing produces a question, not a guess

Typed into the chat box, with nothing pointed at:

```
  add a nameplate saying "Santosh Budha" "Founder"
```

On screen:

```
  Where should it go? Choose Point, then click the spot.
```

No proposal appeared, nothing was saved, and the project file was untouched.
The middle of the frame would have been a plausible default and is usually the
speaker's face, so there is no safe default and the system asks.

## 2. Pointing, then asking, produces one pending proposal

Point mode, clicked the middle of the picture at 00:00.000, then:

```
  add a nameplate saying "Santosh Budha" "Founder" for 4 seconds
```

On screen, in the Proposal panel:

```
  Santosh Budha
  Founder
  Here · 00:00.000 · 4 seconds
  Suggested by the assistant
  Placed where you pointed.
```

The 4-second duration came from the sentence, overriding the 5-second default.
The position came from the click, not from the provider — which returned
`point: null` on purpose. The preview drew it immediately.

While a proposal is pending the chat box is closed, with the reason stated:
*"Accept or discard the pending proposal before asking for another edit."*

## 3. Repair, with no second request

Changed the main text from `Santosh Budha` to `Santosh` in the "Change it"
panel. The preview updated at once. No request was sent, and the proposal kept
its identity and its provenance.

## 4. What actually landed on disk

Read back from `edit-project.json` after Accept:

```
revision   6
changeSets 2

  changeset_5be91e2e16b7ff9f3e7b4c7fcf37c18f
     source    direct | requestId null
     text      "Sanverse Video editing" / "Edits for Busineses"
     interval  0 for 7200000 ticks = 5 s
     anchor    center  {"x":0.7477983544490482,"y":0.3344289112568517}

  changeset_48cab27babf84d03bfd1e2c962ecb654
     source    ai     | requestId request_8456a4c886df16af0e735b7972c99150
     text      "Santosh" / "Founder"
     interval  0 for 5760000 ticks = 4 s
     anchor    center  {"x":0.5009226037929267,"y":0.49861609431060994}
```

The earlier hand-made edit is still `direct`. The new one is `ai` and carries
the request that produced it — including after being repaired by hand, which is
the honest record: the assistant suggested it, the user changed it, the user
accepted it.

## 5. The exported file

Exported through the ordinary Export button. Result: **1920 × 1080, 15 s**,
verified MP4, downloadable.

Frames pulled from the exported file:

```
  at 2 s   "Santosh" / "Founder" drawn at the clicked point   <- inside the window
  at 6 s   nothing drawn                                       <- after the window
```

Console errors: none. Server errors: none.

## 6. The corpus, run on every test run

18 of 18 cases behave as recorded. 0 of the 8 adversarial cases produced a
change set of any kind. Detail in `DOCS/evaluations/nameplate-intent-v1.md`.

## 7. Owner-reported problem, fixed in the same slice

The owner reported that pressing Export "looked like it did nothing", and that
the download had to be found by scrolling to the bottom of the panel. The Export
button is at the top of the screen and its result was at the bottom. The result
now scrolls itself into view and takes focus when it is ready or when it fails.

## 8. What was NOT verified

- **No real model has ever been run.** Every result above is the deterministic
  fake. Schema adherence, latency, error shapes, timeouts, cancellation, and
  quota behaviour of any real provider are all unknown. That is G4B-10.
- **No data has ever left the machine**, so the outbound allowlist is proven by
  tests and by construction, not by watching real traffic.
- **Non-English input is untested.**
- **Two edits in one sentence** is not supported and not tested.
- The G4-A limitations still stand unchanged: the ~10 px plate-height
  difference, no colour/HDR handling, `-c:a copy` breaking at the first cut, and
  export speed.
