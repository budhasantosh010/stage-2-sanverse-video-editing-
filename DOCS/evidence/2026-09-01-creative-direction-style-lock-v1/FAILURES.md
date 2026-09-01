# Pre-Storyboard Creative Direction + Style Lock V1 — Failure Registry

This registry records failures encountered during implementation. None is hidden by weakening the acceptance contract.

## F-01 — install-time audit reported two high findings

- **Where:** `npm ci` in the isolated task worktree.
- **What:** npm reported two high-severity findings in the complete development dependency graph.
- **Impact:** no production dependency exposure was established.
- **What was tried:** no blind dependency upgrade was performed because that would create unrelated scope/risk.
- **Resolution:** `npm audit --omit=dev --json` reports **0 info / 0 low / 0 moderate / 0 high / 0 critical** across 153 production dependencies. The two install-time findings are outside the production dependency graph.
- **One-line solution:** keep production audit at zero and handle dev-only dependency updates as a separate dependency-maintenance change if desired.

## F-02 — PowerShell rejected `&&`

- **Where:** combined affected-workspace build command.
- **What:** this Windows PowerShell host does not support `&&` as a statement separator.
- **Impact:** no build ran in that combined command; no source changed.
- **Resolution:** reran each workspace build separately; all affected builds passed.
- **One-line solution:** use separate Harness commands or PowerShell-compatible separators on this host.

## F-03 — same-file Harness batch edits can overwrite earlier same-file edits

- **Where:** sequential changes to `external-orchestration.ts` in one multi-edit request.
- **What:** only the last same-file edit survived the batch behavior.
- **Impact:** detected immediately by grep; no committed loss.
- **Resolution:** subsequent same-file changes were applied sequentially and verified.
- **One-line solution:** avoid multiple independent writes to the same file in one Harness batch.

## F-04 — Style normalization incorrectly required four distinct colors

- **Where:** component → approved Style Lock normalization.
- **What:** a valid direction can assign the same color to the semantic `background` and `surface` roles; deduplication reduced the hard color set below four and the normalizer refused it.
- **Impact:** valid approved directions could not build a scene.
- **Resolution:** carry the semantic palette role map explicitly while keeping the hard allowed-color set deduplicated; background/surface may legitimately share a value.
- **One-line solution:** validate semantic roles, not a minimum count of distinct color values.

## F-05 — old orchestration tests bypassed the new direction gate

- **Where:** raw-video adapter/reconnect/authoring tests written for the previous `analyze → plan` lifecycle.
- **What:** the new correct `CREATIVE_DIRECTION_APPROVAL_REQUIRED` refusal made those tests fail.
- **Impact:** test fixtures were stale; production behavior was correct.
- **Resolution:** migrated tests through real create-run → propose direction → exact trusted test-host approval → plan flow; no compatibility bypass was introduced.
- **One-line solution:** tests must model the same authority sequence as production.

## F-06 — V1 migration initially left legacy downstream state active

- **Where:** Creative Run V1 → V2 migration.
- **What:** legacy auto-generated style state could have retained an active opportunity map/scene batch while direction certification was pending.
- **Impact:** authority would be ambiguous after reconnect.
- **Resolution:** migration now archives legacy downstream material for audit and clears active opportunity/scene/review authority until Creative Direction is certified.
- **One-line solution:** migrate evidence, never migrate unapproved authority.

## F-07 — Creative Direction board renderer contained an invalid regular-expression escape

- **Where:** `scripts/sanverse-mcp-review-renderer.ts` during the first real STDIO audit.
- **What:** Rollup rejected `/[&<>\\\"']/gu` before the MCP process could start.
- **Impact:** transport process closed before any Sanverse tool call.
- **Resolution:** corrected HTML-escape regex to `/[&<>"']/gu`; the same real STDIO audit then passed.
- **One-line solution:** use a valid character class and keep HTML escaping deterministic.

## F-08 — first Codex task-local MCP config used the wrong TOML quoting

- **Where:** first `codex exec --ignore-user-config` attempt.
- **What:** Windows backslashes inside a double-quoted TOML `args` override were parsed as escapes, so Codex rejected configuration before starting.
- **Impact:** no Codex/MCP/project state changed.
- **Resolution:** used TOML literal strings for the command/path values.
- **One-line solution:** use TOML single-quoted literal Windows paths for inline Codex MCP overrides.

## F-09 — first background Codex smoke waited on open stdin

- **Where:** Harness background process invoking `codex exec` with an argument prompt.
- **What:** the process reported `Reading additional input from stdin...` because the Harness kept stdin open.
- **Impact:** no project mutation; process was explicitly stopped.
- **Resolution:** piped a finite prompt file into `codex exec ... -`, allowing stdin to close deterministically.
- **One-line solution:** use a finite prompt pipe for non-interactive Codex runs under this process host.

## F-10 — portable-project test used the old Creative artifact governance shape

- **Where:** first authoritative root regression, API `portable-project.contract.test.ts`.
- **What:** after Style Lock provenance became mandatory, the fixture omitted `styleLockContentHash` and `creativeDirectionRevision`, so canonical archive validation correctly refused it.
- **Impact:** API result was 410/411 on the first root pass; production code behaved as intended.
- **Resolution:** added exact fixture provenance; focused portable-project contract returned 3/3 PASS before the clean root rerun.
- **One-line solution:** every persisted Creative artifact must carry exact Approved Style Lock hash + Creative Direction revision provenance.

## F-11 — exact visual owner approval is intentionally not fabricated

- **Where:** real Codex independent-client acceptance.
- **What:** project truth says broad engineering authorization is not approval of a specific Creative Direction board.
- **Impact:** Codex acceptance stops at a pending revision-2 direction review and verifies planning remains blocked; it does not mint a Style Lock.
- **Resolution:** trusted approval mechanics are proven separately by deterministic STDIO acceptance and reconnect tests; real per-review visual approval remains a human evidence fact.
- **One-line solution:** preserve the host-only visual approval boundary instead of converting generic authorization into fake evidence.
