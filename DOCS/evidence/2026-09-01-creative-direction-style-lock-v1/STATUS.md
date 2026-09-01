# Pre-Storyboard Creative Direction + Approved Style Lock V1 — Status

Date: 2026-09-01
Requirement: REQ-025
Decision: DEC-023
Status: **Engineering implementation and machine/client acceptance complete. Exact per-review visual owner approval remains human evidence and is not fabricated.**

## Delivered authority model

Raw-video Creative Runs now enforce four separate authority layers:

1. Creative Direction approval creates the video-wide Approved Style Lock.
2. Storyboard approval locks exact scene design.
3. Animatic approval locks timing.
4. Motion approval locks animation.

Brand Context remains evidence only. A Creative Direction proposal remains draft/revisable state and cannot be used as an implicit Style Lock.

## Implementation

- Creative Run persistence upgraded to V2 with explicit V1 migration.
- V1 auto-generated style/downstream state is retained only for audit and never promoted as historical Style approval.
- Added `BrandContextV1`, `CreativeDirectionProposalV1`, `ApprovedStyleLockV1`, canonical approved-content hashing and revision-safe direction changes.
- External MCP is **73 tools**, adding:
  - `creative.propose_direction`
  - `creative.get_direction`
  - `creative.revise_direction`
  - `creative.reopen_direction`
- Opportunity planning refuses without exact approved Style authority using `CREATIVE_DIRECTION_APPROVAL_REQUIRED`.
- Opportunity maps preserve `styleLockId`, proposal ID/revision and exact content hash.
- Raw-video scene creation verifies that same Style Lock identity before Storyboard construction.
- Reopening direction removes active Style Lock/opportunity/scene/downstream review authority without changing accepted production revision or creating Undo history.
- Hard approved palette/font constraints cannot be widened by component defaults. Deterministic semantic-role normalization is allowed; ambiguity refuses.
- Exact Style Lock content hash + Creative Direction revision survive into Motion/immutable Creative artifacts and are mandatory under Render Contract validation.
- Local workspace `.md` and bounded brand/brief/style/creative/direction/guideline `.txt` files can be confined Creative Brief evidence; ordinary `.txt` remains plain/transcript text and transcript attachment rejects brief-classified files.
- Creative Direction review gets bounded human-readable board evidence and MCP chat summary through the existing host-only review system.

## Deterministic real STDIO acceptance

Command: `npm run sanverse:mcp:audit-storyboard-authoring`

Result: PASS.

Key evidence:
- project: `project_21c01709e413d034d4cec25dcb4b1ca4`
- accepted production revision before/after: `0`
- tool count: `73`
- run: `run_017ui8wn`
- direction proposal: `direction_01rn1bce`
- approved direction revision: `2`
- Approved Style Lock: `stylelock_46622b0a92ffbfac`
- Style content hash: `46622b0a92ffbfac12df83afeb352007a1c93916613f713ab87477ac05a99aa8`
- stale revision-1 review approval refused: yes
- trusted test-host confirmation rounds: `2`
- downstream Storyboard authoring still passes `$29 → £29`, shape → `ellipse`, structural duplicate + semantic part
- source-composited Storyboard review: yes
- production mutation: no

Detailed machine evidence remains in `../general-storyboard-authoring-v1/stdio-authoring-audit.json`.

## Three-process continuation acceptance

Command: `npm run sanverse:mcp:audit-continuation`

Result: PASS.

Three independent STDIO child processes prove:
- process A creates pending direction review `review_01aggmt7` and closes;
- process B restores the exact pending review/evidence/artifact identity and performs one trusted approval, then closes;
- process C restores exact Approved Style Lock `stylelock_6b04261d86f627f8` and content hash at `opportunity-planning`;
- all processes expose 73 tools;
- no process changes accepted production revision `0`;
- no handshake-timeout evidence is observed.

Detailed evidence: `../mcp-continuation-v1/stdio-reconnect.json`.

## Real Codex 0.144.1 independent-client acceptance

Thread: `01a05db2-1fcb-7222-a5eb-444f67385c1b`

Codex used only the task-local Sanverse MCP and did not use shell/source edits/apply/export. It:
- selected the persisted production project;
- read production revision `0`;
- created run `run_00d140v0`;
- attached analysis-only transcript and analyzed `sourcepkt_01wffk8f`;
- verified planning refusal with `CREATIVE_DIRECTION_APPROVAL_REQUIRED` before direction approval;
- proposed Creative Direction;
- revised exact proposal `direction_00nwsubu` to revision `2`;
- obtained pending review `review_01j0yrfk` with one Creative Direction board artifact;
- verified `approvedStyleLock` remained absent and planning was still refused;
- re-read production revision `0`;
- deliberately did **not** call `creative.decide_review`.

Final marker:

`SANVERSE_CODEX_DIRECTION_GATE_OK run_id=run_00d140v0 proposal_id=direction_00nwsubu revision=2 review_id=review_01j0yrfk artifact_count=1 plan_blocked=true production_revision=0`

Compact evidence: `codex-direction-gate-acceptance.json`.

This is the correct independent-client boundary: broad implementation authorization is not transformed into a claim that the owner visually approved this exact board. Trusted approval machinery is separately machine-proven above.

## Verification

Authoritative Windows command:

`npm test -- --run --pool=forks --poolOptions.forks.singleFork=true`

Final result: **exit 0**. Key exact counts:
- Web: **1,239/1,239**
- API: **411/411**
- Creative Direction: **46/46**
- Creative Production Adapter: **37/37**
- Edit Domain: **491/491**
- Motion Library: **202/202**
- Motion Graph: **148/148**
- Render Contract: **121/121**
- Motion MCP: **30/30**
- Motion Agent Tools: **30/30**
- Motion Storyboard: **16/16**
- all remaining workspace suites: PASS

Production build:

`npm run build` → **exit 0**.

Non-blocking build notices only:
- `/api/render-assets/nameplate-font` remains runtime-resolved as designed;
- Vite reports chunks over its default 500 kB advisory threshold.

Security:

`npm audit --omit=dev --json` → **0 vulnerabilities** at info/low/moderate/high/critical across **153 production dependencies**.

## Human/release truth boundary

REQ-025 engineering is complete, but no unseen Creative Direction board is declared visually owner-approved. The separate REQ-020 raw-video release tag is also still withheld until its meaningful spoken-video source/timed evidence, representative scene approvals/parity and actual 1× final owner watch exist.

Failures encountered and their fixes are preserved in `FAILURES.md`.
