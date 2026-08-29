# SANVERSE External MCP — Raw-Video End-to-End Creative Orchestration V1

Status: **IMPLEMENTATION + AUTOMATED RC COMPLETE — HUMAN RELEASE GATE OPEN**
Owner instruction date: **2026-08-29**
Automated RC date: **2026-08-30**
Canonical baseline: `bb89e2a2d4c937c4bd0705638428ae68f8bfb11e` / `sanverse-external-mcp-interop-v1`
Implementation branch: `external-mcp-raw-video-v1`

## Automated RC completion — 2026-08-30

- Batches 1–6 are implemented and automated acceptance is green.
- MCP discovery is stable at **52 tools**: the previous 34-tool external surface remains discoverable and the 18 raw-video orchestration tools are additive. Zero-project startup is READY; project-specific legacy calls fail closed with `PROJECT_REQUIRED` until selection/import.
- The official Streamable HTTP MCP client proved: zero projects → bounded MP4 import → analysis-only SRT → source understanding → 3 opportunities → 3 isolated scenes → exact test-host Storyboard/Animatic/Motion approvals → **one** three-operation Creative ChangeSet → real production export → one Undo → one Redo.
- The production export is H.264/AAC, **1280×720 @ 30 fps**, exactly **12.000 s**, **7,174,167 bytes**, with SHA-256 `a6657b0bd18e624d43631ecfc23a2c505b838a955a18082cb444f275b48fe3ee`; downloaded bytes matched the production SHA exactly.
- Real Edge/CDP parity covered **3 scenes × 5 critical ticks**. Preview-surface and export-surface PNGs were byte-identical; direct/backward/random access at the same tick was byte-identical; final H.264 composition comparison had minimum SSIM **0.969474**, above the **0.96** gate.
- Official STDIO discovery/call regression passes at 52 tools and preserves accepted production state through the legacy sandbox edit/review/discard cycle. Codex, Claude Code and OpenCode configuration/endpoint verification is green with no model/provider call.
- The authoritative Windows single-fork repository matrix is **2,990 / 2,990 PASS across 25 workspaces** and the root all-workspace production build exits 0. Four web cases that timed out only under the first heavily parallel run all passed individually and the complete 1,238-test web suite passed in documented single-fork mode without production-code changes.
- Two Windows long-path defects found by the real export proof are fixed without adding authority: the disposable Edge profile uses OS temp, and the disposable render workspace uses a short same-volume Sanverse data-root sibling rather than a project-ID-deep path.
- The immutable release tag `sanverse-external-mcp-raw-video-v1` is **withheld** because the separate manual release proof still requires meaningful spoken source media, the target ten-scene review, legitimate human Storyboard/timing/Motion review, and an actual 1× watch of the final exported video. Test-host approvals and general implementation authorization are recorded distinctly and do not fabricate that visual evidence.

## Mission

Make one external MCP client able to start with a raw local video plus optional transcript/brief and finish through the real Sanverse production authorities:

```text
RAW VIDEO + optional transcript/brief
→ standard Sanverse MCP
→ existing production intake
→ canonical EditProject
→ project-backed Source Understanding
→ inspectable Motion Opportunity Map
→ N isolated Creative scene sessions
→ Storyboard + structural QA
→ exact owner Storyboard approval
→ Animatic + timing QA
→ exact owner Animatic approval
→ Motion Forge + structural/visual QA + localized repair
→ exact owner Motion approval
→ immutable hashed Creative Scene artifacts
→ ONE atomic server-authoritative production ChangeSet
→ one Undo / one Redo
→ normal production preview
→ same Motion visual authority rendered at exact ticks for export
→ existing export job + FFmpeg system
→ verified final MP4
```

The implementation fails if a separate custom animation/FFmpeg/SVG/React path produces pixels that are not the same canonical Sanverse Motion authority used for Creative review and accepted production state.

## Non-negotiable authority law

