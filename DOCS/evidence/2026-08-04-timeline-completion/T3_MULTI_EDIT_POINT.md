# T3 Multi Edit Point

`TimelineEditPointRefV1` is presentation identity only. Ctrl/Cmd adds compatible edit points without changing the project.

`planMultiEditPointTrim` is all-or-nothing: one blocking point refuses the complete request, and a successful request is one `set-primary-clip-timings` operation and one Undo.

Verification:
- planner tests cover compatible and incompatible sets and prove no partial mutation;
- 60-minute test moves two distant Roll points with at most four timing changes;
- real Edge temporarily split real owner media to expose two eligible Roll points, Ctrl-selected both, then an incompatible compound move refused with revision delta 0. The temporary Split was undone.
