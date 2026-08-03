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

  COMPACT    221–300    Media · 5 assets      Import  Sort  Folder  ⋯
                        [ Filter · Video                          ▾ ]
                                                          └── ONE button

  MINIMUM    ≤ 220      Media 5               +  ⇅  ▾  ⋯
                        [ ⚟•                                        ]
                                                          └── icon + dot
```

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
