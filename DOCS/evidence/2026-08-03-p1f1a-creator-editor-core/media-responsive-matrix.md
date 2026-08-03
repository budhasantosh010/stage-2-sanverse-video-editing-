# Media panel at every width — measured, not guessed

Gate B of P1-F.1A. All numbers below were read out of the running browser on
2026-08-03 with `getBoundingClientRect()` and `getComputedStyle()`, not
estimated from the stylesheet.

---

## Why the panel's own width decides, not the window's

The Media panel can be narrow inside a wide monitor (a dragged-in pane) and wide
inside a small one (a mobile overlay filling the screen). Asking the window
would answer the wrong question, so the panel is a **CSS container** and asks
about itself.

---

## The four shapes

```
  WIDE       > 380px    Media · 5 assets      Import  Sort  Folder  ⋯
                        [All 5][Video 2][Image 2][Audio 1][Missing 0]

  STANDARD   301–380    Media · 5 assets      Import  Sort  Folder  ⋯
                        [All 5][Video 2][Image 2][Audio 1][More]
                                                          └── Missing folded in

  COMPACT    281–300    Media · 5 assets      Import  Sort  Folder  ⋯
                        [ Filter · Video                          ▾ ]
                                                          └── ONE button

  MINIMUM    ≤ 280      Media 5               +  ⇅  ▾  ⋯
                        [ ⚟•                                        ]
                                                          └── icon + dot
```

> **Changed in Gate B1: the icon breakpoint moved from 220px to 280px.**
> Measured in a real browser at a 228px panel, the header's words — "Media 5"
> plus Import, Sort, Folder and the overflow button — need about **271px**, and
> the overflow button was being pushed 2px past the panel edge and clipped. The
> switch to icons now happens at 280px, with a margin, rather than at the exact
> width where the words stop fitting.

**Never five equal squeezed buttons.** Below about 320px, five buttons get
roughly 55px each, the words clip to "Vid…" and "Ima…", and the control becomes
a guessing game. So the row is replaced, not shrunk.

Every one of those shapes writes the **same** filter value through the **same**
callback. There is one filter shown four ways — not four filters that have to be
kept in step, which is how a panel ends up saying "Video" in one place and
showing pictures in another. Confirmed live: choosing Audio in the compact menu
left the wide button reading `aria-pressed="true"` and the compact trigger
reading `Filter media, Audio selected`.

---

## Measured, live, by dragging the real Media pane

Window 1440×900, Studio workspace, the Media pane resized with its keyboard
separator:

| panel width | filter shape | row height | thumbnail | h-scroll | clipped controls |
|---|---|---|---|---|---|
| **418 px** | five buttons, incl. Missing | 58 px | 64 px | none | 0 |
| **352 px** | four buttons + More | 58 px | 46 px | none | 0 |
| **285 px** | one Filter button | 58 px | 40 px | none | 0 |
| **255 px** | one Filter button | 58 px | 40 px | none | 0 |

Against the density targets:

```
  control height    28–32px   ✓  every control ≥ 28px, none below
  asset row         48–60px   ✓  58px wide/standard, 48px compact
  thumbnail         40–48px   ✓  40px compact … 64px wide
  panel padding      6–8px    ✓  6–7px
  filename           ~12px    ✓  12px
  secondary text    10–11px   ✓  10px
```

Nothing shrinks below a 28px control height. Saving four pixels by making a
button unclickable is not a saving.

---

## At the four required window sizes

| window | how Media appears | panel width | shape | h-scroll |
|---|---|---|---|---|
| 1440×900 | left dock, resizable | 255–418 px | wide → compact as dragged | none |
| 1280×800 | overlay (see note) | 378 px | standard | none |
| 1024×768 | overlay via "Show Media" | 378 px | standard | none |
| 390×844 | overlay via "Show Media" | 364 px | standard | none, page included |

At every one of them: no clipped control, no horizontal scrolling of the panel
or of the page, and the results region was the only thing with `overflow-y:auto`.

---

