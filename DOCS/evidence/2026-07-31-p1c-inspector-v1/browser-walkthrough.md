# P1-C Real Browser Walkthrough

Date: 2026-07-31  
Browser: Microsoft Edge through Playwright  
Viewport evidence: 1440×900, 1024×768, 390×844  
Input: `resources/test video/test-30s.mp4`

## Workflow

```text
fresh upload
-> Studio
-> select V1 clip
-> set clip gain to -6 dB in Inspector
-> Apply
-> Undo
-> Redo
-> add title through existing direct controls
-> select title
-> repair headline in Inspector
-> set scale 125%, X +8%, crop left 5%
-> add 0.5-second entrance fade with ease
-> enable scale keyframes and add one at the playhead
-> Apply visual properties
-> Undo
-> Redo
-> create detached nameplate proposal
-> select proposal in Timeline
-> reject through Inspector
-> export and download MP4
-> inspect tablet and mobile layouts
```

## Revision evidence

| Step | Revision |
|---|---:|
| Initial upload | 0 |
| Clip audio Apply | 1 |
| Undo audio | 2 |
| Redo audio | 3 |
| Add title | 4 |
| Repair title | 5 |
| Apply visual properties | 6 |
| Undo visual change | 7 |
| Redo visual change | 8 |
| Reject pending proposal | 8 |

The proposal remained detached: rejecting it did not consume a project revision.

## Browser result

- Page errors: 0.
- Console errors: 0.
- Failed HTTP responses: 0.
- Video elements: 1.
- Semantic lanes: 5.
- Body and document scroll width matched viewport width at all three sizes.
- The Inspector opened from Timeline selection and used the same project revision as Timeline, preview, history, and export.
- The title repair and visual operation were present in the saved project as `set-title` and `set-visual-properties`.
- Final active operation kinds were `set-clip-audio`, `add-title`, `set-title`, and `set-visual-properties`.

The raw machine report is `browser-report.json`. Timeline lane content intentionally has its own horizontal scroller, so the raw `lanesInsideViewport` diagnostic is not a page-overflow acceptance field; the page-level body and document widths remained bounded.

## Defects found during the walkthrough

- A sticky visual Apply footer intercepted the Title Apply button. Fixed and protected by a CSS contract.
- Proposal Accept and Reject were disabled by the broader timeline-busy flag. Fixed by separating proposal-action busy state.
- The first exported frames omitted the title because base FFmpeg alpha was set to zero before the entrance fade. Fixed in the renderer and re-exported from a fresh project.

The screenshot `screenshots/browser-found-proposal-actions-disabled.png` preserves the second defect before repair. Final screenshots and export frames are the post-repair evidence.
