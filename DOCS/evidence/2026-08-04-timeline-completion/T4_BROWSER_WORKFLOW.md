# T4 Real Microsoft Edge Workflow

Date: 2026-08-10
Browser: Microsoft Edge `151.0.4129.72`
Project: disposable real-media project `project_c4785438d46d9ad15b75f080166dd679`
Source: `primary-30s.mp4`
Source SHA-256: `f77489118ffa7a3d00699a32e44e8611835132a866659fb7f7f1606e31237839`

The workflow used the actual local app at `127.0.0.1:2000/2001`, the real Studio UI, one native `<video>`, and the production React pointer handlers. Edge was launched with an extensions-disabled disposable profile and driven over the browser's CDP endpoint; no project operation was injected behind the UI.

## Accepted edit sequence

1. Opened the real owner-media project and entered Studio.
2. Selected the V1 primary clip and expanded Animation.
3. `Add Keyframe at Playhead` at source time zero created the safe two-keyframe Position X track: revision **0 → 1**.
4. Moved the one monitor playhead to 15 seconds and added the midpoint: revision **1 → 2**.
5. Opened the Editor Property Graph.
6. Dragged the real midpoint SVG keyframe with PointerEvents. During movement the point moved visually while revision stayed **2** and the UI reported detached Graph preview. Pointer release committed exactly once: **2 → 3**. Midpoint value became `0.7887323943661971`.
7. Selected Custom Bezier: revision **3 → 4** and two SVG handles appeared.
8. Dragged the first real Bezier handle. During movement revision stayed **4**; pointer release committed exactly once: **4 → 5**. Accepted easing became `x1=0.3237491564638966`, `y1=-0.6244897959183688`, `x2=0.25`, `y2=1`.
9. Changed Graph horizontal zoom from `1` to `2.5`; revision stayed **5**.
10. Switched `Edit → Effects → Edit`; revision stayed **5**, one video remained, the selected midpoint value survived, Graph remained open and Graph zoom remained `2.5`.
11. Undo produced revision **6** and restored the pre-handle-drag Bezier state.
12. Redo produced revision **7** and restored the dragged Bezier state.
13. Exported the revision-7 project through the visible Studio Export action.
14. Forced a final reload, reopened the recent project through Home, returned to Studio and confirmed revision 7, one video, Export available and no accepted-state loss.

## Responsive evidence

- 1440×900: document width 1440; one video; no horizontal page overflow.
- 1024×768: document width 1024; one video; Graph present; no horizontal page overflow.
- 390×844: viewport width 390, document scroll width 375; one video; no horizontal page overflow.

Screenshots are under `t4-browser-screenshots/`. The desktop image proves the selected keyframe Inspector and Timeline animation lane in the real Studio; the mobile image proves the compact Studio remains usable without page overflow. The Graph itself was interacted with and measured as a real SVG surface in Edge, but the nested Timeline scrolling did not place the full SVG cleanly inside the desktop screenshot frame, so the screenshots are not used as the primary proof of Graph dragging.

## Browser error observation

`t4-browser-report.json` records the final reload/reopen observation:

- runtime exceptions: **0**
- console errors: **0**
- HTTP responses >=400: **0**
- four in-flight requests were canceled with `net::ERR_ABORTED` by the forced navigation/reload; they are canceled requests, not failed HTTP responses.

## Deliberate limits

- Pointer gestures were dispatched through the real Edge page and real React pointer handlers, not by a physical mouse.
- Hold interpolation is not exposed because the current Editor easing contract has no truthful end-to-end Hold authority; T4 does not fake it.
- No implicit Auto-Key was introduced.
