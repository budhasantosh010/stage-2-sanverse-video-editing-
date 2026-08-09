# T4 Editor Property Graph View

The graph is `TimelinePropertyGraphView`: an Editor PROPERTY graph inside the existing Timeline region. It is not MotionGraph, a compositor graph, node graph, expression editor or a new Studio panel.

## Scope

One active editor-owned property is displayed at a time because position, scale, rotation, opacity and crop use different units/ranges.

Graph presentation state is local/persisted presentation only:

- pan;
- horizontal zoom;
- vertical zoom;
- Fit All;
- Fit Selection;
- open/close;
- height.

No graph viewport action creates a project revision or export-identity change.

## Curves

Curve samples come from the existing `evaluatePropertyTrack` shared evaluator. T4 does not duplicate Linear/Bezier/Spring/Bounce math in React. Sampling is bounded to 48..640 samples regardless of project length or keyframe count.

## Points and selection

Graph points are the same logical keyframes as Timeline diamonds and share `EditorKeyframeSelectionV1`. Graph point drag can change time/value as one detached gesture. Graph marquee uses the same selection authority. Successful time movement reconciles selection to the new canonical timestamp.

## Bezier handles

Selected cubic-bezier outgoing segments show canonical easing handles. Screen coordinates convert to existing x1/y1/x2/y2 bounds; release creates one complete existing-operation edit, Escape cancels. Equal-value segments display a truthful no-visible-effect hint.

Spring/Bounce use their own parameter controls and actual sampled evaluator; they never display fake Bezier tangents.
