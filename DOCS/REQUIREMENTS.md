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

### REQ-022 — Chat-first review + resumable Creative Run V1

- Status: Approved
- Creative workflow state must be durable and project-scoped so Storyboard → Animatic → Motion review can survive MCP/client restart without asking the owner or agent to reconstruct hidden session state. Rehydration must bind the same project/base revision, opportunity map, scene identities, current graph revisions and pending reviews, and corrupted/mismatched state must fail closed.
- Owner review must be chat-first when the MCP client can present native evidence/elicitation. The owner must see canonical rendered review evidence directly rather than being asked to copy an opaque internal review URL or approval reference. Clients without elicitation may use an automatically opened trusted loopback browser fallback; the model never becomes approval authority.
- Every review decision must bind exact `runId`, `reviewId`, scope, scene, subject identity/revision and evidence hash. Ordinary model-callable JSON/free text cannot create trusted host decision context or `OwnerApprovalV1`. Multi-round-trip request state must be integrity protected and revalidated with the current persisted review before host-only approval issuance.
- Review-only artifacts may use the canonical renderer before Motion approval only when explicitly marked non-production. They must never become acceptable production artifacts. Production artifacts keep the existing exact Motion owner-approval requirement.
- Request-revision and reject are localized: revising one scene invalidates only that scene's affected downstream approval lineage; rejecting one scene excludes only that scene. Approved/pending sibling scenes remain intact.
- Opportunity planning means **up to N useful moments**, not exactly N filler scenes. Agent candidates validate independently; conservative timing repair may retain useful candidates; invalid/overlapping candidates are rejected individually; the planner only falls back when no useful semantic candidate survives.
- Verification requires persisted-store/reconnect/security tests, native chat evidence, trusted local-browser fallback tests, real STDIO multi-round-trip acceptance, independent real Codex and OpenCode resume/read smoke, full repository regression, root production build, dependency/security hygiene and branch push/SHA parity. The final raw-video human release tag remains governed by REQ-020 and is not created by this slice.
- Source: owner-provided `SANVERSE CHAT-FIRST REVIEW + RESUMABLE CREATIVE RUN V1` contract and repeated autonomous-completion/push authorization on 2026-08-31.

### REQ-023 — Same-task MCP continuation across client/process restart

- Status: Approved
- A coding task/conversation and its MCP transport are separate lifetimes. Closing the coding client, restarting the client process, sleeping/rebooting the laptop, or replacing the Sanverse STDIO child process must not require creating a new coding task/chat. The client resumes the same durable task/session ID and starts a fresh MCP transport.
- Sanverse must be safe to relaunch repeatedly from the persisted client configuration. MCP initialize/tool discovery must not wait for API/web cold-start completion; shared production services may warm in parallel, while actual production tool execution waits for readiness and fails clearly if readiness ultimately fails.
- Creative work continuity comes from durable project-scoped Creative Runs, not from an MCP process or model memory. After reconnect the same task may use `creative.list_runs` / `creative.resume_run` and must recover the exact project/base revision, stage, scene identities, pending review identity/revision/evidence hash and review artifacts.
- A live client process that previously failed MCP initialization may need that client to perform an MCP reconnect/reinitialize (or restart its runtime while retaining the same task/session ID). Sanverse cannot inject tools into a host process that never sends another MCP initialize/tools request; this is a transport-host limitation, not a reason to create a new task/chat.
- Verification requires two independent Sanverse STDIO child processes with process A fully closed before process B, exact persisted run/review/evidence parity after `creative.resume_run`, no production mutation, and at least one real coding client proving process exit followed by resume of the exact same client session ID with successful Sanverse calls.
- Source: owner requirement on 2026-09-01 that normal real-world continuation survive laptop/client/process shutdown without creating a replacement task/chat.

### REQ-024 — General Storyboard Authoring Surface V1

