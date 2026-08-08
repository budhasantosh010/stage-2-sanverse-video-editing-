# T3 Numeric Precision

The compact Timeline popover accepts project timecode, frame counts, relative frames and relative timecodes while integer ticks remain canonical.

Examples supported by tests: `00:01:13:12`, `+12f`, `-8f`, `+00:00:01:00`, negative relative timecode and rational FPS.

Real Edge:
- `not-a-time` returned the plain refusal `Use project timecode like 00:01:13:12, frames like 120f, or a relative value like +12f.` with zero revision;
- `+1f` on the real clip end was correctly refused because the source handle was exhausted;
- `-1f` was accepted and advanced exactly one revision.

Numeric Apply routes back into the same Standard/Ripple/Roll/Slip/Slide planners; it never writes floating seconds to the project.
