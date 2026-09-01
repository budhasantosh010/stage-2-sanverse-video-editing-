# Decisions

Only durable, approved decisions belong here. Proposals stay in plans or the blackboard until approved.

## DEC-001 — Separate Stage 2 repository

- Status: Approved
- Date: 2026-07-12
- Decision: Stage 2 is an independent repository named `stage-2-sanverse-video-editing-` under the owner's GitHub account. The trailing hyphen is part of the owner-created repository slug.
- Why: It is a substantially larger product with its own lifecycle, architecture, tests, and release path. Stage 1 remains a read-only upstream input system.
- Revisit trigger: A later integration analysis proves a monorepo materially lowers cost without coupling releases.

## DEC-002 — Modular monolith with production-grade boundaries

- Status: Approved
- Date: 2026-07-12
- Decision: Begin with a modular monolith and explicit domain ports/adapters. Design contracts, migrations, observability seams, and security boundaries now; defer full distributed SaaS operations.
- Why: Weak boundaries make every later change dangerous, while premature microservices and cloud operations slow product learning.
- Revisit trigger: Measured scaling, deployment, ownership, or fault-isolation needs exceed the modular monolith.

## DEC-003 — AI control plane over a deterministic edit engine

- Status: Approved
- Date: 2026-07-12
- Decision: Models translate natural intent into structured proposals. Deterministic services validate, simulate, execute, record, undo, and render those proposals.
- Why: This creates an auditable trust boundary and prevents probabilistic model output from arbitrarily changing media projects.
- Revisit trigger: None for the trust boundary; provider and model implementations remain replaceable.

## DEC-004 — Two-stage black-and-white interface

- Status: Approved
- Date: 2026-07-12
- Decision: The initial product experience has two progressively disclosed surfaces. Screen 1 is a calm Home screen with a centered chat/upload composer, drag-and-drop entry, and recent projects. Screen 2 is the focused Studio with project/export controls, a central video canvas, a right-side conversational proposal/history panel, and a simple lower time strip. The Studio appears only after a video/project is opened.
- Why: Showing editing controls on first arrival would overwhelm the target non-editor. The user wants OpenDesign's calm conversational start, followed by editing capability only when it becomes relevant.
- Revisit trigger: Real usability evidence shows another layout materially reduces completion time.

## DEC-005 — Vertical slices before broad primitive coverage

- Status: Approved
- Date: 2026-07-12
- Decision: Build complete edit loops one by one. The first is a deterministic static nameplate placement; AI enters only after the manual loop is trusted.
- Why: A narrow closed loop reveals whether the data model, preview, approval, history, and renderer actually work together.
- Revisit trigger: Renderer spike or usability testing invalidates the proposed first slice.

## DEC-006 — Renderer chosen by a measured spike

- Status: Approved
- Date: 2026-07-12
- Decision: Do not lock the rendering architecture from assumption. G1 compares FFmpeg-native, HTML/Chromium, and hybrid approaches against representative edits and records the evidence.
- Why: Text/motion flexibility, preview fidelity, performance, portability, and determinism trade off differently.
- Revisit trigger: New primitive classes exceed the winning renderer's demonstrated envelope.

## DEC-007 — Provider independence

- Status: Approved
- Date: 2026-07-12
- Decision: OpenCode Zen and NVIDIA free endpoints may be development adapters, but core contracts cannot depend on a specific model or free-plan behavior.
- Why: Availability, terms, quotas, and model quality can change. Product correctness must not be coupled to a temporary provider.
- Revisit trigger: None for the abstraction boundary.

## DEC-008 — Lightweight anti-drift hooks only

- Status: Approved
- Date: 2026-07-12
- Decision: Install deterministic context injection, prompt logging, and pre-edit decision reminders. Defer semantic indexing, automatic diagram rendering, heuristic goal scoring, and destructive rollback helpers.
- Why: The old template contains useful mechanisms, but unproven automation adds dependencies, latency, and failure paths. Every governance layer must earn its complexity.
- Revisit trigger: Committed documents and lightweight hooks prove insufficient in actual sessions.

