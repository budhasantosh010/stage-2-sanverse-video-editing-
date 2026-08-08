# T3 Real Microsoft Edge Workflow

Browser: Microsoft Edge 151 headless CDP against the real local Studio and owner-media project `primary-30s.mp4`. A clean extensions-disabled T3 profile was used. Only the Edge process started by this T3 session was terminated/restarted; existing editor API/Vite processes were not killed.

## Accepted precision edits

Starting private evidence revision: 35.

- Standard Trim: revision 36, duration delta -48,000 ticks. Undo/Redo restored both exact states, then Undo returned to the baseline.
- Ripple end trim: revision 40, downstream clip moved exactly -48,000 ticks; Undo passed.
- Roll: revision 42, total sequence duration unchanged; Undo passed.
- Slip: revision 44, composition start/duration unchanged, source delta -48,000 ticks; Undo passed.
- Slide: revision 46, sequence duration unchanged, selected source unchanged, composition delta +48,000 ticks.
- J/J/K/L/L: `Shuttle forwards 2x`, zero revision, one video.
- Dynamic Trim cancel: zero revision. Dynamic Trim Enter: revision 47, exactly one revision; Undo passed.
- Audio Scrubbing toggle: zero revision.
- Numeric invalid: plain refusal and zero revision. Numeric `-1f`: exactly one revision.
- Multi-edit-point: after one temporary real Split, two Roll points were Ctrl-selected. The incompatible compound move refused atomically with revision delta 0; Split was undone.
- Detached Trim View: Standard Trim draft displayed two exact frames (`source-in`, `source-out`) at a -00:00.176 delta; `pointercancel` created zero revision.
- Zoom while selection active: zero revision and one video.

The current owner-media sequence exposed only one eligible Roll point without the temporary Split, so the browser did not fabricate a second cut. Compatible multi-edit behavior is covered by the passing planner/component test matrix.

## Responsive and persistence

1440x900, 1280x800, 1024x768, 390x844: no horizontal page overflow; exactly one video at every size. Accepted state survived reload with the same project revision.

Final export run reported zero page/runtime errors and zero failed HTTP responses.

Screenshots: `t3-browser-screenshots/`, including active Trim View, desktop/tablet/mobile states and export ready.