- Status: Approved
- External coding agents must receive the full typed expressive authority of the canonical Sanverse Motion Graph **inside Storyboard sandbox state**. Acceptance examples such as `$ → £`, rectangle/bar → circle/ellipse, deleting a badge, adding labels/icons, layout replacement, component detachment, presentation changes and full graph-native redesigns must be solved through general canonical authoring operations rather than special-case tools.
- Extend the canonical Motion Graph only for genuine authoring gaps: typed static node properties (including text font/alignment, shape kind, path geometry and canonical image source/fit), atomic `replace-node`, atomic `replace-subtree`, and semantic-part authoring where absent. No arbitrary JSON patching, second graph, React/FFmpeg authoring escape route, arbitrary JavaScript/GLSL/WebGL or unbounded expert code is permitted.
- Storyboard authoring must support revision-fenced atomic multi-KVS graph transactions, all-states targeting helpers, state/setup/presentation editing, component materialization with preserved lineage, semantic node identity, bounded complexity, typed authoring inspection/schema, concise semantic diffs, hard-vs-soft style validation, source/capability checks and persistent restart-safe state. One user design instruction must either apply completely or leave every targeted state unchanged.
- Component content binding must be semantic and fail closed. If source-driven content cannot satisfy a component contract, return `CONTENT_BINDING_FAILED` (or choose/materialize a different graph-capable component); never silently fall back to shipped demo/default content. QA must detect unbound component defaults through declared/default fingerprints rather than global word blacklists.
- Storyboard owner approval is the design lock. After exact Storyboard approval, graph/content/layout/style/presentation/KVS design mutations must refuse until explicit reopen creates a new Storyboard revision and invalidates the old approval/downstream state. Motion-stage revisions may change time-varying execution only; design-semantic changes require Storyboard revision.
- The exact approved Storyboard graph must become the structural baseline for Motion Forge. Motion Draft may not reapply the plan to the stale original candidate scene. Stable semantic node IDs must survive Storyboard → Animatic → Motion wherever structurally possible, and a release-blocking test must prove a Storyboard redesign such as `$29`/rectangle → `£29`/ellipse remains `£29`/ellipse in Motion.
- Storyboard review evidence must default to actual source-composited pixels for presentation modes where source video is visible, using the exact `sourceFrameRef` plus the current canonical graph/treatment. Chat review must expose scene/time/goal/lineage, KVS source composites, QA/warnings and revision before host-only owner approval. Visual pixel review remains required in addition to graph validity.
- The external MCP surface must stay compact and typed: inspect scene, authoring schema, one general graph/design transaction surface, presentation/KVS/materialization/validate/render/reopen operations as needed. MCP JSON Schema must describe the actual discriminated operation union rather than `string[]`; all mutations require `runId`, `sceneId` and exact `expectedSandboxRevision` where applicable.
- Verification requires canonical graph operation unit tests (static properties, replace node/subtree, locks, inverse/atomicity), multi-KVS atomicity, style/QA/default-content refusal, Storyboard lock/reopen, approved-design Motion handoff, source-composite pixels, persistence/reconnect, and a real Codex MCP authoring battery including currency change, shape replacement and at least one major redesign without source-code/FFmpeg/manual graph-file edits. The existing raw-video human release tag remains governed by REQ-020 and is not created by this slice.
- Source: owner-provided `SANVERSE GENERAL STORYBOARD AUTHORING SURFACE V1` implementation program on 2026-09-01.

### REQ-025 — Pre-Storyboard Creative Direction + Approved Style Lock V1