## DEC-009 — Runnable web shell before remaining renderer work

- Status: Approved
- Date: 2026-07-12
- Decision: Pause HyperFrames runtime and hybrid renderer work long enough to build a thin, runnable Home-to-Studio web shell on localhost port 2000. The shell uses real local video selection and browser preview, but it must not pretend that upload, editing, AI, persistence, or export exists.
- Why: The owner needs to evaluate how the product looks, works, and feels before more renderer investment. A static wireframe cannot validate interaction clarity.
- Architecture boundary: Use production-quality frontend boundaries and tests, but do not introduce a backend, database, renderer, or provider until the first UX loop requires them.
- Revisit trigger: The owner completes the runnable Home-to-Studio walkthrough and records corrections; renderer comparison then resumes before G2 closes.

## DEC-010 — Purposeful motion, not ornamental animation

- Status: Approved
- Date: 2026-07-13
- Decision: Use a small shared motion system with smooth screen continuity and a separate brief spring token for direct control feedback. Prefer browser-native view transitions; when unsupported, use one explicitly gated CSS entry transition. Reduced-motion mode removes both page and control transforms.
- Why: The owner found the first real-video flow abrupt and later clarified that buttons and input focus should have a noticeable but controlled bounce. Page navigation remains calm; only direct manipulation receives spring feedback.
- Revisit trigger: Representative use shows the motion feels slow, distracting, or fails to clarify the action.

## DEC-011 — LiteLLM routing over one OpenAI-compatible wire, four providers

- Status: Approved by the owner
- Date: 2026-07-27
- Supersedes in part: DEC-007, which named OpenCode Zen and NVIDIA as development adapters only. Those two are now the owner's primary providers, but DEC-007's rule still holds unchanged: no core contract may depend on a specific provider, model, or free-plan behavior.

### Decision

1. **The wire shape is the OpenAI chat-completions HTTP shape.** Sanverse writes exactly one provider adapter against that shape. It is configured with a base URL, an API key environment variable, and a model name. It contains no provider-specific branching.

2. **LiteLLM is the default routing layer, run as its own proxy process**, not as a library inside the API. The adapter's base URL points at the local LiteLLM proxy; LiteLLM decides which of the four providers actually serves the call.

3. **Four providers are in scope for this stage, and only four:**

   | Provider | Role | Runs where |
   |---|---|---|
   | NVIDIA | Owner's primary for real calls | NVIDIA's servers |
   | opencode | Owner's primary for testing | opencode's gateway |
   | OpenRouter | Overflow and model comparison | OpenRouter's servers |
   | LM Studio | Fully local, nothing leaves the machine | The owner's own computer |

4. **OpenAI and Anthropic are deliberately out of scope for now.** They are not blocked; they are simply not configured. Adding either later is a LiteLLM configuration entry, not a code change.

5. **The owner's own starting keys are NVIDIA and opencode Zen (free tier).** Those two are wired and evaluated first; OpenRouter and LM Studio follow. This is a sequencing statement, not a coupling — no code knows which one is in use.

6. **The fake provider remains the default in the shipped build and in every test run.** A real provider is reached only when explicitly configured. No test may make a network call.

7. **LiteLLM does not weaken the outbound-data allowlist.** `outbound-data-policy.ts` still builds the only object that ever leaves the API process, and it is still re-checked immediately before the wire. The proxy receives that object and nothing else.

### Why

- All four chosen providers already speak the OpenAI chat-completions shape natively. One adapter therefore covers all four whether LiteLLM is running or not, which means LiteLLM is a deployment choice rather than a code dependency, and a proxy outage cannot strand the product.
- LiteLLM earns its place above the raw shape by owning fallback order, per-provider keys, retries, spend tracking, and rate limits in configuration instead of in Sanverse's code.
- It must be the proxy, not the Python SDK: this API is Node with no Python runtime, and adding one to reach a library whose HTTP interface we can call directly would be a large dependency bought for nothing.
- LM Studio in the same list means the product can be demonstrated end to end with zero data leaving the machine, which is the honest answer for NDA or client footage.

