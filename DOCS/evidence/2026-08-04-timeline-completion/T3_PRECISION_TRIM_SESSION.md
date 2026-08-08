# T3 Precision Trim Session

Gate T3 uses one detached presentation session and one accepted timing authority.

- Active modes: Standard Trim, Ripple Trim, Roll, Slip, Slide. Rate Stretch remains the existing T2 tool.
- Pointer/key movement creates a planner draft only. It does not write EditProject, call the API, create history, or advance revision.
- The exact `PrecisionTrimPlan` used for ghost/Trim View is the plan committed on completion.
- Accepted Roll/Slip/Slide/compound edits use one closed `set-primary-clip-timings` operation so no intermediate overlapping composition is ever accepted.
- `Escape` and `pointercancel` clear the draft. Real Edge Trim View proof held a Standard Trim draft at delta -00:00.176 and `pointercancel` left revision unchanged.
- One completed Dynamic Trim session produced exactly one revision; its cancellation produced none.

The project remains v5 and render plan remains v8. T3 adds no second Timeline, playhead, video element, project clock, audio clock, or render authority.
