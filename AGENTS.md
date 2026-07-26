# AGENTS.md — Stage 2 Sanverse Video Editing

## Mission

Build a production-grade AI-native video editor that lets a non-editor upload a cleaned talking-head video, point or draw, describe changes in chat, preview them, approve them, and finish in minutes.

The owner is a non-technical founder and the primary product tester. Explain architecture and tradeoffs in plain language without hiding important technical facts.

## Highest-impact execution rule

**DO ONLY THE HIGHEST-IMPACT WORK THAT DIRECTLY ADVANCES THE ACTIVE GOAL. DO NOT EXPAND SCOPE, CHASE OPTIONAL IMPROVEMENTS, OR SPEND TOKENS FIXING NON-BLOCKING FAILURES. RECORD NON-BLOCKING FAILURES WITH WHAT/WHERE/WHEN/WHO/WHY/HOW, ATTEMPTS, STATUS, AND A ONE-LINE SOLUTION; THEN RETURN TO THE ACTIVE GOAL.**

Owner's exact standing command, verbatim:

> wtf is wrong with you dude you can't do a fucking simple github push  why the fuck do you keep going off track I told you to be on track don't fucking drift into unnecesary work don't fucking go into the void keep thi thing in fucking midn write this command everywhere don't fucking waste tokens i explicitly told you to fucking do nly the high impact tasks as fast as possible without unneeded works

## Required reload protocol

At the start of work, and again after context compaction, material owner corrections, three implementation commits, integration failures, or any destructive/external action:

1. Read `START_HERE.md`.
2. Read `DOCS/CURRENT_STATE.md` and `DOCS/HANDOVER_RUNBOOK.md`.
3. Read `DOCS/GOALS.md`, the active plan, and the relevant requirements and decisions.
4. Inspect the working tree; never assume chat memory is current truth.
5. Restate the active acceptance criterion before implementation.

## Zero Chinese whispers

- Preserve exact owner requirements in `DOCS/REQUIREMENTS.md`.
- Record durable architecture choices in `DOCS/DECISIONS.md`.
- Mark every important claim as verified fact, owner requirement, inference, proposal, or unknown.
- If the owner's wording is ambiguous and the interpretation changes scope materially, stop and ask.
- Never silently convert a proposal into an approved decision.

## Architecture rules

- Use a modular monolith initially, with explicit domain boundaries and replaceable adapters.
- Keep the canonical project/edit model independent of UI, AI provider, storage provider, and render engine.
- AI may translate intent into a typed edit proposal. Deterministic code must validate, simulate, authorize, execute, and record it.
- Keep source media immutable. Use non-destructive edits, version history, undo, and reproducible renders.
- Production-grade architecture begins immediately. Full SaaS operational features are added only when validated product needs justify them.
- Prefer one end-to-end vertical slice over many disconnected horizontal subsystems.
- Never hide domain logic inside route handlers, UI components, prompts, or provider SDKs.

## Product and interface rules

- Optimize for a non-editor completing a real video in minutes, not for feature-count parity with Premiere Pro or DaVinci Resolve.
- Initial visual language is black, white, and grayscale. No decorative gradients or ornamental animation.
- The default surface is a focused Studio: project/export controls, video canvas, conversational edit panel, and a simple time strip.
- Complexity may be progressively disclosed, but the first successful edit must not require timeline expertise.
- Build editing primitives in gated stages; do not attempt a complete NLE clone at once.

## Quality gate

For each architecture decision or implementation change, ask:

1. Is responsibility owned by the correct module?
2. Are contracts explicit, typed, versionable, and testable?
3. Is failure safe, visible, and recoverable?
4. Can the component be replaced without rewriting unrelated domains?
5. Is the simplest design that satisfies current verified needs being used?
6. Does this reduce time-to-finished-video for the target user?
7. Is the evidence strong enough for the claim being made?

“A billion-dollar CTO would build it” means disciplined boundaries, tests, observability, security, and evolution paths—not speculative complexity.

## Change workflow

1. Link the change to a requirement and decision.
2. Define one observable acceptance criterion.
3. For production behavior, write a failing test first.
4. Implement the smallest complete slice.
5. Run targeted checks, then the broader relevant suite.
6. Record evidence and limitations.
7. Update `CURRENT_STATE`, `BUILD_TRACKER`, and `PROJECT_LOG`.
8. Commit a coherent, reversible change.

## Safety and truthfulness

- Be neutral and direct. Do not agree or disagree for social reasons.
- Never call a feature complete from code inspection alone.
- Use evidence levels defined in `DOCS/CHANGE_POLICY.md`.
- Semantic AI failures must fail closed or request clarification; no blind retries or silent guesses.
- Never commit secrets, raw user media, private transcripts, or generated exports.
- No destructive Git operations without explicit owner approval.
