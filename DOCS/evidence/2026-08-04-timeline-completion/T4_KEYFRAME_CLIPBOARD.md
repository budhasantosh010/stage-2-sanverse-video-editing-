# T4 Keyframe Clipboard

Schema: `sanverse.editor-keyframe-clipboard/v1`.

The clipboard contains only:

- source property ID;
- relative integer tick offsets;
- numeric values;
- existing canonical `VisualEasing` values.

It intentionally contains no project, accepted operation, target identity, file path, URL, DOM value, function, Motion Graph node or Motion Library component.

Operations:

- Copy: zero revision;
- Cut: one planner commit;
- Paste at Playhead: one planner commit;
- Duplicate: one planner commit.

Initial compatibility is same-property only. Exact-time paste collision replaces the existing same-property keyframe at that exact timestamp. It never adds one tick or silently retimes. Paste is all-or-nothing for bounds, value limits, keyframe limits and compatibility.
