# Requirements

Status values: `Approved`, `Proposed`, `Deferred`, `Rejected`, `Superseded`.

## Approved requirements

### REQ-001 — Non-editor interaction

- Status: Approved
- The product must let a non-editor request changes through chat, pointing, drawing, and simple direct manipulation.
- The default workflow must not require learning professional NLE concepts.
- Source: owner conversation.

### REQ-002 — Minutes, not hours

- Status: Approved
- The product must optimize for completing real talking-head edits in minutes rather than hours.
- Exact latency budgets will be established from G3/G4 baseline measurements; no unsupported number is claimed at G0.
- Source: owner correction.

### REQ-003 — Safe, non-destructive editing

- Status: Approved
- Original media must remain immutable.
- Accepted edits must be reproducible, versioned, undoable, and auditable.
- Consequential changes require a real preview or explicit approval.

### REQ-004 — AI proposes; deterministic code executes

- Status: Approved
- AI output cannot directly mutate project state or invoke arbitrary renderer operations.
- Intent must become a typed, bounded proposal validated against the project, capabilities, policy, and schema.
- Ambiguity must trigger clarification, preview, or refusal instead of a silent guess.

### REQ-005 — Production-grade architecture from day one

- Status: Approved
- Module boundaries, contracts, migrations, security boundaries, tests, observability hooks, and replaceable adapters must be designed from the beginning.
- This does not require building full login, billing, multi-tenancy, Kubernetes, or enterprise operations before product value is validated.

### REQ-006 — Minimal black-and-white interface

- Status: Approved
- Initial branding uses black, white, and grayscale.
- The interface should be calm and clean like the referenced OpenDesign experience, adapted to video editing rather than copied.
- Fancy decoration and advanced theming are deferred.

### REQ-007 — Staged editing primitives

- Status: Approved
- The engine must eventually support the reusable primitives behind cut, trim, split, ripple, reorder, transform, crop, scale, rotation, opacity, layers, keyframes, easing, springs/bounce, transitions, text, audio, and basic effects.
- These primitives are introduced in goal order through end-to-end user outcomes, not all at once.

### REQ-008 — Durable continuity and drift prevention

- Status: Approved
- A new or compacted session must resume from committed project truth rather than chat memory.
- Requirements, decisions, current state, active plan, failures, and evidence must remain separately inspectable.
- Owner corrections must update the durable record in the same change set.

### REQ-009 — Evidence-based accuracy

- Status: Approved
- Exact deterministic behavior requires reproducible tests.
- Semantic behavior requires representative evaluations and fail-closed handling.
- No “100% accuracy” claim may be made without defining the measured population and showing evidence.

### REQ-010 — Stage 1 boundary

- Status: Approved
- Stage 2 accepts a cleaned MP4 from Stage 1 as the minimum input contract.
- Transcript, word timings, cut map, or EDL are optional accelerators, not a hard dependency for the first vertical slice.
- Stage 1 remains read-only during Stage 2 development unless the owner explicitly changes scope.

### REQ-011 — Owner-visible collaboration

- Status: Approved
- Before materially changing direction, explain what is understood, what is assumed, and what will be built next.
- The owner approves medium-to-large goal transitions.
- Technical explanations must remain understandable to a non-technical founder.

### REQ-012 — Calm landing before the editing Studio

- Status: Approved
- A first-time or returning user must land on a calm Home screen centered on one chat/upload composer, drag-and-drop video entry, and recent projects.
- Editing controls, canvas tools, proposals, history, and the time strip must remain hidden until the user opens or creates a video project.
- Starting may happen by dropping a cleaned video, attaching one inside the composer, opening a recent project, or describing the intended edit and then supplying the video.
- Source: owner correction on 2026-07-12.

### REQ-013 — Web delivery and fixed local port

- Status: Approved
- Stage 2 must be built as a browser-accessible web application.
- The user-facing local development server must bind to port 2000.
- Local startup must use strict port behavior: if port 2000 is occupied, startup fails visibly instead of silently switching to 3000, 5000, 8000, or another port.
- Port 2000 is a local-development constraint. A deployed web application will use its hosting platform's normal public HTTP/HTTPS routing.
- Source: owner correction on 2026-07-12.