- MCP owns protocol adaptation, session context, schemas and safety only.
- Production `EditProject`, project repository, ChangeSet acceptance, revision history, Undo/Redo and export jobs stay canonical.
- `MotionSceneV1` / Motion Graph / exact 1,440,000-tick timing stay canonical for Creative visuals.
- AI/external agents may propose candidates; deterministic Sanverse code validates, normalizes, capability-gates and executes them.
- External JSON can never manufacture `OwnerApprovalV1`; owner approval is exact-subject/exact-revision host authority.
- Accepted project state stays editable and references immutable Creative artifacts; temporary export frames are reproducible cache, never visual authority.
- Existing V1.6 KineticHeadline path and existing external MCP tools remain compatible.
- No external AI provider is added by this program.
- No GitHub push occurs until the owner separately asks to publish this new release.

## Batch 1 — zero-project bootstrap, intake, transcript, Source Understanding

Deliver:

- MCP starts and lists tools when `/api/projects` is empty.
- Session state owns optional `activeProjectId`, never a cached accepted-project authority.
- `production.list_projects`, `production.select_project`, `production.import_source_video`, `production.get_project_context`.
- Local import is confined beneath explicit `SANVERSE_MCP_IMPORT_ROOT` / configured allowlist; reject traversal, symlink/junction/UNC/outside-root/non-regular files.
- Import streams bytes into the existing `POST /api/projects` intake path so existing MP4 byte validation/probing/project creation stays authoritative.
- Import idempotency prevents retry duplication.
- Analysis-only `SourceTranscriptV1`; `source.attach_transcript`, `source.get_transcript`; plain/SRT/WebVTT where supported; canonical ticks; no automatic visible captions.
- `source.analyze_video` builds a production-backed `SourceUnderstandingPacketV1` using existing Video Understanding capabilities and truthful limitations.

Gate: `zero project → MCP ready → real bounded MP4 import → active project → transcript/source packet`, with accepted editing history unchanged.

## Batch 2 — Opportunity Map and generalized multi-scene sessions

Deliver:

- `motion.plan_opportunities` and `motion.get_opportunity_map`.
- `targetCount` 1–20; release proof targets 10.
- Validate optional external-agent candidates rather than trusting them; Sanverse owns source evidence, exact ticks, overlap rules, capability support, normalization, deterministic scoring and selection.
- Opportunity entries expose communication/source/visual/cohesion/novelty/capability scores, rationale, presentation/source/background treatments, recommended Library components/recipes and capability status.
- Reuse real B2 Motion Library capability records/ranking, Style Lock and Video Creative Language/cohesion authority.
- Avoid accidental overlap, visually critical source moments, decorative-only graphics, repetition and random component roulette.
- Generalized `CreativeSceneSessionV1` supports multiple independent sessions per project/opportunity.
- `motion.create_scene_sandbox`, `motion.create_scene_batch`, `motion.get_scene_batch`.
- Storyboard/KVS use real source timing/provenance, semantic IDs and actual composition ratio; no fake detached storyboard screenshots.

Gate: one real project → deterministic 10-opportunity map → 10 isolated Storyboards; no Animatic/Motion before approval.

## Batch 3 — exact owner-gated batch Closed Loop

Deliver:

- `motion.advance_scene_batch` stops at each owner gate.
- `OwnerReviewBatchV1` groups exact subjects but yields separate exact approval records.
- Standard MCP gains a host-side opaque approval resolver; client supplies only opaque approval reference after owner action.
- MCP can request/read review state but cannot mint/upgrade/wildcard approvals.
- Storyboard → Animatic requires exact approved Storyboard revision.
- Motion Forge requires exact approved Storyboard + Animatic revisions.
- Production apply requires exact approved Motion revision plus current structural/visual QA.
- Revision changes invalidate only the affected scene approval.
- Safe evidence logs IDs/revisions/refusal codes, never transcripts, approval proof, absolute paths or bearer secrets.

Gate: preapproval calls refuse with typed recovery; legitimate host approval advances; stale/forged/cross-scene approvals refuse.

## Batch 4 — generic production Creative Scene + immutable artifacts

Deliver:

