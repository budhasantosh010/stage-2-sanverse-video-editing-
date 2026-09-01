# Goal Map

This is the compact roadmap view. The full definitions, dependencies, consequences, and exit gates live in `MASTER_PLAN.md`. Every tickable item lives in `plans/PLAN_CHECKLIST.md`; implementation detail lives in the linked micro plans.

```mermaid
flowchart LR
  M["Macro: a non-editor finishes a verified talking-head video in minutes"]
  G0["G0 Foundation"]
  G1["G1 UX and renderer evidence"]
  G2["G2 Project foundation"]
  G3["G3 Manual closed loop"]
  G4A["G4-A Scale-ready Project v2 chassis"]
  G4B["G4-B First AI proposal"]
  G5A["G5-A Captions"]
  G5B["G5-B Timeline primitives"]
  G5C["G5-C Useful talking-head workflow"]
  G6["G6 Motion and effects"]
  G7["G7 Components and compound AI"]
  G8["G8 Trustworthy local alpha"]
  G9["G9 External API/MCP"]
  G10["G10 Production SaaS"]
  G11["G11 Advanced vision"]
  G12["G12 Data and specialized models"]

  M --> G0 --> G1
  G1 --> G2 --> G3 --> G4A
  G4A --> G4B
  G4A --> G5A
  G4A --> G5B
  G4B --> G5C
  G5A --> G5C
  G5B --> G5C
  G5C --> G6 --> G7 --> G8
  G8 -. conditional .-> G9
  G8 -. conditional .-> G10
  G9 -. may support .-> G10
  G8 -. evidence .-> G11 --> G12
```

## Status

Legend: `[x]` complete, `[~]` partly complete or awaiting owner evidence, `[ ]` not started, `[?]` conditional.

| Goal | Outcome | Status |
|---|---|---|
| G0 | Durable product truth, governance, architecture constraints, and rollback baseline | [x] |
| G1 | Owner-tested Home-to-Studio workflow and renderer evidence | [~] Owner motion, native drag-and-drop, and final Studio UX evidence remain open |
| G2 | Minimal typed project/action/history/render foundation | [x] |
| G3 | Upload through persisted accepted edit and downloadable MP4 | [x] |
| G4-A | Project v2 semantics, capability registry, change sets, render plan, and migration seam | [x] Complete |
| G4-B | Natural language becomes a safe pending edit proposal | [~] Fake-provider closed loop complete; first real provider call awaits owner keys/data decision |
| G5-A | Correct, reviewable captions | [x] Complete for transcript-sidecar workflow |
| G5-B | Cut, trim, split, ripple, reorder, audio level, and fades | [x] Complete in domain, preview, export, direct controls, and Timeline V1 |
| G5-C | A genuinely useful talking-head workflow combining AI, captions, and timeline work | [~] Technical workflow exists; repeated owner/non-editor evidence remains open |
| G6 | Transform, keyframes, easing, bounce, transitions, and basic effects | [~] Executable technical batch complete; owner workflow/performance evidence remains open |
| G7 | Versioned reusable components and compound AI plans | [~] Significant technical slices exist; full goal exit remains open |
| G8 | Recoverable, measurable local alpha used on real videos | [~] Technical controls complete; owner workflows, representative users, and agreed budgets remain open |
| G9 | Stable external API/MCP over the same engine | [~] Local standards-compatible MCP is implemented and production-backed; the human raw-video release gate and any future public/remote API operations remain open/conditional |
| G10 | Identity, tenancy, cloud jobs/storage/rendering, billing, security, and operations | [?] Enter when local-alpha evidence and distribution intent justify SaaS |
| G11 | Tracking, segmentation, occlusion, and advanced spatial editing | [?] Evidence-driven |
| G12 | Evaluation flywheel, routing, and specialized models | [?] Consent- and data-driven |

## Current position