### Costs and risks, stated

- **A second process must be running** for the default path. If the LiteLLM proxy is down, the adapter must fail as `PROVIDER_UNAVAILABLE` and the product must stay usable for hand-made edits. This is a required test, not an assumption.
- **LiteLLM's own logging can record full request bodies.** Request logging must be verified off, or scoped, before any real call. The allowlist protects what Sanverse sends; it cannot protect what a downstream process chooses to write to disk.
- **opencode's gateway shape, model list, terms, and quotas are unverified.** It is recorded here because the owner named it, not because it has been tested. G4B-12 must verify it against the same corpus as the others before it is called working.
- Free NVIDIA and opencode tiers can change terms or quotas without notice. DEC-007's abstraction is what makes that survivable.

### Revisit trigger

- The single adapter needs its first provider-specific branch. That is the signal that the OpenAI shape has stopped being a real common denominator.
- Measured routing, spend control, or fallback needs exceed what LiteLLM configuration can express.
- The owner enters a stage where an OpenAI or Anthropic model is required for quality that the four cannot reach.

## DEC-012 — Approved pixels first; one component-ingestion semantics

- Status: Approved by the owner
- Date: 2026-08-14
- Decision: external visual agents may use different authoring techniques, but Sanverse owns one canonical fail-closed intake/productization/visual-parity/registration pipeline. The owner's approved visual package is immutable evidence; engineering may change implementation architecture but may not replace it with a visually different interpretation.
- Source classification is closed (`sdk-native`, `sdk-custom`, `procedural`, `shader`, `hybrid`, `foreign`). Foreign is a compatibility status, not an automatic rejection. Lossless normalization, expert wrapping/source adaptation, or explicit incompatibility are honest outcomes.
- Public registry mutation happens only after productization and owner-reviewed integrated parity. Staging never creates half-public components.
- Why: visual diversity is desirable, while separate integration semantics per coding agent would fragment Motion Graph, customization, Library behavior and AI editing.
- Revisit trigger: a real approved component cannot be preserved through these lanes without either violating visual parity or creating a second animation/editing authority.

## DEC-013 — Direct owner parity and bounded batch authorization are distinct authorities

- Status: Approved by the owner
- Date: 2026-08-14
- Decision: a component may reach public registration after either (a) the owner directly reviews and approves the synchronized integrated parity result, or (b) for a specifically bounded source set the owner has already approved, the owner explicitly authorizes the Sanverse coding agent to preserve those visuals, perform engineering parity/productization review, and insert the verified integrations without a separate manual viewing round for every item.
- The two states are recorded separately. Direct review uses reviewer `owner`; bounded delegation uses `owner-batch-authorized-engineering-evidence`. Plain `engineering-evidence` remains insufficient for registration.
- CH1 applies this decision once: Component 01 Frosted Icon Rail is direct owner-reviewed; Components 02–10 use the explicit 2026-08-14 CH1 batch authorization. Future visual sets do not inherit this authorization.
- The Sanverse coding agent owns implementation and Library insertion after source approval; external visual workspaces provide approved source evidence, not a second engineering owner.
- Why: preserve truthful provenance while allowing the owner to delegate repetitive source-preserving conversion work without pretending nine unseen integrations were individually owner-reviewed.
- Revisit trigger: a future batch contains a component whose engineering parity is ambiguous or materially diverges from the approved source; that component returns to direct owner review.

## DEC-014 — One Creative Engine authority; MCP is only a protocol adapter