- Status: Approved
- The raw-video Creative Run must introduce a first-class Creative Direction owner gate after Source Understanding and before opportunity planning or Storyboard creation. Brand Context is input evidence; Creative Direction / Approved Style Lock is video-wide visual+motion language authority; Storyboard remains the later scene-specific design authority. These three layers must not be conflated.
- Brand Context is optional, project/source-scoped evidence assembled from owner brief, bounded palette/type/traits, safe workspace brief files, logos/reference assets and existing approved/promoted creative signals. Missing formal brand data must not skip the Creative Direction review; Sanverse proposes a neutral/source-aware direction instead.
- A persisted `CreativeDirectionProposalV1` is draft/revisable review state and must never be called or identified as an authoritative Style Lock. Only exact trusted host approval of one proposal revision/evidence hash may compile a content-derived `ApprovedStyleLockV1` with separate owner approval identity.
- Owner approval/review scope must include `creative-direction` using the existing secure chat-first review/host approval authority. Models may propose/revise/read direction and propose review decisions but cannot mint approval. Every revision stales prior evidence and approval.
- Creative Run persistence is versioned to V2 with explicit V1→V2 migration. Existing V1 auto-generated style recommendations migrate only to draft/awaiting-owner Creative Direction state; migration must never fabricate historical Style approval. Existing downstream artifacts may be retained for audit but require Creative Direction certification before further promotion.
- Normal V2 opportunity planning consumes an already approved Style Lock and must not call `recommendStyleLockV1()` or accept style-generation parameters. Planning and raw-video scene creation refuse before exact approved Creative Direction and verify project/source/proposal/hash provenance. Storyboard, Animatic, Motion Plan and final Creative artifacts retain the same approved Style Lock identity/hash/revision lineage.
- Approved hard style constraints are immutable authority. Library/component defaults may be normalized into approved semantic palette/font roles or refused; a candidate must never widen the approved palette/fonts simply because its defaults contain another color/typeface. Ambiguous normalization returns a typed refusal. Soft style preferences remain warnings and explicit scene exceptions are bounded by named cohesion dimensions.
- Reopening/revising approved Creative Direction increments proposal revision, removes/stales the prior approved Style Lock and invalidates active opportunity map, Storyboard/Animatic/Motion and review authority without mutating the accepted production project or creating production Undo history.
- Local MCP workspace discovery may classify bounded `.md`/`.txt` files as `brief` through the existing confined workspace boundary. `brand.md` is only a convention; relevant safe brief filenames are agent-selected and arbitrary project source files are not blindly read.
- External MCP adds a compact typed direction surface approximately `creative.propose_direction`, `creative.get_direction`, `creative.revise_direction`, `creative.reopen_direction`; generic review tools remain the approval path. Review evidence must show a bounded human-readable Creative Direction board, preferably source-aware, and the workflow must explicitly stop with `OWNER_CREATIVE_DIRECTION_REVIEW_REQUIRED` before opportunities/Storyboard.
- Verification must cover approval/review scope, legal/illegal stage transitions, no-approval and scene-bypass refusal, stale-style/revision/evidence refusal, hard palette/font lock normalization/refusal, Storyboard design freedom under a Style Lock, downstream invalidation, reconnect before/after approval, V1 migration without fabricated approval, exact Style Lock provenance through Motion/final artifact, workspace brief confinement, and real STDIO/Codex acceptance of propose → owner revision → review gate → trusted approval → opportunities/Storyboard. Broad owner authorization to continue engineering is not evidence of having visually approved a specific Creative Direction revision.
- Source: owner-provided `SANVERSE PRE-STORYBOARD CREATIVE DIRECTION + STYLE LOCK V1` implementation program on 2026-09-01.

### REQ-026 — Canonical Motion Graph Supplemental Renderer V1

- Status: Approved
- Every enabled/visible supported Motion Graph node reachable from the canonical scene root through `group.childIds` must have a deterministic pixel path on Storyboard review, normal preview and export surfaces. Structural QA success may never coexist with silent omission of an authored visual node.
- Registered component-native React/CSS remains authoritative for the component's shipped baseline nodes. Canonical nodes authored beyond that baseline must be rendered by a shared supplemental graph surface, with ancestor group visibility/opacity/transforms/effects/masks/blend and ordering among supplemental siblings preserved from the exact evaluated scene/tick. The V1 supplement is composited above the registered component surface; it does not claim arbitrary interleaving inside bespoke component DOM subtrees. Baseline nodes must not be generically duplicated merely because a scene override exists.
- The supplemental renderer must support canonical shape, text, path and Expert nodes directly. Image nodes may render only through locally resolvable/browser-safe sources; an unresolved opaque image source must fail closed with a typed/runtime refusal rather than disappearing silently.
- `CreativeSceneSurface`, source-composited review and export must consume the same `artifact.motion.scene` and shared native runtime, so a custom node visible in one surface cannot be absent from another at the same exact tick. Preview/export exact-pixel parity is required for a deterministic review-purpose artifact containing custom graph nodes.
- Verification requires a red regression proving an enabled authored node under `root.childIds` was previously omitted, unit coverage for nested group presentation/disabled nodes/no baseline duplication/fail-closed image resolution, and a real Edge render proving registered native visuals plus authored custom shapes/text appear together with exact preview/export screenshot equality and zero production revision mutation.
- Source: owner-reported Sanverse renderer blocker on 2026-09-01: custom Motion Graph nodes passed structural QA but were absent from review pixels while registered native surfaces rendered separately.