- New render-affecting `add-creative-scene` EditOperation with capability, scene ID, source asset/range, immutable artifact reference, presentation mode, layer and extensions.
- Update EditOperation union, validation, source anchoring, capability registry, replay, ChangeSet atomicity, history, Undo/Redo, serialization/migration/portable archive and export identity.
- Project repository owns bounded immutable `creative-artifacts/<artifact-id>.json` storage; no arbitrary filesystem API.
- Canonicalize artifact bytes and SHA-256; deduplicate identical artifact; retrieval rehashes and refuses `CREATIVE_ARTIFACT_HASH_MISMATCH`.
- Artifact preserves approved render authority: component/module/version, props/style, Motion Graph/operations, semantic IDs, lineage, presentation/source dependencies, duration, assets, style/cohesion refs and required capabilities.
- Minimal project-scoped artifact POST/GET API.
- `production.apply_approved_scene_batch` stages/validates all artifacts then sends all approved `add-creative-scene` operations in ONE ChangeSet against one common live production revision.
- Any failure leaves production unchanged.

Gate: multiple arbitrary supported approved Motion scenes → one accepted ChangeSet → revision +1 → one Undo removes all → one Redo restores all; artifacts remain immutable shelf data.

## Batch 5 — normal production preview and exact-tick export

Deliver:

- Render Plan supports accepted Creative Scene placements and loads immutable artifacts through production-owned resolution.
- Normal production preview uses the same Motion Library module + canonical Motion runtime/graph at deterministic local ticks.
- Direct/backward/random seek at tick N equals sequential evaluation at N; no timer/previous-frame/`Math.random()` visual authority.
- Export adapter materializes canonical Creative artifact through the same Motion runtime at rational frame→tick mapping into transparent RGBA frames.
- Prefer one long-lived controlled Edge/Chromium process/render page; reuse existing CDP/WebSocket infrastructure; no per-frame browser launches or huge new browser framework.
- Temporary rendered frames are export cache only and reproducible from immutable inputs.
- Existing FFmpeg exporter composites RGBA scene frames by source-anchored interval and production layer while preserving project audio/timeline/title/caption/B-roll behavior.
- Capability gate refuses unsupported exact export behavior instead of flattening/simplifying it silently.
- Preview/export parity compares real pixels at opening/mid/payoff/settle/exit ticks with a documented tight threshold.

Gate: Creative Review pixels ≈ production preview pixels ≈ export pixels for representative supported scenes, plus direct-seek determinism and valid FFprobe MP4/audio.

## Batch 6 — final external orchestration surface

Add/complete external tools over the same registry, without deleting existing 34 tools:

- `production.list_projects`
- `production.select_project`
- `production.import_source_video`
- `production.get_project_context`
- `source.attach_transcript`
- `source.get_transcript`
- `source.analyze_video`
- `motion.plan_opportunities`
- `motion.get_opportunity_map`
- `motion.create_scene_sandbox`
- `motion.create_scene_batch`
- `motion.get_scene_batch`
- `motion.advance_scene_batch`
- `production.get_owner_review_status`
- `production.apply_approved_scene_batch`
- `production.export_video`
- `production.get_export_status`
- `production.cancel_export`

Health derives the actual registry count and treats no active project as ready rather than failed.
Tool descriptions state mutation class, sandbox-only behavior, exact revision/approval requirements and expected ordering.
HTTP and STDIO retain standard MCP compatibility, loopback/bearer/origin/session safety and lifecycle cleanup.

## Typed refusal baseline

At minimum standardize:

