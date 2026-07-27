# ADR-003 — One render contract for preview and export

- Status: Accepted
- Date: 2026-07-27

## The problem

The browser preview and the FFmpeg export were two independent designs that
nothing compared. Verified in the v1 code:

| | Browser preview | FFmpeg export |
|---|---|---|
| font | whatever the OS supplied | whatever the OS supplied, on the server |
| size basis | browser window (`2vw`) | the video's shortest edge |
| wrapping | wrapped at 320 px | never wrapped |
| padding | fixed 8/10 px | scaled to the video |
| box | one box around both lines | one box per line |

No test anywhere asserted they matched. `visual-contract.test.ts` covered app
UI tokens only.

This mattered more than it looked. The entire safety story of the product is
*the user approves what they see in the preview*. If the preview is not the
truth, that approval means nothing, and every AI feature built on top of it
inherits the lie.

## Decisions

### CSS and FFmpeg define no product semantics

`@sanverse/render-contract` holds one description of a nameplate: sizes as
fractions of the composition's shortest edge, colours, padding, line gap, safe
margin, and the no-wrap rule. The browser translates it into CSS; the adapter
translates it into FFmpeg arguments. Neither invents a number.

### Both renderers consume the same compiled plan

`compileProjectToRenderPlan` turns a project into a `RenderPlan`. The preview
compiles it and so does the exporter. There is no second description of the
video anywhere in the system.

### The same font file is served to the browser

`GET /api/render-assets/nameplate-font` serves the exact file the exporter
uses; the preview loads it with `@font-face`. Without this the preview draws
with the viewer's system font and the export with the server's.

### Placement is one rule applied to each renderer's own measurement

Neither renderer predicts the other's text width. Each measures its own text
and applies the identical anchoring-and-clamping rule. In FFmpeg that rule is
emitted as an expression over `text_w`, so FFmpeg substitutes its real
measurement at render time.

Two details make this hold:

- **The visible box is anchored, not the text.** FFmpeg's `x`/`y` position the
  text, so the padding is added back explicitly.
- **The vertical box height is derived, not measured.** FFmpeg's `text_h` is
  the glyph box; CSS's is the em box. They differ by the font's internal
  leading — 8 px at 28 px Arial, measured. Using the font size on the vertical
  axis makes placement identical for every anchor instead of only for
  top-anchored nameplates.

Results are rounded inside the shared rule so both renderers land on the same
whole pixel rather than rounding independently.

### One box per line

FFmpeg's `drawtext` draws a box per line, so the preview does too. A single box
wrapped around both lines would look tidier and would not match the export.

### The parity test evaluates the real expression

`nameplate-style.test.ts` evaluates the exact string handed to FFmpeg
numerically — including a simulated glyph/em-box difference — and fails if it
disagrees with the browser rule. It is not a restatement of the same maths on
both sides; it is the shipped expression, executed.

## Known and measured limitation

The *drawn background plate* is about 10 px shorter vertically in the export
than in the preview at 1080p, because FFmpeg's plate hugs the glyphs while the
browser's hugs the em box. The nameplate's **position is identical** — verified
on a real 1920×1080 export: anchor box top 509 in both, horizontal extent
within one pixel.

Closing this fully needs the font's real ascent and descent read from the TTF.
That is real work, it is font-specific, and it buys a cosmetic improvement to
the plate's height only. Recorded here rather than guessed at. Revisit when
G6 introduces motion, which is when plate geometry starts to matter.

## Other renderer decisions

- `-threads 1` is a deliberate contract, not a performance dial: it keeps an
  exported file's hash reproducible. Raising it changes output bytes.
  Reproducibility survives any pinned thread count, so this may be raised —
  but only deliberately, and the evidence hashes must be regenerated.
- `-c:a copy` is correct only while nothing cuts the timeline. The first cut
  operation in G5-B must replace it with a real audio conform step, because
  copied audio can only be cut at its own block boundaries and will drift out
  of sync.
- There is still no colour or HDR handling, and `-pix_fmt yuv420p` is forced.
  iPhones record HDR by default, so washed-out output is plausible. Unproven
  until real HDR footage is tested; tracked in the cross-cutting plan.
