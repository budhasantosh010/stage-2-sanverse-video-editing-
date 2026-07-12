# Change Record: Renderer contract and first FFmpeg candidate

- Date: 2026-07-12
- Goal: G1
- Requirements: REQ-003, REQ-005, REQ-008, REQ-009
- Decisions: DEC-002, DEC-006
- Acceptance criterion: One renderer-neutral static-nameplate request fails closed for unsafe bounds/timing and produces a measured, probed, repeatable FFmpeg-native output.
- Status: Complete for the first candidate fixture; renderer decision remains open.

## Architecture impact

The isolated spike demonstrates the boundary shape: renderer-neutral intent enters an adapter, while FFmpeg-specific command construction remains inside the FFmpeg candidate. The spike schema is explicitly disposable and does not become G2's canonical project model automatically.

## TDD evidence

1. Missing contract loader failed, then passed.
2. Unsafe normalized bounds were accepted, then failed closed.
3. Overlay timing beyond source duration was accepted, then failed closed.
4. Missing synthetic-source command failed, then passed.
5. Missing FFmpeg nameplate command failed, then passed.
6. Missing real-render orchestration failed, then produced and probed a valid MP4.
7. Missing JSON report CLI failed, then passed.
8. Missing repeat mode failed, then produced identical hashes across repeated renders.

Independent review initially failed validation, end-exclusive timing, determinism semantics, and FFmpeg escaping. Seventeen adversarial cases were added RED, the root causes were fixed, and the final suite for this change is 25 tests passed.

## Evidence level

- E3 for this isolated synthetic FFmpeg spike
- E0 for the actual Stage 2 editing product

## Rollback

Delete the isolated spikes/renderer folder and revert the linked documentation. No user media, project schema, database, or production API depends on it.
