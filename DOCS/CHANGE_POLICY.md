# Change and Evidence Policy

## Evidence levels

| Level | Meaning |
|---|---|
| E0 | Idea, requirement, or unimplemented plan |
| E1 | Static file/code inspection only |
| E2 | Targeted automated checks pass |
| E3 | Integrated workflow passes on controlled fixtures |
| E4 | Owner completes a representative real workflow successfully |
| E5 | Repeated representative use meets measured reliability, time, and recovery targets |

Never describe an item with stronger language than its evidence level supports.

## Required change record

A meaningful implementation change must state:

- linked requirement and decision;
- observable acceptance criterion;
- affected modules/files;
- migration and rollback path;
- tests run and evidence level reached;
- limitations and follow-up work.

Use `DOCS/CHANGE_RECORD_TEMPLATE.md` for changes large enough to need a durable review trail.

## Production behavior

- Use test-driven development: failing test, minimal implementation, refactor with tests green.
- Prefer contract, invariant, and end-to-end slice tests over brittle implementation-detail tests.
- Treat media rendering, timebase math, undo, migrations, and authorization as high-risk domains.
- A passing unit test does not prove preview/render fidelity or usability.

## Dependencies

Add a dependency only when:

1. A current requirement needs it.
2. Its ownership and replacement boundary are clear.
3. Maintenance, licensing, security, and deployment costs are understood.
4. A simpler existing capability is insufficient.

## Scope

Do not combine unrelated refactors with a feature slice. Preserve existing user changes. No destructive Git operations without explicit approval.
