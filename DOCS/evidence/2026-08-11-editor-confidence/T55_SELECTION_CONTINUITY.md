# T5.5 Selection Continuity

## Policy

- A successful ordinary edit keeps the logical affected object in context.
- Primary/inspected selection is visually stronger than secondary multi-selection.
- The containing track lane and header are visibly related to selected items.
- First Escape exits a special/destructive tool to safe Select without discarding selected clips; a later Escape may clear selection.
- Razor selects the item it acts on before routing the split.

## Regression proof

`Timeline.test.tsx` covers Razor routing, two-stage Escape, primary/track selection state and other Timeline behavior. Existing `timeline-selection-v2` and Studio continuity suites remain green in the 2,510-test full pass.
