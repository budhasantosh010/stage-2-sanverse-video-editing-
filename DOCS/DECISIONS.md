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