- G4-A's exact-time project/change-set/render chassis remains authoritative, and the later Timeline/Media/Canvas/Inspector/Motion/Creative Engine work builds on that same project, revision, history, preview and export truth rather than replacing it.
- G9 has been entered because a real external-client use case was explicitly approved. Local standards-compatible Sanverse MCP is now production-backed and zero-setup through STDIO for Codex/Claude Code/OpenCode, with durable Creative Run continuation, raw-video orchestration, the General Storyboard authoring surface, and the **73-tool** Pre-Storyboard Creative Direction/Style Lock gate on branch `external-mcp-raw-video-v1`.
- REQ-024 General Storyboard Authoring V1 is machine/client complete: typed canonical Motion Graph editing inside Storyboard state, exact revision/approval locks, approved-Storyboard → Motion structural continuity, source-composited review, real Codex acceptance, full regression/build, and clean security/media hygiene.
- REQ-025 Pre-Storyboard Creative Direction + Approved Style Lock V1 is engineering/client complete: Brand Context stays evidence-only; draft direction is persisted/revisable; opportunity planning/Storyboard require the exact trusted-host-approved content-derived Style Lock; hard style authority cannot be widened by component defaults; V1 migration/reconnect is fail-closed; real STDIO and Codex prove the gate without fabricating visual owner approval.
- REQ-020 raw-video orchestration is an automated release candidate, not a human-certified release. The remaining tag gate requires meaningful real spoken source media with truthful timed evidence, a representative ~10-scene benchmark, legitimate owner Storyboard/timing/Motion approvals, representative parity captures, and an actual 1× watch. Automation must not manufacture those facts.
- G1/G5-C/G6/G7/G8 still retain broader owner/non-editor/performance evidence gaps. Those product-wide human exits are separate from the current G9 engineering release candidate.
- The default automatic transcription provider still fails closed (`TRANSCRIPTION_DISABLED`) and no local/offline recognizer is wired. A real timed sidecar/transcription is therefore required for truthful speech-timed release benchmarking unless that capability is separately implemented/authorized.
- G10-G12 remain conditional. Current local MCP progress does not silently authorize SaaS operations, public remote API exposure, advanced vision, or data/model programs.

## Anti-drift measurement

At every goal exit, record:

1. Median time from import to acceptable export.
2. Editor knowledge the user needed.
3. Proposal acceptance without manual repair.
4. Preview/export agreement.
5. Failure recovery quality.
6. Preservation of source media, history, and project reopenability.
7. Exact evidence level: unit, integration, real media, real browser, or owner acceptance.

Never publish one invented percentage-complete number. A box closes only when its named evidence exists.
# Current implementation checkpoint — 2026-08-03

- [x] P1-F.0.2 Nested Studio Layout Engine V2
- [x] P1-F.0.2.1 Nested Layout Stabilization — technical and E2E gates
- [ ] P1-F.0.2.1 owner visual acceptance
- [x] P1-F.1A Gate A — Preview reliability and export runtime (`0ecffc3`)
- [x] P1-F.1A Gate B — Media Library V2 essentials: compact panel, import by
      kind, OS file drop, sort, filter, durable one-level server folders, closed
      drag payload built but switched off until Gate C
- [ ] P1-F.1A Gate B owner visual acceptance — no screenshots exist; the browser
      pane was not displayed, so layout is measured but appearance is unproved
- [ ] P1-F.1A Gate C — Creator Timeline Core — not started
- [ ] P1-F.1A Gate D — filmstrips and waveforms — not started
- [ ] P1-F.2 — not started
- [x] P1-F.0.2.2 Media responsive presentation and Editor Monitor V1 — technical gate
- [ ] P1-F.0.2.2 owner visual acceptance
- [x] Media V2 sorting and one-level bins — done in Gate B
- [ ] Media V2 multiselect, batch actions, visible Timeline drag/drop — deferred;
      the drag payload and parser exist and are tested, the gesture is off
- [x] Timeline shows real frames and real sound shapes — Gate D, 2026-08-04.
      A creator can find a moment by looking at it, not by reading filenames.
- [ ] Portrait footage in a landscape project can be exported — FAIL-051
- [x] Portrait footage in a landscape project can be exported — FAIL-051 closed
      in Gate T0, 2026-08-05, proved with a real 714x1280 clip in a real 1920x1080
      export
- [x] A creator can pick several things at once and act on them as one — Gate T1,
      2026-08-06. Copy, paste, duplicate, group, and notes pinned to moments.
- [x] Writing a note, or grouping clips, does not throw away a finished export —
      Gate T1. An export is identified by what it will produce, not by how many
      times the project was touched.
- [ ] Speed, reverse and freeze frame — Gate T2, not started