- Status: Approved by the owner
- Date: 2026-08-26
- Decision: Closed-Loop V1 extends the existing Motion/Creative authorities instead of creating parallel state. `MotionSceneV1` remains the canonical visual scene; `MotionGraphOperationV1` remains the canonical deterministic mutation/inverse path; Storyboard/Animatic live in an isolated revisioned sandbox until explicit approvals and one atomic accepted-project merge; C3/C4/C5/C6 are projections over the same semantic node IDs; C8 adds only bounded mask/matte/compositing metadata to that same graph.
- New packages are narrow responsibility boundaries only: `@sanverse/motion-storyboard` owns Storyboard/Animatic sandbox lifecycle, `@sanverse/motion-external-bridge` owns foreign-source inspection/materialization/provenance/rights, and `@sanverse/motion-agent-tools` owns the UI-independent T0/T1/T2 workflow registry/orchestration.
- MCP V1 (`@sanverse/motion-mcp`) delegates `tools/list` and `tools/call` to that internal registry. It does not directly call graph helpers or own project/approval/Undo state. Sandbox identity is explicit. Owner approval requires host-resolved opaque proof; client arguments, elicitation responses, or guessed request state cannot create approval authority.
- Why: a second graph/tool-state/approval/Undo system would make browser UI, automation and future agents disagree about what the project actually is. One authority makes every surface a different controller over the same deterministic state.
- Trade-off: MCP cannot independently recover or mutate state if the internal engine is unavailable; that dependence is intentional because protocol availability must never outrank project correctness.
- Revisit trigger: a future external client needs a capability the internal registry cannot express without breaking the one-authority rule; extend/version the internal contract first, then expose it through MCP.

## DEC-015 — Promotion is productization over existing Creative authorities, not a second engine

- Status: Approved by the owner
- Date: 2026-08-26
- Decision: V1.1 adds one narrow `@sanverse/motion-promotion` domain for promotion-specific candidate/workspace/parameterization/classification/template/recipe/lineage/QA/registration logic. `MotionSceneV1`, `MotionGraphOperationV1`, existing exposures, B2 catalog/ranking, Creative Library, accepted-project transaction/Undo, internal tool registry and MCP remain the authorities they already are.
- Capability origin and reuse status are orthogonal shared vocabulary: a generated item stays `origin = generated` after productization while moving from project-only/candidate state to `reuseStatus = promoted-reusable`. Promotion never rewrites provenance to make generated work appear curated.
- Parameterization is conservative: stable semantic-node bindings expose meaningful content/media/style/layout/motion/behavior controls; non-exposed approved composition/choreography remains explicitly frozen. Default productized fixture must preserve the approved source appearance unless a material visual change triggers reapproval.
- Promoted runtime assets must be self-sufficient or explicitly constrained; rights are aggregated fail-closed from all dependencies. Public registration is staged/atomic and cannot leave half-public catalog state.
- Reused capability instances and recipes compile back into ordinary canonical graph/semantic motion operations so C3/C4/C5/C6, direct seek and Undo continue to operate normally.
- Why: the reuse flywheel compounds approved design knowledge only if it remains truthful, editable and governed by the same deterministic authorities; parallel promotion graphs/renderers/catalogs would destroy that guarantee.
- Trade-off: V1.1 deliberately supports bounded, typed productization rather than automatically exposing every literal or solving universal responsive/brand adaptation. Broader style intelligence and advanced runtimes stay deferred.
- Revisit trigger: a real approved scene cannot be productized/reused without either breaking default visual parity, losing semantic editability, or requiring a runtime the canonical Motion Graph cannot express.

## DEC-016 — Source-aware, camera/depth and Expert Motion are extensions of one Motion Graph

