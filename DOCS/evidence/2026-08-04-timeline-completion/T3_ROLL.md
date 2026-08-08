# T3 Roll

Roll is planned atomically across two adjacent primary clips. The left source end and right source start change together; unrelated items do not move and total sequence duration is invariant.

Verification:
- focused planner/domain matrix covers left/right, adjacency, source handles, rational speed, reverse, J/L, transitions, Freeze adjacency, locks and groups;
- real Edge one-frame Roll completed at revision 42 and total sequence duration was unchanged;
- Dynamic Trim reuses this same Roll planner;
- multi-edit-point Roll is all-or-nothing. In real Edge, a temporary real Split exposed two Roll points; Ctrl-selection selected both, the incompatible compound move refused with revision delta 0, then the temporary Split was undone.

A transition is preserved only if its required handles remain valid; there is no silent duration truncation.