### REQ-014 — Proportionate hierarchy and purposeful motion

- Status: Approved
- The Home question must guide the user without dominating the whole viewport.
- Moving between Home and Studio, selecting a video, and pressing primary controls must feel continuous rather than like an abrupt cut.
- Screen navigation must use one restrained smooth curve. Direct controls may use a brief, purposeful spring response so presses and focus changes feel physical rather than abrupt; this spring must not become decorative page motion.
- Motion must reinforce the user's action and be explicitly removed when reduced motion is requested.
- Source: owner real-video walkthrough and material correction on 2026-07-13.

### REQ-015 — Visual-first external component ingestion

- Status: Approved
- External visual agents may create reusable motion components in different implementation environments, but every owner-approved visual must enter Sanverse through one fail-closed component-ingestion contract before it becomes public.
- The approved visual appearance is authority. Engineering may normalize implementation, extract typed properties, semantic nodes, keyframes, expert boundaries and responsive behavior, but may not aesthetically reinterpret or silently approximate the approved result.
- Public registration requires owner approval, deterministic/direct-seek validation, immutable source evidence, visual parity, canonical Motion Graph/edit controls, review evidence and Library metadata.
- All ten CH1 source visuals are owner-approved as of 2026-08-14. Component 01 (`sanverse.icon-rail`) also received direct owner approval of the synchronized integrated parity view.
- The Sanverse coding agent in this worktree owns the complete engineering conversion and Library insertion; this work is not delegated to another coding agent.
- For CH1 Components 02–10, the owner explicitly authorized the coding agent on 2026-08-14 to preserve the approved source visuals, perform the engineering parity/productization review, and insert the verified results into the Library without a separate manual owner viewing round for every component. This batch authorization must be recorded distinctly from direct owner parity review.
- Completion means the components themselves are public, searchable and playable in the Sanverse Creative Library—not merely staged in an intake folder or represented by placeholders.
- Source: owner-approved Component Ingest V1 contract and owner corrections on 2026-08-14.

### REQ-016 — Creative Engine Closed-Loop V1, then MCP V1

- Status: Approved
- The existing Creative Engine must reach a complete UI-independent closed loop before MCP is allowed to expose it: source/capability context → isolated Storyboard KVS → explicit Storyboard approval → exact-tick Animatic → explicit Animatic approval → MotionPlan/Motion Forge → structural and visual QA → bounded repair → explicit Motion approval → one atomic accepted-project merge → one inverse Undo.
- The loop must reuse the existing canonical Motion Scene/Graph, C2 keyframes, C3 Layers, C4 Dope Sheet, C5 Curves, C6 node projection, C8 masks/mattes, exact-tick clock, Library registry and graph inverse operations. It must not create a second graph, renderer, keyframe engine, timeline, Library or Undo authority.
- External assets must be inspected with explicit provenance/rights/editability and fail closed when lossless support is unavailable. Unsupported SVG/Lottie features must refuse rather than silently approximate; alpha video remains an external exact-time asset rather than pretending to be an editable graph node.
- Storyboard/Animatic/Motion owner approvals are explicit and revision-bound. A model/tool caller cannot manufacture approval authority.
- MCP V1 is a thin adapter over the accepted internal tool registry. MCP may list/call the same tools but may not own project, Storyboard, Motion Graph, approval, merge or Undo state, and it may not bypass the internal registry validation/sandbox gates.
- Production `apps/web/**` remains outside this development-only implementation cycle.
- Source: owner implementation instruction on 2026-08-26: take the existing Creative Engine to 100% of Closed-Loop V1, then expose that stable closed loop through MCP V1.

### REQ-017 — Creative Engine V1.1 promotion, parameterization and reuse flywheel

