# T4 Keyframe Selection and Interactions

T4 owns one presentation-only `EditorKeyframeSelectionV1` shared by Timeline lanes, Graph and the selected-keyframe Inspector bridge. Selection addresses use target + closed property ID + canonical integer tick; no persistent keyframe ID was added.

Supported selection behavior:

- single;
- Ctrl/Cmd add/toggle;
- Shift range in a compatible property lane;
- property-lane marquee;
- Graph marquee;
- select all in active property;
- clear/reconcile on target change;
- previous/next keyframe through the one Timeline playhead authority.

Selection creates no revision/history/export change. Stale addresses are reconciled against the current accepted/draft track. A successful time move reconciles selection to the new canonical timestamp.

Pointer movement creates detached proposed track state only. Release routes one complete planner result through the existing accepted operation family. Escape/pointercancel drops the draft. Multi-keyframe moves validate all destinations/ranges/collisions before returning a next state; one invalid member refuses the entire gesture.

The numeric Timeline-local keyframe editor accepts project time/frame/relative syntax through the existing T3 exact integer-tick parser. It inverse-maps project time to the target's canonical time basis before planner validation. Value and interpolation are applied in the same complete-state commit.