- Status: Approved by the owner
- Date: 2026-08-26
- Decision: V1.2–V1.4 add new narrow domain responsibilities, but none may become a parallel animation authority. C9 tracking materializes provider output into Sanverse-owned exact-tick tracks and composes tracked base transform + user offset + normal motion offset. C10 camera/depth is graph-native deterministic 2.5D state evaluated at exact ticks. C11/C12 Expert Motion uses bounded serialized expert nodes whose procedural/particle/shader outputs are pure functions of exact tick, typed parameters/assets and explicit deterministic seed.
- Surface and subject workflows reuse C8 masks/mattes/compositing; external React/SVG/Remotion/Rive/procedural/shader paths extend the existing external-source provenance/rights authority and must truthfully choose native materialization, bounded expert wrapping/flattening, partial support or rejection.
- Style/cohesion/preferences/failure intelligence are structured recommendation/evidence layers only. They may influence B2-B5 ranking/planning but may not override rights, locks, capability support, factual content, owner approvals or canonical state.
- Internal typed operations land and pass before tool-registry exposure; MCP remains a thin generic adapter over that internal registry and owns no tracking/camera/expert/project/approval/Undo state.
- Why: direct seek, Undo, semantic-ID parity and truthful reuse are only reliable if all new capabilities converge on the same exact-tick Motion authority. Provider/runtime-specific graphs or clocks would make UI, agents, MCP and review evidence disagree about what the project is.
- Trade-off: supported subsets are deliberately bounded. Features that cannot satisfy deterministic materialization/expert-sandbox/rights requirements must remain partial or rejected rather than gaining broad compatibility claims.
- Revisit trigger: a required production use case cannot be represented by native graph state or a bounded deterministic expert node without violating direct-seek or security guarantees.

## DEC-017 — Standard external MCP is a session adapter over the production API and existing registry

- Status: Approved by the owner
- Date: 2026-08-29
- Decision: External MCP interoperability uses the official MCP SDK and standard Streamable HTTP/STDIO transports, but it does not become a new Sanverse authority. Each external MCP session gets one existing Closed-Loop workflow instance for candidate/sandbox state; before state-sensitive tool execution it re-reads the canonical `EditProject` through the existing production API. Accepted-project persistence, change sets, revision fencing and Undo remain owned by the API/editor.
- The production-facing external registry is the existing registry plus small semantic adapter tools that delegate into existing workflow/graph operations. These adapters may make safe common actions easier for agents, but may not implement a client-specific state model or bypass canonical validation.
- HTTP binds only to loopback, requires one local bearer credential, validates Host/Origin, uses standard MCP session IDs, reports active sessions, and expires abandoned sessions after a bounded idle period. STDIO reserves stdout for MCP framing and sends operational text only to stderr.
- Owner approval is never accepted from external client JSON. Approval-bearing tools fail at the transport boundary with `OWNER_APPROVAL_REQUIRED`; clients may only request review and leave the exact revision waiting for host/owner action.
- Client setup is reversible and namespaced to the single `sanverse` MCP entry. Codex, Claude Code and OpenCode retain their existing model/provider and unrelated MCP configuration.
- Why: standard clients need protocol compatibility and session isolation, but giving each client its own project/workflow authority would break one-project truth, stale-revision safety and Undo consistency. The API + internal registry boundary keeps external agents interchangeable controllers over the same deterministic engine.
- Trade-off: this release certifies the MCP protocol/configuration layer rather than spending client model/provider capacity. Normal model-driven use inside Codex, Claude Code and OpenCode is owner validation after release; provider authentication, credits and model availability are deliberately outside this MCP-layer completion gate.
- Revisit trigger: a future standard MCP capability requires persistent external state that cannot be represented as session-local candidate state plus the canonical production API; extend/version the shared internal contract first rather than adding client-specific authority.

## DEC-018 — Raw-video MCP orchestration converges approved canonical Motion artifacts into the existing EditProject/render pipeline