- Status: Approved
- An exact owner-approved Motion revision may be copied into an isolated promotion workspace and productized into reusable Sanverse capability without mutating the approved source. Unapproved, stale-approved, QA-failed, graph-invalid or insufficiently evidenced source must fail closed.
- Promotion must conservatively separate project content from frozen design constants, bind reusable parameters only to stable semantic graph identities, preserve generated origin and immutable lineage, aggregate dependency rights using the most restrictive relevant source, and require successful promotion QA before atomic Library registration.
- V1.1 must prove reusable scene/component productization plus role-based Motion Recipe extraction. Reuse must instantiate as ordinary canonical Motion Graph content, not an opaque runtime, and must remain editable through C3/C4/C5/C6 with deterministic direct-seek behavior and existing one-action/Undo semantics.
- The decisive release proof is cross-project: Project A approved generated scene → promote/register → normal B2 retrieval → Project B instantiate in sandbox → change content/value/accent/style → apply recipe → review → approved apply → Undo restores Project B.
- Promotion/reuse tools are implemented in the existing internal registry first. The existing MCP remains a thin adapter and may expose the new safe internal tools only after the internal cross-project reuse loop passes; neither AI nor MCP may manufacture owner approval or rewrite lineage.
- Production `apps/web/**`, the separately versioned `sites/` repository, B6/B7/B8, C9+, tracking/3D/particles, advanced external conversion and production-editor integration are outside this V1.1 milestone.
- Source: owner-provided SANVERSE CREATIVE ENGINE V1.1 Promotion + Parameterization + Reuse Flywheel implementation plan on 2026-08-26.

### REQ-018 — Creative Engine V1.2 → V1.3 → V1.4 continuous gated program

- Status: Approved
- Execute V1.2, V1.3 and V1.4 continuously but as three independently verified local releases. A later version cannot begin until the previous version has every required contract/implementation/tool/QA/direct-seek/real-1×-browser/regression/build gate green plus its own local commit and immutable local tag; known failed work may never be carried forward.
- V1.2 must make a bounded supported subset of M5 tracked/attached, M6 surface-embedded and M7 subject/environment operational through Sanverse-owned canonical tracks/mattes, deterministic graph bindings and C8 compositing; add B6 Style Intelligence, B7 Video Creative Language/cohesion, supported React/SVG and Remotion materialization, source-aware semantic tools, then expose the proven internal surface through the existing thin MCP.
- V1.3 must add graph-native deterministic 2.5D camera/depth that composes with C9, structured B8 owner-preference/failure intelligence with conservative evidence promotion and explainability, truthful supported Rive inspection/materialization/wrapping decisions, camera/depth semantic tools, and thin MCP exposure after internal proof.
- V1.4 must add bounded deterministic Expert Runtime support for procedural, analytically/reconstructably evaluated particles, shader nodes with canonical tick/seed uniforms, truthful external procedural/shader bridges, expert recipes and safe internal/MCP tool exposure without allowing expert code to own time, project state, filesystem/network authority, approval or Undo.
- Across V1.2–V1.4 the canonical 1,440,000-tick clock, Motion Graph, semantic IDs, C3/C4/C5/C6/C8, Storyboard/Animatic/MotionPlan, locks, approvals, transactions/Undo, Library, promotion/lineage, internal registry, MCP and QA remain the authorities. No TrackingGraph, CameraGraph, ParticleGraph, ExpertGraph, ShaderTimeline or provider-specific render truth may be introduced.
- Every new time-varying capability must prove render-at-N = direct-seek-N = backward-seek-N = random-access-N. Owner approval remains explicit/revision-bound and cannot be generated by AI/MCP. Rights/provenance remain fail-closed and most-restrictive across all dependencies.
- `apps/web/**` remains protected with zero intentional changes. The separately versioned `sites/` repository remains preserved/excluded. No GitHub push/fetch/PR/Actions occur. After V1.4, run the full V1.0→V1.4 regression/root-build/isolation matrix and stop before C13, AEP/MOGRT, universal Three/WebGL or production-editor integration.
- Source: owner-provided SANVERSE CREATIVE ENGINE V1.2 → V1.3 → V1.4 Continuous Implementation Program on 2026-08-26.

### REQ-019 — External MCP interoperability over the production-backed Sanverse engine