`PROJECT_REQUIRED`, `PROJECT_NOT_FOUND`, `PROJECT_SELECTION_STALE`, `IMPORT_ROOT_NOT_ALLOWED`, `IMPORT_PATH_INVALID`, `IMPORT_SYMLINK_ESCAPE`, `IMPORT_FILE_NOT_FOUND`, `IMPORT_MEDIA_UNSUPPORTED`, `TRANSCRIPT_INVALID`, `TRANSCRIPT_SOURCE_MISMATCH`, `SOURCE_ANALYSIS_STALE`, `OPPORTUNITY_MAP_STALE`, `OPPORTUNITY_SOURCE_INVALID`, `OPPORTUNITY_OVERLAP`, `SCENE_SESSION_NOT_FOUND`, `SCENE_CAPABILITY_UNAVAILABLE`, `SCENE_EXPORT_CAPABILITY_UNAVAILABLE`, `SCENE_SOURCE_STALE`, `STORYBOARD_APPROVAL_REQUIRED`, `ANIMATIC_APPROVAL_REQUIRED`, `MOTION_APPROVAL_REQUIRED`, `APPROVAL_STALE`, `SCENES_BASE_REVISION_MISMATCH`, `CREATIVE_ARTIFACT_INVALID`, `CREATIVE_ARTIFACT_HASH_MISMATCH`, `PRODUCTION_REVISION_STALE`, `CHANGE_SET_REJECTED`, `EXPORT_NOT_READY`, `EXPORT_FAILED`.

Where practical every refusal includes a recovery action.

## Idempotency and revision fencing

- Import transaction + same source must not duplicate project creation.
- Same scene transaction/opportunity returns same session.
- Same artifact hash reuses immutable artifact.
- Same batch-apply transaction never duplicates accepted scenes.
- Export uses existing export idempotency.
- Every sandbox/session mutation fences relevant `sandboxId`, sandbox revision and production revision.
- Cross-scene sandbox IDs and stale production revisions refuse.

## Required automated proof

Tests cover project intake/root escape/symlink/media bytes/idempotency; plain/SRT/VTT transcript/ticks/bounds/no captions; opportunity count/scores/order/overlap/capability/staleness/candidate validation; 3+ scene isolation; approval isolation/invalidation; generic operation/capability/source/artifact/history/Undo/Redo/archive; artifact hashing/dedup/tamper; preview exact ticks/direct seek; transparent frame export/dimensions/alpha/text/mask/effects/transforms/determinism; FFmpeg source+Creative+audio; atomic multi-scene acceptance; HTTP+STDIO initialize/list/call/auth/origin/session/owner resolver/import/export.

Automated bounded acceptance must use MCP/internal production boundaries end-to-end:

`no project → import bounded fixture MP4 → attach transcript → analyze → opportunities → >=3 scene sessions → host-test Storyboard approval → Animatic → host-test timing approval → Motion → QA → host-test Motion approval → stage artifacts → one apply → production preview → export/poll/verify MP4 → Undo/verify scenes removed → Redo/verify restored`.

Tests may use a test host approval authority; release claims must distinguish that from actual owner review.

## Manual release proof

After automated gates are green, use meaningful real spoken source media (not a synthetic color/test-only source) and target 10 opportunities/10 scenes. Retain the real opportunity map, source ranges, communication goals, Storyboards, legitimate owner Storyboard approvals, Animatics, timing approvals, Motion drafts, QA/repairs, legitimate final Motion approvals, one atomic apply, Undo/Redo/reapply, final MP4, preview/export parity captures for >=3 scenes and an actual 1× watch of the complete exported video.

The visual review judges timing usefulness, source integration, readability, balance, subject coverage, entrance/easing/hold/payoff/exit, video-level cohesion and template-spam risk. Findings are repaired locally by exact time + semantic node ID, then reviewed again.

Cross-client smoke after the primary benchmark proves standard MCP remains discoverable from Codex, Claude Code and OpenCode (`connect → tools/list → read project → safe create/discard sandbox`); three full ten-scene exports are not required.

## Release gate / stop rule

Do not create `sanverse-external-mcp-raw-video-v1` until all applicable implementation, automated, preview/export, real-MP4, audio, security, full test/build and actual 1× owner-review gates are truthfully green. If a genuinely human-only approval or meaningful real-source benchmark prerequisite is missing, complete every implementation/automated/documentation task possible, commit a coherent release candidate if useful, explicitly record the human gate, and **withhold the release tag** rather than fabricating evidence.

After a valid tag, stop. Do not start V1.8/V2 automatically.