- Status: Approved by the owner
- Date: 2026-08-29
- Decision: The raw-video external workflow extends the existing production/API/Edit Domain/Motion authorities rather than creating an MCP editor. MCP sessions may own selection, transcript/source-analysis references, opportunity maps and multiple candidate Closed-Loop scene sessions, but every accepted production read is refreshed from the API and every accepted mutation remains a typed revision-fenced ChangeSet in the canonical `EditProject` history.
- A generic accepted Creative Scene is represented by a new source-anchored, render-affecting EditOperation that references an immutable project-local artifact by opaque ID + schema version + SHA-256. The artifact stores the exact approved canonical render descriptor (component/version/props/style/Motion Graph and operations/semantic IDs/source and style lineage/capability dependencies); it is not another project state store and staging one does not itself create an edit or revision.
- Production preview and export consume the same artifact and the same Motion component/graph/native runtime. The renderer may produce temporary exact-tick RGBA frames in a reproducible export cache and feed them into the existing FFmpeg compositor, but those frames are never canonical state. Unsupported behavior fails a capability gate; no second animation DSL or hand-authored FFmpeg animation is permitted.
- Multi-scene production acceptance is one atomic ChangeSet against one common live production base revision. This deliberately avoids applying scene 1 and invalidating approvals for scenes 2–10. Existing ChangeSet/history/Undo/Redo/portable-archive/export-identity rules remain authoritative.
- Owner approval remains external to client JSON. Standard MCP gains only an opaque host-approval resolver that can return an exact existing `OwnerApprovalV1`; it cannot interpret a client boolean/string as approval, approve future revisions or bypass Storyboard/Animatic/Motion QA gates.
- Zero-project startup is valid. The external session is generalized from one prebuilt KineticHeadline workflow to a session manager with optional active project and multiple scene sessions. The previous external tool definitions remain present in a discovery-only catalog before selection, so the final zero-project surface is stable at 52 tools (34 prior + 18 additive); project-dependent calls refuse `PROJECT_REQUIRED` rather than disappearing or making MCP unavailable. After selection those same legacy definitions are backed by the existing production workflow.
- Local-path import is a convenience adapter only: it validates confinement beneath configured import roots and streams the chosen regular file into the existing `POST /api/projects` intake authority. It does not read arbitrary paths through the API or create a second project-intake service.
- Disposable browser/export process paths are explicitly non-authoritative. On Windows the real E2E proved deeply nested project/worktree paths can prevent Edge CDP startup or make Node report `ENOENT` while launching an existing FFmpeg binary. Edge's temporary profile therefore uses OS temp, while the private render workspace uses a short random same-volume sibling under Sanverse's data-root `projects` directory. Immutable artifacts, render plans, accepted project state and published output remain under their existing authorities; these short paths hold only reproducible process/cache state.
- Why: the owner’s target only has product value if the exact visual the agent/storyboard/owner approved is the exact canonical visual placed in the actual project and exported. Parallel MCP state, flattened scene videos or bespoke animation export would make approvals, Undo, direct seek, preview and final pixels disagree.
- Trade-off: the first generic production bridge is deliberately capability-gated and can support only Motion features whose exact browser/export parity is proved. That is narrower than claiming every Library/expert/tracking combination immediately, but it keeps production truth deterministic and reviewable.
- Revisit trigger: a real approved scene cannot be rendered/exported from the canonical artifact with deterministic direct seek and acceptable pixel parity without either extending the shared Motion/runtime contract or introducing a separately governed production capability.

## DEC-019 — Local external agents launch Sanverse through tokenless STDIO by default

- Status: Approved by the owner
- Date: 2026-08-30
- Decision: Codex, Claude Code and OpenCode use one local `sanverse` STDIO entry that launches `scripts/sanverse-mcp-stdio.mjs`. That launcher is responsible for starting or reusing the existing production API and web/render service before connecting the same standard MCP server/52-tool registry. The owner does not run a separate Sanverse MCP terminal.
- STDIO stdout is protocol-only. API/web child output is redirected to ignored local runtime logs under `.sanverse-data/mcp/runtime`, and the child services are detached so the MCP process can expose a clean protocol stream. On Windows, the launcher resolves npm's real `npm-cli.js` and invokes it through `node.exe` so paths containing spaces such as `C:\Program Files\...` cannot be misparsed by `cmd.exe`.
- Local STDIO carries no bearer token and requires no Sanverse environment variable. Setup removes the legacy persistent `SANVERSE_MCP_TOKEN` user variable and installs only the `sanverse` entry. HTTP remains supported separately with its existing loopback bearer/Origin/Host protections for debugging or future remote-style use.
- Client configuration is persistent and reversible: Codex gets a stdio command entry, Claude Code gets a user-scope stdio entry, and OpenCode gets a local MCP command entry. Existing unrelated MCP servers and model/provider settings are preserved.
- Why: a local owner should be able to open an agent and say `Use Sanverse` without understanding servers, ports or credentials. STDIO also eliminates cross-worktree bearer-token drift while preserving the exact same deterministic Sanverse authorities behind the transport.
- Trade-off: auto-started API/web services may remain resident for reuse after an individual STDIO client exits; this avoids startup churn and is local-only, but lifecycle shutdown can be revisited if idle resource use becomes material.
- Revisit trigger: local agents require cross-machine access, a shared multi-user service, or an idle-service lifecycle policy that STDIO process launching cannot satisfy cleanly.