## Two honest limits

**1. The ≤220px "minimum" branch is not reachable in today's Studio.**
The layout's Media pane snaps from about 255px straight to collapsed, so no real
width between 1 and 254 exists. The branch is written, and it is exercised by
tests, but it has never been seen on screen. Recorded rather than claimed.

**2. Screenshots could not be captured in this session.** The browser pane was
not displayed, so the page was not compositing frames and every screenshot
attempt timed out. Everything above is therefore *measured numbers read from the
live DOM* rather than pictures. That is weaker evidence for "does it look right"
and identical evidence for "is it laid out right".

---

## Gate B1 re-measurement, 2026-08-03

Same project, same real media, after the density refinement. Measured live:

| panel width | row height | thumbnail | smallest control | clipped controls | h-scroll |
|---|---|---|---|---|---|
| **228 px** *(before the fix)* | 58 px | 40×28 | 28 px | **1 — the ⋯ button, 2px past the edge** | **yes** |
| **228 px** *(after)* | **52 px** | 40×28 | 28 px | **0** | none |
| **268 px** | 52 px | 40×28 | 28 px | 0 | none |

Against the Gate B1 density targets:

```
  panel padding      6px      ✓  6px header, toolbar and results
  control height    28–30px   ✓  smallest measured control 28px
  asset row         48–54px   ✓  52px  (was 58px)
  thumbnail         40–44px   ✓  40px compact, 48px wide
  filename            12px    ✓
  secondary        10–11px    ✓  10px
```

The row came down from 58px to 52px by naming the line heights (16px for the
filename, 13px for the two detail lines) rather than by making any text smaller.
Only the empty space shrank.

**"1 result" is gone when it says nothing.** The results line now reads just
`All media` when nothing is narrowing the list, because the header two rows
above already says `Media · 5 assets`. The count returns the moment a search, a
filter, or a folder makes the two numbers differ — which is the only moment it
carries information.

**Two honest limits on this re-measurement:** the Media pane would not grow past
268px in this session, so only the compact and minimum bands were measured live;
the standard and wide bands are held by tests that read the stylesheet. And the
browser pane was again not compositing, so these are measured numbers, not
pictures.

---

## The FAIL-047 note below is PARTLY WRONG — see the correction

The section that follows was written during Gate B. Gate B1 found that the
"stale responsive mode" it describes **could not be reproduced in a normally
displayed browser**: the pane used for that testing never runs the browser's
rendering steps, so `resize`, `matchMedia` and `ResizeObserver` notifications
were *all* suppressed — measured as literally zero events across a real
1440 → 1024 → 1440 change. The staleness was the instrument.

A real defect of the same shape did exist and is fixed: at a window **exactly
1100px** wide, `max-width: 1100px` matched and hid the docks while `width < 1100`
was false and withheld the replacement controls. See `FAIL-047` for the full
correction.

---

## A real defect found while doing this — not caused by Gate B

**The Studio layout does not re-evaluate its responsive mode when the window is
resized.**

```
  loaded at 1440 wide          mode = laptop     Media dock visible
  resized down to 1024         mode = laptop     ← WRONG, should be tablet
                               CSS hides the dock below 1100px
                               the switcher that replaces it renders only
                               for tablet/mobile … so it does not render
                               ▼
                               NO Media panel, NO Inspector, and no way back
```

Reloading at 1024 gives `mode = tablet`, the "Show Media" switcher appears, and
everything works — which is what proves the fault is the missing recomputation
and nothing else.

- CSS switches at `max-width: 1100px` (`StudioScreen.css`).
- JS renders the compact switcher only for `tablet`/`mobile`
  (`StudioLayoutV2.tsx`), and `responsiveMode` is stale.
- `git diff 0ecffc3 -- apps/web/src/screens/studio/StudioScreen.css` is **empty**,
  so Gate B did not touch this.

Recorded as **FAIL-047**. Not fixed here: it belongs to the Studio layout
authority, and this gate's rule is to fix only Gate B blockers.
