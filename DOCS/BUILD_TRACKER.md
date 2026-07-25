# Build Tracker

Last updated: 2026-07-14

| ID | Goal | Deliverable | Status | Evidence |
|---|---|---|---|---|
| G0-01 | G0 | Product requirements and macro goal | Complete | `REQUIREMENTS.md`, `MACRO_GOAL.md` |
| G0-02 | G0 | Architecture and interface decisions | Complete | `DECISIONS.md`, `INTERFACE_PRINCIPLES.md` |
| G0-03 | G0 | Goal map and anti-drift protocol | Complete | `GOALS.md`, `ANTI_DRIFT_PROTOCOL.md` |
| G0-04 | G0 | Lightweight local continuity hooks | Complete | Setup/governance checks and isolated hook-output tests pass |
| G0-05 | G0 | Coherent Git baseline | Complete | `eb08ce2`, merged remote history at `751911f` |
| G0-06 | G0 | Private GitHub repository | Complete | SSH push to `budhasantosh010/stage-2-sanverse-video-editing-` |
| G0-07 | G0 | Owner approval to enter G1 | Complete | Explicit owner instruction on 2026-07-12 |
| G1-01 | G1 | Two-screen user journey and low-fidelity Home/Studio design | Complete | Owner approved both screens |
| G1-01B | G1 | Runnable Home-to-Studio web shell on strict port 2000 | In progress | Owner rejected subtle motion twice; unsupported native transition API was verified and a gated fallback plus direct-control spring correction now awaits owner re-test |
| G1-02 | G1 | Renderer comparison harness and fixtures | In progress | 11 focused hybrid tests and 45 renderer tests; static fixture has structural hybrid evidence; pixel fidelity, real-video/audio, motion, and HyperFrames runtime remain open |
| G1-03 | G1 | Architecture decision record for renderer | Complete | ADR-001 narrowly selects browser preview plus FFmpeg export for the first static-nameplate loop |
| G2-01 | G2 | Canonical point/nameplate action and immutable history package | Complete | 34 edit-domain tests pass; Studio now uses canonical proposal, acceptance, undo, and redo in memory while renderer and persistence remain unconnected |
| G2-02 | G2 | Explicit rendered-video Point mode | Complete | 11 pure point-target tests plus 16 Studio tests (27 focused), 109 full workspace tests, both builds, governance, and diff checks pass; live owner workflow remains unverified |
| G2-03 | G2 | Bounded manual nameplate proposal | Complete | 10 composer tests plus 18 Studio tests pass; this independent slice creates a validated pending proposal without accepting it |
| G2-04 | G2 | Typed nameplate preview and canonical in-memory history loop | Complete | 54 focused Task 5 tests and 147 full workspace tests pass; both builds, governance, diff, spec review, and quality re-review pass; persistence, render, export, owner placement approval, and owner live-browser verification remain pending |
| G2-05 | G2 | Immutable local project intake and controlled media API | Complete | 30 API + 118 web + 34 edit-domain tests (182 total), all three builds, spec review, and quality/security re-review pass; configured runtime smoke and a 142,738-byte real-video-derived HTTP/hash/range check pass; full-file performance, edit history, render, and export remain pending |
| G3-01 | G3 | Replaceable deterministic FFmpeg renderer adapter | Complete | Two real-video-derived renders have identical hashes and preserve 640 by 360, two-second duration, and audio; API/domain builds, web type-check, direct cancellation/path/publication checks, governance, static scan, diff check, and independent final re-review pass |
| G3-02 | G3 | Owner-facing accepted-history export and download | Complete | Real-browser walkthrough 2026-07-25 exported a 30s 1080p clip and downloaded it; probe and frames confirm 1920×1080, 30.03s, AAC audio, nameplate present at the clicked point during its window and absent after. Preview and export styles match. Render took roughly 60–85s, recorded as a known cost; owner has deprioritized speed |
| G2-06 | G2 | Persisted project history and recent projects | Complete | Accept, undo, and redo write serialized history to `.sanverse-data/projects/<id>/edit-project.json`, verified on disk after each action; Home lists recent projects and reopening restores saved history in a live browser |
| G3-03 | G3 | Real-user end-to-end verification of the manual loop | Complete | Full browser walkthrough with console, network, server-log, disk, and exported-media inspection. Found and fixed FAIL-006 (64-bit inode rejection blocking all new uploads) and FAIL-008 (misleading copy); repaired 5 stale App tests. 220/220 tests and all three builds pass at `fcc41eb` |

## Status rules

- `Pending`: not started.
- `In progress`: active work exists but the acceptance gate is open.
- `Complete`: acceptance evidence exists and limitations are recorded.
- `Blocked`: progress requires owner authority or external state.