## DEC-020 — Human Creative review is persisted evidence + trusted host confirmation, not session memory or model authority

- Status: Approved by the owner
- Date: 2026-08-31
- Decision: Creative review state is a project-scoped durable run document, while rendering/approval reuse the existing canonical Creative/Motion and host-approval authorities. `CreativeRunV1` persists source understanding, opportunity selection, serialized multi-scene Closed-Loop state and exact review records. Rehydration reconstructs the existing engines from that state and refuses project/revision/scene mismatches rather than inventing continuity.
- Review evidence is a distinct non-production use of the canonical Creative artifact/render surface. `artifactPurpose = review` permits pre-approval rendering only; `artifactPurpose = production` still requires the existing Motion owner-approval ID. The review artifact itself grants no project mutation/apply authority.
- MCP chat presentation attaches SHA-256-verified native image evidence. A decision tool remains model-callable only as a proposal. Trusted approval context can be populated only after the MCP multi-round-trip human-confirmation path or the trusted local-browser fallback confirms the exact current review. Ordinary `_sanverse`/tool JSON is explicitly stripped of this authority.
- Multi-round-trip decision state uses the v2 server's `createRequestStateCodec` with a random 32-byte key, ten-minute TTL and method binding. On reentry the returned state, elicitation content and current persisted run/review binding are compared before the host-only approval issuer can act. The installed client/SDK acceptance exercised the compatibility shim; no unsupported claim is made that the exact 2026-07-28 wire revision negotiated on these clients.
- Browser fallback exists only for local STDIO. It binds loopback, opens an unguessable one-time path, requires a one-time form nonce, verifies evidence bytes against the persisted digest before serving them, and returns only the human confirmation result to the trusted host bridge.
- Opportunity planning is usefulness-capped rather than quota-filled: `targetCount` remains a compatibility alias for requested maximum, candidates fail independently, small overlaps may be trimmed conservatively, and semantic selection is preferred over generic fallback.
- Why: review UX must survive client restarts and be easy for the owner, but convenience cannot turn a model response, stale screen, opaque URL, or reconstructed session into approval authority. Durable evidence plus exact host confirmation preserves one-project truth and makes Codex/OpenCode interchangeable clients.
- Trade-off: persisted review artifacts/state consume bounded local disk and the first browser fallback is intentionally minimal rather than a new review application. That is preferable to creating a parallel UI/project/approval system.
- Revisit trigger: MCP clients universally support a newer negotiated review/elicitation capability that can replace compatibility/fallback behavior without weakening exact evidence/revision binding.

## DEC-021 — Resume the task; replace the MCP transport

