# P1-F.0 Test and Build Results

Executed on 2026-08-01 after the final browser-found repairs.

| Workspace | Result |
|---|---:|
| `@sanverse/api` | 239/239 |
| `@sanverse/web` | 484/484 |
| `@sanverse/edit-domain` | 299/299 |
| `@sanverse/intent-domain` | 27/27 |
| `@sanverse/render-contract` | 65/65 |
| **Total** | **1,114/1,114** |

`npm run build` passed for all five workspaces. The web production bundle completed with the existing non-blocking chunk-size and runtime font-route warnings.

Motion-specific coverage includes:

- closed operation validation and capability registration;
- full-state repair, default-state removal, overlap refusal, and immutable folding;
- split, trim, remove, gap, reorder, repeated placement, Undo, Redo, and deactivation semantics;
- render-plan v6 validation, deterministic serialization, segment boundary splitting, and single-primary-input preservation;
- shared static/animated evaluator, easing, crop, pan, scale, rotation, audio invariance, and overlay order;
- detached Inspector input and presets;
- one Canvas operation on release and zero operations on movement/Escape;
- Point precedence, one native video, Timeline Motion indicator, and removal readiness;
- invalid empty-filter graph regression;
- scale/pan fast path that omits GEQ and rotation when both are unnecessary.
