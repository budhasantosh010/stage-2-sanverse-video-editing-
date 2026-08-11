# T5.5 Real Microsoft Edge Workflow

Date: 2026-08-11  
Browser: Microsoft Edge `151.0.4129.72` headless CDP  
App: real local Studio at `127.0.0.1:2000/2001`  
Media: the verified T5 Editor source, `source.mp4`, 1280×720 H.264/AAC, 30 seconds  
Evidence: `t55-browser/`

## Real-media setup

The T5.5 worktree imported the existing verified T5 **Editor** source file read-only. The T5 branch/worktree itself was not edited. Motion/Plan-B worktrees were not opened or modified.

A clean Edge 151 profile imported the real 30-second file, opened Studio and showed exactly one native `<video>`.

## Real Razor + selection-confidence workflow

The browser used real CDP mouse events against the visible portion of the real primary clip.

Observed sequence:

1. Select the real primary clip.
2. Selected context becomes the clip plus its linked V1/A1 track context.
3. Activate the visible Razor radio tool.
4. `Tool: Razor` is shown.
5. Click the real clip at a visible timeline position.
6. Accepted revision advances and the primary track becomes three clip pieces.
7. The newly affected clip remains primary-selected.
8. V1/A1 selected-track context remains visible.
9. Razor remains active after the cut.
10. Press real Escape key input.
11. The tool returns to `Tool: Select` **without clearing the selected clip or V1/A1 context**.
12. One native video remains throughout.

The accepted evidence project finished this sequence at revision 2.

## Inspector draft confidence

On the selected real clip, the shared Inspector `Gain (dB)` NumberField was edited with browser keyboard input from `0` to `-3`.

Observed:

- `Changes not applied yet.` appeared immediately;
- Apply became enabled;
- project revision remained 2 because this was still only a draft;
- Reset returned the field to `0`;
- the draft status disappeared;
- revision remained 2;
- the same clip stayed selected.

This proves draft and accepted state no longer look identical for these Inspector forms.

## Playback continuity

With the selected edit state still active, the real Play control advanced the one native video from **1.000 s to 3.281 s** during a 2.3-second observation. Project revision remained 2.

## Responsive matrix

Real Edge device-metric passes were captured at:

| Viewport | Page horizontal overflow | Videos | Revision | Active tool | Selection |
|---|---:|---:|---:|---|---|
| 1440×900 | no | 1 | 2 | Select | preserved |
| 1280×800 | no | 1 | 2 | Select | preserved |
| 1024×768 | no | 1 | 2 | Select | preserved |
| 390×844 | no | 1 | 2 | Select | preserved |

Screenshots:

- `t55-browser/t55-1440x900.png`
- `t55-browser/t55-1280x800.png`
- `t55-browser/t55-1024x768.png`
- `t55-browser/t55-390x844.png`

The images were visually inspected, not only measured. Desktop/laptop/tablet retain the Studio editing frame; 390 px uses the intended stacked creator layout with Preview followed by Timeline and no sideways page spill.

## Runtime/network result

During the responsive evidence pass:

- runtime exceptions: **0**
- console errors: **0**
- HTTP responses >=400: **0**
- network loading failures: **0**

Machine-readable record: `t55-browser/t55-responsive-report.json`.

## Real export continuity

The visible Export button was clicked from revision 2 in the same Edge session.

Result:

- `Export ready`
- 1280×720
- 30 seconds
- downloaded MP4 SHA-256: `27689ec436ed1a28d04a64fd22592851a4aca683dbe616d47becd62ff221da0a`
- server-side MP4 SHA-256: same value
- hash match: **true**
- H.264 video, 1280×720, 30 fps
- AAC stereo, 48 kHz
- duration: 30.000000 s
- size: 16,174,169 bytes
- export-run runtime exceptions / console errors / failed HTTP / loading failures: **0 / 0 / 0 / 0**

Evidence: `t55-browser/t55-export-report.json`, `t55-browser/t55-export-ready.png`.

## Evidence honesty

The responsive screenshot pass recorded browser long tasks while deliberately resizing the whole application and capturing screenshots. Those durations are **not** reported as pointer/edit latency. Pointer-performance claims remain bounded by the existing long-form/unit tests plus direct interaction observations; no fake p50/p95 number is invented.
