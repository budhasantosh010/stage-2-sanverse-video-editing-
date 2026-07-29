# ADR-009 — Versioned recipes produce atomic compound proposals

- Status: Accepted
- Date: 2026-07-29
- Goals: G7-02 through G7-09

## Decision

The component platform is an immutable, code-owned registry:

- every recipe has an explicit `/vN` ID and numeric version;
- every recipe pins its component, compatible operation schema, allowed
  operation kinds, allowed capabilities, and appearance contract;
- migrations preserve the exact recipe version or fail closed;
- outcome workflows allow only named recipes;
- actions carry stable IDs and explicit dependencies;
- planning validates the entire dependency graph and entire change set before
  returning anything;
- one compound request produces one change set, one approval, and one Undo.

Initial executable recipes are clean nameplate, readable captions, outline
callout, boxed title, and bouncy title. Initial outcome workflows are intro,
readable video, highlight moment, and polish talking head.

## Repair rule

Repair replaces one named action and revalidates the complete plan. Unchanged
actions retain their original object identity, so a correction cannot silently
reinterpret the parts the user already accepted.

## Compatibility rule

An old selection without a pinned recipe version is not migrated to today's
default. That would silently restyle old work. It is rejected for explicit
clarification instead.

## Evidence

Focused contracts prove:

- five version-pinned recipes and exact compatibility lookup;
- idempotent metadata migration and refusal of unversioned legacy metadata;
- dependency ordering plus unknown-dependency rejection;
- incompatible mixed actions fail as a whole;
- detached two-action compound preview without mutating the saved project;
- targeted repair preserves the unaffected action;
- title plus callout accept as one change set and disappear together after one
  Undo.

G7-10 later proved that a v1 nameplate retains its exact component/style,
words, point, and top-left anchor through migration and reopen. G7-01 and G7-11
remain owner approval/use gates.
