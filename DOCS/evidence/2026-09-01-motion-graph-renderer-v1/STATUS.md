# Canonical Motion Graph Supplemental Renderer V1 — status

Date: 2026-09-01
Requirement: REQ-026
Decision: DEC-024
Status: engineering + real-browser acceptance complete

## Problem closed

Sanverse could accept authored canonical Motion Graph nodes, pass structural QA, persist them under `root.childIds`, and still omit them from Storyboard review/preview/export pixels because `MotionComponentHost` only rendered the registered component's bespoke React/CSS surface.

The fix keeps registered component-native pixels authoritative for shipped baseline nodes and adds one shared supplemental graph surface inside `MotionComponentHost` for newly authored reachable canonical nodes. This is the same runtime boundary consumed by Creative review, preview and export; no MCP-only renderer, second graph or FFmpeg/SVG authoring authority was introduced.

## Deterministic renderer contract

- Traverse the exact evaluated canonical scene from `rootNodeId` through `group.childIds`.
- Render newly authored reachable shape, text, path and Expert nodes.
- Preserve authored ancestor effective enable/visibility, opacity, transforms, effects, masks, blend mode and ordering among supplemental siblings.
- Do not generically redraw the registered component's baseline nodes.
- Render image nodes only from browser-safe/local resolvable sources; unresolved opaque sources fail closed.
- V1 supplemental nodes composite above the registered component surface. Arbitrary interleaving inside bespoke component DOM subtrees is explicitly outside this slice.

## Red-before / green-after regression

The failing regression appended an enabled authored ellipse under the canonical root. Before implementation the resolved graph contained the node but rendered markup did not contain it. After implementation:

- Motion Native Runtime: 14/14 PASS.
- Coverage includes authored shapes, text/path/Expert surfaces, nested authored groups, disabled/unreachable omission, no baseline duplication and fail-closed opaque image resolution.

## Real source-composited Edge proof

A review-purpose artifact used registered `sanverse.floating-value-cloud` native visuals plus three authored canonical nodes:

- `audit.custom.magenta` — ellipse, visible, RGB 255/0/170, 260×180.
- `audit.custom.cyan` — rounded rectangle, visible, RGB 0/221/255, 290×170.
- `audit.custom.text` — visible custom text.

The real `/render/creative-scene` page was rendered in Microsoft Edge with the actual source frame visible behind both the registered native component pixels and supplemental authored graph pixels.

- preview SHA-256: `6ab09670b5645636303e0ec069073c0c41491e361c34cfce1e8aab833bf38c74`
- export SHA-256: `6ab09670b5645636303e0ec069073c0c41491e361c34cfce1e8aab833bf38c74`
- preview/export exact-pixel equality: PASS
- accepted production revision before/after: unchanged at 1
- production mutation: false

Machine-readable evidence: `renderer-audit.json`.

The source-composited screenshot itself is intentionally not committed because it contains source-video imagery; the audit retains only safe IDs, node/style facts and cryptographic hashes.

## MCP/Creative continuity

The existing 73-tool `sanverse:mcp:audit-storyboard-authoring` path remains green after the renderer change, including source-composited Storyboard review generation and zero production mutation. Its particular KVS screenshots were visually source-only, so they are not misrepresented as custom-node pixel proof; the dedicated Edge audit above is the renderer acceptance evidence.

## Repository certification

- Authoritative Windows single-fork all-workspace regression: PASS / exit 0.
- Key counts retained: Web 1,239/1,239; API 411/411; Creative Direction 46/46; Creative Production Adapter 37/37; Edit Domain 491/491; Motion Library 202/202; Motion Graph 148/148; Render Contract 121/121; Motion MCP 30/30; Motion Native Runtime 14/14.
- Root all-workspace production build: PASS / exit 0.
- Existing non-blocking build warnings only: unresolved runtime `/api/render-assets/nameplate-font` URL at build time and Vite chunk-size warnings.
- `npm audit --omit=dev --json`: 0 production vulnerabilities across 153 production dependencies.

## Release boundary

This engineering slice does not create or imply exact owner Storyboard, Creative Direction, Animatic, Motion or final-video approval. The REQ-020 immutable raw-video release tag remains withheld until its meaningful-spoken-source, real owner review and complete 1× final-watch evidence exists.