- Status: Approved
- External Codex, Claude Code and OpenCode clients must connect through standard MCP transports to the same Sanverse internal tool registry and production-backed project authority; no client-specific MCP engine, model provider, project store, Motion Graph, approval store or Undo history may be introduced.
- Streamable HTTP and STDIO must support the standard initialize/initialized/tools-list/tools-call flow. HTTP must remain loopback-bound, require a local bearer credential, reject non-local Origin/Host use, isolate client sessions, expose bounded health/status, and clean up terminated or abandoned sessions.
- External candidate writes must remain sandbox-only by default, require the live production revision, and fail closed on stale revision or cross-session sandbox identity. External callers cannot manufacture owner approval or bypass the production editor/server accepted-project authority.
- Setup for installed Codex, Claude Code and OpenCode must be reversible and must alter only the MCP entry named `sanverse`; unrelated MCPs, model/provider settings and user media remain untouched.
- Completion evidence proves the standards-compatible MCP layer, reversible client configuration, transport readiness, deterministic tool discovery/calls, sandbox safety and lifecycle behavior. Model/provider-driven usage inside Codex, Claude Code and OpenCode is owner validation and is not a release gate for this MCP-layer milestone.
- Long-run readiness must prove repeated standard MCP sessions do not mutate accepted production state or leak active sessions. A benchmark starter kit may be prepared, but the raw-video/model-quality benchmark is not run unless separately authorized.
- No GitHub fetch/pull/push/PR/Actions and no `sites/**` change are part of this local interoperability release.
- Source: owner-approved SANVERSE EXTERNAL MCP INTEROPERABILITY V1 implementation instruction and repeated autonomous-completion authorization on 2026-08-28/29.

### REQ-020 — External MCP raw-video end-to-end Creative orchestration

- Status: Approved
- Starting from canonical published `main` at `bb89e2a2d4c937c4bd0705638428ae68f8bfb11e`, the external MCP must be able to start with zero projects, safely import a permitted local raw MP4 through the existing production intake authority, attach analysis-only transcript/timestamp context without silently creating visible captions, and build a real project-backed Source Understanding packet using existing Sanverse capabilities with truthful limitations.
- The external agent may propose source moments, but Sanverse owns validation, exact 1,440,000-tick normalization, source evidence, overlap rules, capability support, inspectable Motion Opportunity scoring, B2 Motion Library/Recipe retrieval, Style Lock and Video Creative Language/cohesion. The release proof targets ten useful opportunities and multiple actual component/scene/recipe families rather than a KineticHeadline-only path.
- One project may own multiple isolated Creative scene sessions. Every scene follows the existing Storyboard → exact owner Storyboard approval → Animatic → exact owner timing approval → Motion Forge → structural/visual QA and localized repair → exact owner Motion approval chain. A client cannot mint, wildcard, upgrade or carry approval to a new revision; standard MCP may resolve only opaque host-issued approval references for exact approved subjects/revisions.
- Production acceptance must gain one generic render-affecting `add-creative-scene` operation referencing an immutable, bounded, project-local, canonicalized SHA-256 Creative artifact that preserves the exact approved Motion/render authority and lineage. Artifacts are shelf data until referenced by an accepted ChangeSet and must fail closed on schema/hash/source/capability mismatch.
- All approved scenes generated against one common production revision must be accepted as ONE server-authoritative ChangeSet so project revision moves once, one Undo removes the entire batch, and one Redo restores it. Stale production state or any invalid/unsupported scene makes the whole apply fail without mutation.
- Accepted Creative Scenes must appear in the normal production preview and export through the SAME Sanverse Motion component/graph/runtime authority. Export may materialize exact-tick transparent RGBA frames ephemerally and composite them with the existing FFmpeg production exporter, but accepted project state may not be flattened to video or replaced by bespoke agent-written FFmpeg/SVG/React animation truth.
- Preview and export must prove deterministic direct/backward/random seek, rational frame-to-tick mapping, capability-gated exact support and real pixel parity at critical ticks. Unsupported tracked/matte/shader/expert behavior must refuse rather than silently degrade.
- The existing production export job authority must be exposed thinly through MCP for start/status/cancel. MCP health must derive the actual registry tool count and remain ready with no active project. Existing V1.6 KineticHeadline and the prior external MCP surface remain backward-compatible.
- Filesystem import is constrained by explicit allowlisted root(s) and rejects traversal, symlink/junction/UNC/outside-root/non-regular files; existing media byte/probe validation remains authoritative. Event evidence may include safe IDs/revisions/refusal codes but never bearer credentials, approval proof, full transcripts, binary media or private absolute paths.
- Mutating workflow operations are idempotent where retries are expected and revision-fenced by relevant project/sandbox/scene identities. Typed refusals cover project/import/transcript/source-analysis/opportunity/scene/approval/artifact/stale-production/change-set/export failures with actionable recovery where practical.
- Automated completion requires HTTP + STDIO MCP regression and a bounded raw-video end-to-end proof through actual MCP/internal production boundaries: no project → import → transcript → source analysis → opportunities → multiple gated scene sessions → test-host exact approvals → artifacts → one atomic apply → production preview → existing export job → verified MP4/audio → Undo/Redo.
- Automated RC evidence completed 2026-08-30: zero-project HTTP MCP is READY with **52 discoverable tools** (34 prior + 18 additive); the bounded official-client E2E completed 3 scene sessions with exact test-host Storyboard/Animatic/Motion approvals, one three-operation Creative ChangeSet, one Undo/Redo and a verified H.264/AAC 1280×720 30fps 12.000s export whose production/downloaded SHA-256 is `a6657b0bd18e624d43631ecfc23a2c505b838a955a18082cb444f275b48fe3ee`. Real Edge parity is exact for preview/export and direct/back/random seek across 15 critical frames; final MP4 minimum SSIM is 0.969474 against a 0.96 floor. Official STDIO is green at 52 tools, the authoritative Windows single-fork repository matrix is **2,990/2,990 PASS across 25 workspaces**, and the root build passes.
- Final release tagging additionally requires a meaningful real spoken-video benchmark targeting ten opportunities/ten scenes, legitimate owner Storyboard/timing/Motion approvals, actual 1× review of the final exported video, representative preview/export pixel-parity evidence, and cross-client MCP discovery smoke. If a genuinely human-only approval or meaningful-source prerequisite is unavailable, all engineering may finish but the immutable `sanverse-external-mcp-raw-video-v1` tag must be withheld rather than fabricating proof.
- No push of this new release occurs unless the owner separately authorizes publication. Existing published history/tags and `sites/**` remain untouched.
- Source: owner-provided `SANVERSE EXTERNAL MCP — RAW-VIDEO END-TO-END CREATIVE ORCHESTRATION V1` implementation program on 2026-08-29.

