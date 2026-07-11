# Change Record: G0 foundation and continuity

- Date: 2026-07-12
- Goal: G0
- Requirements: REQ-001 through REQ-011
- Decisions: DEC-001 through DEC-008
- Acceptance criterion: The project has a project-specific, locally verified continuity and governance baseline with no product-capability overclaim.
- Status: Locally verified; GitHub evidence is recorded separately after remote creation.

## Why

Stage 2 is large enough that coding before locking the product contract, trust boundary, renderer decision method, and resume protocol would compound drift and rework.

## Scope

- Durable product intent, requirements, decisions, goal map, risks, and interface principles
- Exact master roadmap and G1 plan
- Lightweight deterministic context hooks
- Governance and setup verification
- Git safety and evidence policy

## Architecture impact

This change locks the principle-level boundaries but implements no product architecture. It requires a modular monolith, canonical edit model, deterministic action executor, and replaceable adapters when G2 begins.

## Files/modules changed

Documentation, `.codex` hook configuration, PowerShell continuity/verification scripts, and repository ignore/attribute rules.

## Tests and evidence

- Required-file and hook-configuration verification: passed
- Governance invariant and secret-pattern verification: passed
- Context hook JSON output checks: passed
- Prompt logger append check against synthetic input: passed; synthetic entry removed afterward
- Evidence level: E2 for the G0 safeguards; E0 for product capability

## Limitations and risks

- Integrated Codex hook firing may require opening a new trusted session.
- Documentation cannot prevent drift if future changes fail to update it.
- No interface, renderer, project engine, or edit workflow exists yet.

## Migration and rollback

The baseline is documentation/configuration only. Individual hook commands can be disabled in `.codex/hooks.json`; committed files can be reverted without affecting user media because no media state exists.

## Follow-up

Create and verify the private GitHub remote, then request explicit owner approval for G1.