- Status: Approved by the owner
- Date: 2026-09-01
- Decision: a Sanverse-enabled coding task/session is durable client state, while a local STDIO MCP process is disposable transport state. A laptop/client/process restart therefore resumes the same task/session ID and launches a new Sanverse STDIO process; it does not create a replacement coding conversation.
- Sanverse persists Creative Run/review truth under the project data root and reconstructs session-local orchestration through `creative.resume_run`. The MCP server does not depend on a previous process ID, stdio pipe, model turn or hidden in-memory approval state. Exact owner-review identity remains run/review/subject-revision/evidence-hash bound after reconnect.
- The launcher handshakes before waiting on API/web cold-start. Production tool execution waits on the shared runtime-readiness promise, preserving zero-setup startup without consuming the client's MCP handshake budget.
- Client hosts own their live tool registry. If one already-running host permanently marked an MCP startup attempt failed and exposes no reconnect operation, Sanverse cannot make that host rediscover tools without the host reinitializing MCP. The recovery is to reconnect/restart the client runtime while retaining the same task/session ID—not to create a new task/chat.
- Evidence: the provider-independent continuation audit closes MCP process A, starts process B and restores exact `run_00n2km2k` / `review_000cuypa` identity. Real Codex process A created thread `01a05984-09c9-77a0-a660-f22c44d334d1`, used Sanverse successfully, exited, and a new `codex exec resume` process resumed that exact thread ID and successfully recovered the same Animatic review with three artifacts.
- Trade-off: an MCP server cannot repair a client implementation that refuses to perform another MCP initialize/tools discovery in a still-running process. That limitation is explicitly separated from durable task continuity and must never be described as requiring a new chat.
- Revisit trigger: a supported client gains a reliable in-process MCP reconnect API that can be invoked automatically after transient startup failure, or a client demonstrably fails same-session process-resume despite a healthy persisted Sanverse configuration.

## DEC-022 — General Storyboard authoring is canonical Motion Graph authority inside a locked sandbox

- Status: Approved by the owner
- Date: 2026-09-01
- Decision: Storyboard authoring exposes the canonical `MotionGraphOperationV1` authority to the existing project-scoped Storyboard sandbox. Genuine static/structural gaps are added to that canonical union (`set-node-static-property`, typed node/subtree replacement and semantic-part authoring); no MCP-only graph, raw JSON patching, React scene authority or FFmpeg design layer is introduced.
- The agent workflow is inspect → typed atomic design transaction → structural/style/source QA → source-composited review → exact host owner approval. Hard brand/source constraints may refuse a transaction; soft style preferences become QA warnings. Style Lock is a validator over visual language, not an edit whitelist.
- Library components are starting material. A component-derived scene may be materialized into a full graph-native scene while preserving component/version/recipe lineage; after materialization the graph is freely editable within canonical capabilities and bounded complexity. Content binding must fail closed rather than silently restoring demo/default props.
- Storyboard transactions can target multiple KVS atomically. Every successful design transaction advances one sandbox revision and Storyboard revision, clears prior Storyboard approval and downstream Animatic/Motion/visual evidence, and records semantic operation/diff metadata without exposing chain-of-thought. Production history remains untouched until the final approved multi-scene ChangeSet.
- Exact Storyboard approval freezes design semantics. Reopening creates a new Storyboard revision and invalidates the prior approval. Motion may animate approved node properties over time but may not change approved node existence/type/content/static style/layout/image/path/semantic/presentation/source-treatment meaning without Storyboard revision.
- Motion Forge compiles against the **approved Storyboard structural baseline**, not the original component candidate. The baseline is deterministic and explicit (base KVS plus ordered KVS diffs/identity), so an owner-approved redesign cannot silently revert when Motion starts.
- Storyboard review defaults to source-composited pixels using the exact KVS `sourceFrameRef` whenever the selected presentation keeps source video visible. Isolated-graphic frames may remain diagnostic only. Owner approval remains host-only and exact evidence/revision bound.
- Why: the current narrow text/fontSize/opacity workflow makes Sanverse a template filler even though the canonical graph already supports much richer authoring. Exposing the graph safely once gives agents general visual-design authority without multiplying special-case MCP tools or weakening deterministic project/approval/Undo truth.
- Trade-off: the typed operation schema and validation surface become larger and more explicit, and some requests outside bounded canonical node/expert/asset capabilities must still refuse. That complexity is preferable to an unvalidated generic JSON/code escape hatch.
- Revisit trigger: a desired visual cannot be represented by the canonical graph/runtime without repeated low-level replacement patterns, or a future graph version can model the same authoring semantics more cleanly without breaking exact Storyboard/Motion identity.
