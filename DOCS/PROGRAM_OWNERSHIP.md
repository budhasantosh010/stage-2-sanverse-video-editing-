# SANVERSE PROGRAM OWNERSHIP

This contract is permanent. It applies to every Sanverse implementation session unless the owner explicitly declares a cross-program integration milestone.

## General rule

**Reading across program boundaries is allowed. Writing across program boundaries is forbidden.**

Each program owns its own branch, Git worktree, implementation files, tests, evidence and publishing lifecycle. A program that needs another program to change something reports the required capability; the owning program implements it.

No agent may use another program's live worktree as a shared scratch directory, test target or cleanup target.

## Editor Program

The Editor Program owns the production editing experience and works only from its assigned editor branch/worktree.

Owned editor scope includes:

- `apps/web` production Studio and Timeline;
- Timeline domain planners and editor presentation state;
- the current Preview and one-video playback authority;
- current Canvas and Inspector behavior;
- accepted project state and edit operations;
- history, Undo/Redo and editor selection;
- editor media handling;
- editor playback and export integration;
- editor-specific tests and evidence/docs.

Editor agents may read committed code from the Motion and AI programs when architectural context is required. They must not write those programs' implementations.

### Motion paths prohibited to Editor writes

The following paths are owned by Motion Program Plan A + C and are read-only to Editor:

- `apps/motion-lab/**`
- `packages/motion-*/**` — the wildcard is intentional and protects any present or future package whose name begins with `motion-`
- `motion/**`
- `DOCS/motion/**`

Editor must not import unfinished Motion packages into production `apps/web`. Until an owner-declared Motion→Editor integration milestone, production `apps/web` imports beginning with `@sanverse/motion-` and imports that reach `apps/motion-lab` are forbidden.

Editor must not enter, switch, reset, rebase, clean, prune, remove, publish or otherwise operate inside a Motion worktree. It must not terminate Motion-owned Node, Vite, Vitest, FFmpeg, Edge/Chromium or render processes.

### Plan B scope prohibited to Editor

Plan B is separately owned by the AI Program. Editor does not independently implement:

- transcript AI or semantic video understanding;
- automatic Motion component ranking/selection;
- face-aware or negative-space placement intelligence;
- AI motion planning or motion-graph operations;
- AI compositor commands;
- autonomous visual placement;
- Plan-B-specific packages.

Later Editor work may expose deterministic Timeline-side contracts explicitly assigned to the Editor roadmap, but it does not take ownership of Plan B.

## Motion Program — Plan A + C

Motion Program works in a separate Motion worktree and owns:

- `apps/motion-lab/**`;
- `packages/motion-*/**`;
- `motion/**`;
- `DOCS/motion/**`.

It owns Motion Lab, Motion Graph, style packs, motion primitives/components, native runtime/compositor work, masks, motion keyframes and Motion Plan documentation.

The production Editor remains read-only to unfinished Motion implementations until the owner explicitly opens an integration milestone.

## AI Program — Plan B

AI Program works in a separate worktree and owns future Plan-B-specific implementation, including semantic video understanding and autonomous planning/selection capabilities.

Plan B does not directly mutate production editor state. Deterministic Editor operations remain the authority for accepted project changes. Plan B also does not take ownership of Motion internals; cross-program needs are reported to the owning program.

## Shared-root files

Files such as root `package.json`, lockfiles, workspace configuration, root TypeScript/lint/build configuration, `.gitignore` and documentation indexes may affect more than one program.

A program should avoid changing shared-root files unless its assigned milestone genuinely requires the change. If a shared-root change is unavoidable:

1. state the requirement before editing;
2. prefer a scoped alternative;
3. make the smallest possible edit;
4. preserve registrations/configuration belonging to other programs;
5. report the exact shared-file change in the milestone evidence.

T3 Precision Trimming requires no dependency, package-manager or workspace-root change.

## Editor boundary verification

Editor sessions use:

```text
node tools/program-ownership/check-editor-boundary.mjs --base <CURRENT_EDITOR_MILESTONE_BASE>
```

The checker verifies committed changes since the milestone base, staged changes, unstaged tracked changes, and untracked files for protected Motion paths. It also scans production `apps/web` source for forbidden Motion imports.

Before every Editor commit and at the start/end of an Editor coding session the expected result is:

```text
EDITOR PROGRAM BOUNDARY: PASS
```

If the checker fails, stop before commit. Do not automatically restore, clean or overwrite the reported files; determine ownership first so another agent's work is never destroyed.
