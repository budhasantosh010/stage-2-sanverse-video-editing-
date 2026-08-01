# P1-E.1 Implementation Report — Studio Vertical Flow

## Objective

Restore ordinary vertical page scrolling so the complete Studio upper workspace and Production Timeline remain readable and reachable without compressing the video preview into a shallow strip.

## Root cause

Desktop Studio used one fixed viewport-height grid:

```text
height: calc(100vh - 64px)
grid rows: upper workspace + 34vh Timeline
overflow: hidden
```

The grid could not contribute height beyond the viewport. Lower Timeline lanes and controls were therefore clipped or compressed and the document had no useful vertical scroll range.

## Implemented

- Browser document is the one outer vertical-scroll authority.
- `html`, `body`, and `#root` support natural full-document height.
- Studio uses `height: auto`, normal-flow grid rows, visible overflow, and bottom page padding.
- Upper workspace retains a useful minimum height and P1-D's bounded video-stage contract.
- Timeline remains horizontally scrollable and gets a useful vertical minimum while staying in document flow.
- Media, Inspector, and AI retain intentional bounded internal scroll surfaces.
- Existing sticky EditorShell header remains available while scrolling.
- Existing Studio video geometry controller owns one passive document-scroll refresh and cleans it up on unmount.
- No project, history, Timeline model, operation, revision, second video, or second `ResizeObserver` is created by page scrolling.

## Not implemented

- No P1-F primary-footage motion.
- No motion graphics, AI provider, transcription, waveform, general multitrack, schema, API, or renderer change.

## Verification

Automated final gates:

- Web 476/476.
- Edit domain 265/265.
- API 235/235.
- Render contract 51/51.
- Intent domain 27/27.
- Production build passed.

Real Edge proof and required screenshots are recorded in `browser-walkthrough.md`, `browser-report.json`, and `screenshots/`.

## Real Edge result

At 1440×900, Studio measured 1484 pixels of document height against a 900-pixel viewport, giving 584 pixels of real page scroll. The complete Timeline became reachable at the bottom of the page. The 1280×800, 1024×768, and 390×844 viewports also had natural page scroll and exact-width documents with no horizontal overflow.

The walkthrough proved unchanged playhead, selected clip, Timeline zoom, Timeline horizontal scroll, and accepted revision across a page-scroll round trip. Canvas rectangles remained aligned before and after scrolling; one completed title move created exactly one revision. Point mode used the current visible video rectangle. Playback advanced while the document scrolled. Exactly one main video and five lanes remained. The passive scroll listener and video were both removed on editor unmount. Page, console, and failed-HTTP counts were all zero.

## Issue

`UX-013` is **RESOLVED** with evidence in this directory.

## Stop boundary

This milestone ends before P1-F. P1-F.0 may begin only from the clean pushed P1-E.1 commit.
