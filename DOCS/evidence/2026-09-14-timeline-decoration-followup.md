# Timeline confidence follow-up — September14

Base: `cbea7814ad5aa7ea68709123463ab0c03c26cafb`, branch `timeline-t55-editor-confidence`. Scope: remaining high-impact timeline confidence work, no Motion changes.

## Fixed

FAIL-099: waveforms and filmstrips used timeline duration as source duration after speed edits and lost reverse direction. This affects visual cutting accuracy, not merely styling. The existing view model now carries optional explicit source direction; the decoration adapter retains source duration. Waveform planning covers the correct recording span and mirrors bars for reverse; filmstrip keys follow the source while cell widths/positions use the composition scale. Existing bounded cache keys and quarter-second thumbnail quantization are preserved. No domain operation, renderer, project persistence or dependency changed.

Four tests reproduced wrong source bounds/direction/moments before the fix. Dedicated end-to-end dataflow test starts from an accepted2x reverse edit and checks canonical picture and dialogue through the view model, adapter and decoration plan. Canvas test checks reversed peak drawing. Independent extracted-audio assignment uses the same path; additional dedicated0.5x/extracted coverage is a nonblocking reviewer suggestion.

## Sustained scrolling evidence

Added a Timeline component test with one pointermove to the bottom-right edge followed by60 stationary RAF frames. It checks horizontal and vertical scrolling beyond500px, more than50 landing-plan refreshes, no committed edit before release, and pointer-cancel stopping the loop without committing. This is a component/DOM simulation, not a live browser or60fps performance certification. Existing geometry/outside-release and selected-item virtualization behavior remain intact.

## Verification and failed attempts

- Decoration/dataflow/canvas selection:62/62 PASS with unchanged assertions and a bounded15-second per-test deadline.
- Timeline component selection:32 existing checks PASS; isolated60-frame edge-hold test PASS (8.48s test time) with a20-second limit now recorded on that test. The initial5-second deadline expired on this loaded laptop; no behavioral assertion was weakened. These are separate selections, not a claimed fresh whole-suite run.
- A timed-out decoration test originally left overlapping React act calls and caused cascading empty-render failures in the combined run. Isolated reruns distinguish that harness cascade from actual app behavior.
- First build caught a nullable fixture duration in the new test; explicit fixture guard added, no runtime workaround.
- Initial reverse-thumbnail tests expected exact one-tick samples; existing cache intentionally quantizes to quarter-second cells. Corrected the test to the established cache boundary, not a new precision claim.
- Independent review PASS: no confirmed logic/security blocker. No tests executed by reviewer.
- Final affected frontend production/type build PASS:314 modules, JS1,025.17kB/gzip285.74 (+0.55/+0.18 from cbea7814); CSS145.14/gzip24.42 unchanged. Existing font-runtime/chunk-size warnings remain. Diff and editor boundary checks PASS; no protected Motion modifications/imports.

## Browser blocker and exact remaining work

INFRA-023: existing-tab selection timed out after30 seconds, reset the browser kernel; a fresh inventory call also timed out. No further retries or competitor launch were performed because a live comparison could not be observed. Timeline server was restarted on2010/2011, historical launcher PID12196; verify current process before stopping. No project edits occurred in this follow-up; last restored owner project remains92 from the previous release, subject to any later owner edits.

When browser control works again:

1. Reopen the saved30-second test project; inspect current revision and preserve owner changes.
2. Zoom until timeline extends beyond the viewport. Hold a video/audio clip inside each edge for1–2 seconds; verify continuous scroll, stable grab offset and matching landing preview. Test Escape/outside release without revision changes, then a valid drop and Undo/Redo.
3. Check waveform transient placement before/after trim,0.5x,2x and reverse on the same source. Combined/separate channels should show real probed channels, not copied shapes. Inspect regular and extracted sound.
4. Run the same short trim/split/drag/zoom task in the persisted OpenCut project using competitor-local start-comparison.ps1 (inside the owner's competitor folder). Compare task outcome and interruptions; do not invent a parity score from unmatched recordings.
5. Owner completes a real short edit and listens through the export. This subjective acceptance cannot be signed off by an agent.

Remaining high-impact **agent-side gate is BLOCKED, not complete**: live held-drag/waveform/competitor comparison. Fix any newly reproduced blockers after connection recovery. Owner acceptance is separate. Motion integration waits for acceptance and explicit authorization. Do not merge or alter Motion lane2000.
