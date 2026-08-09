# T4 Property Lanes

Date: 2026-08-09

T4 adds editor-owned animation property rows inside the existing Timeline viewport. It does not create a second Timeline or change Studio topology.

## Presentation authority

`sanverse.timeline-animation-presentation/v1` stores only presentation state outside `EditProject`:

- expanded animation targets;
- animated-only vs all-available property visibility;
- active property;
- Graph open/closed;
- Graph height;
- Graph pan/zoom.

Storage is namespaced by project and closed-validated. Corrupt, future/old-schema, extra-key and non-finite state falls back to safe defaults. Presentation changes create no edit/history/revision/export change.

## Target expansion

Animated logical items display a compact diamond badge with creator-facing `Show animation` copy. The badge coexists with existing speed/reverse/transition/audio states. Clicking it selects the existing Timeline item and expands animation for that target; accepted identity is unchanged.

Expanded property rows default to `Animated properties`. `All available properties` shows only the truthful capability matrix for the selected target. Primary footage never exposes opacity; Freeze/dialogue/music expose no animation lane.

## Diamond projection

Diamonds are never stored in screen coordinates. Their X is projected from canonical keyframe time using the target's source-relative or visual-relative time mapper. The property row mounts only keyframes inside the current visible Timeline range plus bounded overscan.

Visible diamonds have small visual geometry and a larger 28–32px interaction target. Selection, hover and playhead coincidence are distinguishable without color-only semantics.

## Interaction

- single click selects;
- Ctrl/Cmd toggles;
- Shift extends within compatible lane;
- Shift-drag on lane background creates a keyframe-only marquee;
- double click selects all in property;
- Arrow Left/Right moves selected compatible keyframes by frame steps;
- Arrow Up/Down changes compatible values within the existing domain bounds;
- Delete/Backspace uses the planner and cannot silently violate the two-keyframe minimum;
- pointer drag is detached preview and one release is one accepted operation;
- Alt pointer drag changes value instead of time;
- Escape/pointercancel creates zero accepted edit.

T2 vertical zoom and stored base track heights remain independent. Animation property rows add measured height only while the target is expanded; collapsing the base track continues to own base-track collapse semantics.
