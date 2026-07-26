# Anti-Drift Protocol

Drift is prevented by durable truth, explicit gates, and reproducible evidence—not by assuming a model remembers a long conversation.

## Highest-impact execution rule

**DO ONLY THE HIGHEST-IMPACT WORK THAT DIRECTLY ADVANCES THE ACTIVE GOAL. DO NOT EXPAND SCOPE, CHASE OPTIONAL IMPROVEMENTS, OR SPEND TOKENS FIXING NON-BLOCKING FAILURES. RECORD NON-BLOCKING FAILURES WITH WHAT/WHERE/WHEN/WHO/WHY/HOW, ATTEMPTS, STATUS, AND A ONE-LINE SOLUTION; THEN RETURN TO THE ACTIVE GOAL.**

## Four-layer continuity spine

1. **Intent:** `MACRO_GOAL`, `REQUIREMENTS`, and owner corrections
2. **Decision:** `DECISIONS` with rationale and revisit triggers
3. **Execution:** active plan, `BUILD_TRACKER`, and change records
4. **Evidence:** tests, run records, failures, commit history, and owner feedback

## Mandatory reload events

Reload the continuity spine:

- at session start;
- after context compaction;
- after a material owner correction;
- after three implementation commits;
- after an integration failure;
- before destructive, paid, public, or production-impacting actions.

## Goal convergence check

At the end of each medium-to-large goal, answer with evidence:

1. Did time-to-finished-video improve or become measurable?
2. Did the workflow require less editor knowledge?
3. Are accepted edits reproducible and reversible?
4. Are failure cases visible and recoverable?
5. Which macro-goal uncertainty was reduced?

If a goal does not improve or de-risk the macro goal, do not continue it by inertia.

## Drift indicators

- Feature work has no linked requirement.
- A proposal is described as approved without owner evidence.
- The chat says “done” while current state or tests disagree.
- A new library or service owns domain logic that belongs in the engine.
- A primitive is built without a user workflow that needs it.
- SaaS operations are being built before local product value is demonstrated.
- A provider-specific assumption leaks into the canonical project contract.
- Interface complexity grows without reducing measured task time.

## Correction protocol

When the owner corrects the project:

1. Quote or faithfully paraphrase the correction.
2. Identify affected requirements, decisions, plan items, and files.
3. Update those durable records in the same change set.
4. Record any superseded assumption.
5. Re-run relevant verification.
6. Explain the impact in plain language.

## Token efficiency

Keep `START_HERE.md` and `CURRENT_STATE.md` short. Read deeper documents only when their domain is active. The full conversation is supporting context; committed project truth is the operational resume mechanism.