### REQ-021 — Zero-setup local MCP for Codex, Claude Code and OpenCode

- Status: Approved
- Local Codex, Claude Code and OpenCode must use Sanverse through STDIO by default. The owner must not need to start `sanverse:mcp:dev`, manage a bearer token, set a Sanverse environment variable, synchronize worktree credentials, or manually edit MCP configuration before normal use.
- The configured local `sanverse` STDIO command must start or reuse the existing Sanverse production API and existing web/render service before exposing the same stable **52-tool** registry. Startup output from those background services must never enter STDIO stdout; stdout remains reserved for MCP protocol framing.
- Local STDIO requires no bearer credential. The previous HTTP implementation remains available for explicit debugging/future remote use and keeps its existing loopback/authentication protections, but HTTP is no longer the normal local-agent path.
- One reversible setup action performed by the coding agent must install only the `sanverse` MCP entry for Codex, Claude Code and OpenCode, preserve unrelated MCP/model/provider settings, remove the legacy Sanverse user token environment variable, and require no owner copy/paste or manual config editing afterward.
- Runtime and safety authority remain unchanged: the same production API, project/revision fences, sandbox-first writes, host-only owner approval, canonical Motion runtime, export authority and Undo/Redo protections apply over STDIO.
- Verification requires direct STDIO discovery of 52 tools, automatic API + web readiness from a cold local state, no legacy user token environment variable, persisted STDIO configuration for all three clients, a real Codex `production.list_projects` call, and a real OpenCode `production.list_projects` call. Per owner instruction on 2026-08-30, Claude Code configuration-level `Connected` proof is sufficient for this slice; do not spend further time on its model-session timeout.
- Full repository regression and all-workspace production build must pass before commit/push to `external-mcp-raw-video-v1`.
- Source: owner-provided `SANVERSE ZERO-SETUP LOCAL MCP` implementation instruction and explicit autonomous-completion/push authorization on 2026-08-30.
