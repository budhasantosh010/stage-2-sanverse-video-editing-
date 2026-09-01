# General Storyboard Authoring V1 — failure record

Date: 2026-09-01

## F-01 — first real review source-composite request used an unsupported preview width

- What: `creative.prepare_review` failed with `CREATIVE_REVIEW_RENDER_FAILED`; the browser reported that exact source frame `0` could not load.
- Where: Storyboard review compositor -> canonical `/media-analysis/frame` endpoint.
- When: first real persisted-video source-composite acceptance.
- Why: the review page requested the full 1920 px composition width, while the existing bounded derived-media endpoint intentionally accepts at most 640 px.
- How fixed: request the exact source tick at bounded 640 px and scale that real decoded frame behind the canonical 1920×1080 graph compositor. The media-analysis safety bound was not widened.
- Verification: direct frame request returns HTTP 200 `image/webp`; real STDIO review audit subsequently passes with source-composited KVS images.
- One-line solution: **Respect the canonical 640 px derived-frame envelope and scale only inside the review compositor.**

## F-02 — transient audit runner used the wrong TypeScript module mode

- What: `npx tsx scripts/audit-storyboard-authoring-stdio.ts` failed because top-level `await` was transformed as CommonJS.
- Where: test invocation only; no Sanverse product call executed.
- Why: transient `npx tsx` did not match this repository's existing `vite-node` script convention.
- Tried: no product-code workaround was added.
- Resolution: run the audit with the repository's `vite-node` runtime.
- One-line solution: **Use the repo's existing `vite-node` runtime for ESM audit scripts.**

## F-03 — early audit assertions assumed every KVS contained the same chosen node and initially read the text field incorrectly

- What: early audit iterations reported that currency authoring had not persisted.
- Where: `scripts/audit-storyboard-authoring-stdio.ts` assertions.
- Why: `all-states-containing-node` deliberately targets only states containing that node; the audit first demanded the node in unrelated states and also initially inspected an incorrect nested text shape.
- Resolution: determine the exact targeted KVS identities from the initial inspection and verify canonical text as `node.text.kind/value` only in those states.
- Product impact: none; the focused authoring test and final real audit confirm correct persistence.
- One-line solution: **Assert the documented target semantics and canonical node schema, not a broader test assumption.**

## F-04 — Harness same-file multi-edit overwrite during implementation

- What: two helper insertions disappeared while later call-site edits survived, producing temporary `... is not defined` TypeScript/test failures.
- Where: `multi-scene-workflow.ts` and `external-orchestration.ts` during authoring-response/diff refinement.
- Why: multiple edits to the same file in one Harness batch overwrote one another in this environment.
- Resolution: re-read the file and apply same-file edits sequentially; builds then passed.
- Product impact: temporary local implementation state only; never committed/pushed.
- One-line solution: **Apply same-file Harness edits sequentially with stale-write guards.**

## F-05 — real Codex first authoring attempt constructed a refused mixed transaction

- What: Codex reached `creative.apply_storyboard_graph_operations` but finished with `STORYBOARD_GRAPH_EDIT_REFUSED` on its first model-driven acceptance attempt.
- Where: real Codex `0.144.1` -> Sanverse MCP.
- Why: the model combined heterogeneous text/shape intent into one graph call whose selected all-states target did not make every operation valid for the same target set.
- Evidence against a core authoring defect: the deterministic STDIO battery already completed the same user goal using revision-fenced general transactions.
- Resolution: final acceptance states the intended general workflow explicitly: one transaction for the selected text node, then a second transaction using the returned revision for the selected shape node.
- One-line solution: **Fence heterogeneous node edits as separate canonical transactions unless their target state set is identical.**

## F-06 — second real Codex attempt constructed an invalid opportunity-planning call

- What: Codex received `OPPORTUNITY_SOURCE_INVALID` before authoring.
- Where: model-driven `motion.plan_opportunities` call.
- Why: the free-form model/tool path did not preserve the exact timed transcript/source packet relationship needed by the deterministic planner in that attempt.
- Resolution: final acceptance supplied an explicit timed SRT and exact returned-ID argument relationship. Planning then passed.
- Product impact: no production mutation.
- One-line solution: **Carry the exact transcriptRef/sourcePacketRef lineage from attach → analyze → plan.**

## F-07 — Windows prompt piping corrupted a literal pound sign in one discarded acceptance prompt

- What: one PowerShell-piped Codex prompt displayed the intended `£29` as `??29` before the MCP authoring steps.
- Where: test prompt transport, not Sanverse persisted graph state.
- Why: console/pipeline encoding of the literal character was not stable in that invocation path.
- Resolution: final prompt described `POUND SIGN U+00A3` in ASCII and required Codex to construct the actual Unicode character; re-inspection verified code point `163` immediately before `29`.
- One-line solution: **Specify the Unicode code point when the CLI prompt transport cannot preserve the literal glyph.**

## F-08 — successful final Codex session made one refused call before self-correcting

- What: after inspection, one `creative.apply_storyboard_graph_operations` call was refused; Codex then issued two corrected calls, both completed, and the overall acceptance passed.
- Where: final real Codex client acceptance.
- Why: model-generated tool arguments are not guaranteed to be first-attempt perfect; typed refusal is part of the safety contract.
- Resolution: no weakening of validation. Codex used the refusal to correct its request, re-inspected revision `3`, verified `U+00A3`/`29` and `ellipse`, prepared 2 source-composite review images, and confirmed production revision unchanged.
- One-line solution: **Keep typed fail-closed validation; allow the external agent to correct a refused request without mutating accepted state.**
